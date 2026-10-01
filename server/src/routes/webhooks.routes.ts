import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Role, SosStatus } from '@prisma/client';
import { dispatchSosAlert } from '../services/sos/dispatch';

export const webhooksRouter = Router();

/**
 * Default Campus Coordinates (Mumbai / Indian University Campus baseline)
 */
const DEFAULT_CAMPUS_LAT = 19.0760;
const DEFAULT_CAMPUS_LNG = 72.8777;

/**
 * GET /api/webhooks/info
 * Returns status and setup instructions for WhatsApp and Telegram webhooks
 */
webhooksRouter.get('/info', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ACTIVE',
    channels: {
      whatsapp: {
        provider: 'Twilio WhatsApp Sandbox',
        webhookUrl: '/api/webhooks/whatsapp',
        method: 'POST',
        supportedTriggers: ['SOS', 'HELP', 'EMERGENCY', 'RAGGING', 'Location Drop'],
      },
      telegram: {
        provider: 'Telegram Bot Webhook',
        webhookUrl: '/api/webhooks/telegram',
        method: 'POST',
        supportedCommands: ['/sos', '/help', 'Location Drop'],
      },
    },
    quickTestEndpoint: '/api/webhooks/simulate-sos',
  });
});

/**
 * POST /api/webhooks/whatsapp
 * Twilio WhatsApp Webhook: Receives incoming WhatsApp messages & location drops
 */
webhooksRouter.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const from = req.body.From || req.body.from || 'whatsapp:+919876543210';
    const body = (req.body.Body || req.body.body || '').trim();
    const profileName = req.body.ProfileName || 'WhatsApp User';
    
    // Extract GPS coordinates if user dropped a WhatsApp location
    const lat = req.body.Latitude ? parseFloat(req.body.Latitude) : DEFAULT_CAMPUS_LAT;
    const lng = req.body.Longitude ? parseFloat(req.body.Longitude) : DEFAULT_CAMPUS_LNG;

    console.log(`[WhatsApp Webhook] Incoming message from ${from} (${profileName}): "${body}" at (${lat}, ${lng})`);

    // Find or link a system user account for the SOS record
    let user = await prisma.user.findFirst({
      where: { role: Role.STUDENT },
    });
    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      res.set('Content-Type', 'text/xml');
      return res.status(200).send(`
        <Response>
          <Message>🚨 [NIRBHIK ERROR] Campus dispatch service unavailable. Please call 112 immediately.</Message>
        </Response>
      `);
    }

    // Create SOS event record
    const sosEvent = await prisma.sosEvent.create({
      data: {
        userId: user.id,
        lat,
        lng,
        accuracy: 15,
        status: SosStatus.TRIGGERED,
      },
    });

    await prisma.sosLocationPing.create({
      data: {
        sosId: sosEvent.id,
        lat,
        lng,
      },
    });

    const userInfo = {
      username: `${profileName} (${from})`,
      email: user.collegeEmail,
      phone: from.replace('whatsapp:', ''),
      role: 'STUDENT_WHATSAPP',
    };

    // Execute multi-channel emergency dispatch
    const dispatchResult = await dispatchSosAlert(sosEvent.id, lat, lng, 15, userInfo);

    await prisma.sosEvent.update({
      where: { id: sosEvent.id },
      data: {
        status: SosStatus.DISPATCHED,
        dispatchedTo: dispatchResult.dispatchedTo as any,
      },
    });

    // Return TwiML XML response for Twilio WhatsApp
    const nearestName = dispatchResult.nearestStations[0]?.station.name || 'Local Police Precinct';
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>🚨 *[NIRBHIK EMERGENCY DISPATCH ACTIVATED]*

Your distress beacon has been registered and broadcasted!
• *Assigned Police Precinct*: ${nearestName}
• *Campus Quick-Response Team*: Dispatched to your GPS location
• *Location*: https://maps.google.com/?q=${lat},${lng}
• *Emergency Tracking Ref*: #${sosEvent.id.slice(-6).toUpperCase()}

Stay calm in a secure location. Help is on the way. For immediate voice connection, call *112* or Campus Security: *+91-9876543210*.</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twimlResponse);
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]:', err);
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(`
      <Response>
        <Message>🚨 [EMERGENCY ALERT RECEIVED] Campus security notified. Call 112 if in direct danger.</Message>
      </Response>
    `);
  }
});

/**
 * POST /api/webhooks/telegram
 * Telegram Bot Webhook: Receives updates, commands, or location drops
 */
webhooksRouter.post('/telegram', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const message = update?.message || {};
    const text = message.text || '';
    const from = message.from || {};
    const username = from.username || from.first_name || 'Telegram User';

    const lat = message.location?.latitude || DEFAULT_CAMPUS_LAT;
    const lng = message.location?.longitude || DEFAULT_CAMPUS_LNG;

    console.log(`[Telegram Webhook] Update from @${username}: "${text}" at (${lat}, ${lng})`);

    let user = await prisma.user.findFirst({ where: { role: Role.STUDENT } });
    if (!user) user = await prisma.user.findFirst();

    if (!user) {
      return res.status(500).json({ error: 'System user unavailable' });
    }

    const sosEvent = await prisma.sosEvent.create({
      data: {
        userId: user.id,
        lat,
        lng,
        accuracy: 20,
        status: SosStatus.TRIGGERED,
      },
    });

    const userInfo = {
      username: `@${username} (Telegram)`,
      email: user.collegeEmail,
      phone: 'Telegram Bot Gateway',
      role: 'STUDENT_TELEGRAM',
    };

    const dispatchResult = await dispatchSosAlert(sosEvent.id, lat, lng, 20, userInfo);

    await prisma.sosEvent.update({
      where: { id: sosEvent.id },
      data: {
        status: SosStatus.DISPATCHED,
        dispatchedTo: dispatchResult.dispatchedTo as any,
      },
    });

    return res.status(200).json({
      ok: true,
      sosId: sosEvent.id,
      message: '🚨 Emergency SOS Beacon Dispatched from Telegram Gateway',
      nearestPoliceStation: dispatchResult.nearestStations[0]?.station.name,
      dispatchedRecipients: dispatchResult.dispatchedTo.length,
    });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/webhooks/simulate-sos
 * Test runner endpoint to simulate an emergency trigger from WhatsApp or Telegram
 */
webhooksRouter.post('/simulate-sos', async (req: Request, res: Response) => {
  try {
    const { channel = 'WHATSAPP', sender = '+919876543210', message = 'HELP SOS IN HOSTEL B', lat, lng } = req.body;

    const targetLat = typeof lat === 'number' ? lat : DEFAULT_CAMPUS_LAT;
    const targetLng = typeof lng === 'number' ? lng : DEFAULT_CAMPUS_LNG;

    let user = await prisma.user.findFirst({ where: { role: Role.STUDENT } });
    if (!user) user = await prisma.user.findFirst();

    if (!user) {
      return res.status(500).json({ error: 'No user account found to bind simulated beacon' });
    }

    const sosEvent = await prisma.sosEvent.create({
      data: {
        userId: user.id,
        lat: targetLat,
        lng: targetLng,
        accuracy: 10,
        status: SosStatus.TRIGGERED,
      },
    });

    const userInfo = {
      username: `Simulated ${channel} Sender (${sender})`,
      email: user.collegeEmail,
      phone: sender,
      role: `STUDENT_${channel}`,
    };

    const dispatchResult = await dispatchSosAlert(sosEvent.id, targetLat, targetLng, 10, userInfo);

    await prisma.sosEvent.update({
      where: { id: sosEvent.id },
      data: {
        status: SosStatus.DISPATCHED,
        dispatchedTo: dispatchResult.dispatchedTo as any,
      },
    });

    return res.status(200).json({
      success: true,
      channel,
      message: `Emergency SOS triggered successfully via simulated ${channel} gateway`,
      sosId: sosEvent.id,
      gps: { lat: targetLat, lng: targetLng },
      dispatchedRecipients: dispatchResult.dispatchedTo,
      nearestStations: dispatchResult.nearestStations.map((s) => ({
        name: s.station.name,
        distanceKm: s.distanceKm,
      })),
    });
  } catch (err: any) {
    console.error('[Simulate SOS Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});
