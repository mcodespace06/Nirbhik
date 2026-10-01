import { prisma } from '../../lib/prisma';
import { mailer } from '../notifications/mailer';
import { findNearestPoliceStations, NearestStation } from './haversine';
import { sosBus } from './bus';
import { PoliceStation } from '@prisma/client';
import { sendTwilioSms } from './twilio';

export interface DispatchRecipient {
  type: 'POLICE_STATION' | 'CAMPUS_SECURITY';
  name: string;
  email: string;
  phone: string;
  distanceKm?: number;
  dispatchedAt: string;
  channel: 'EMAIL' | 'SMS' | 'BROADCAST';
}

export interface SosDispatchResult {
  dispatchedTo: DispatchRecipient[];
  nearestStations: NearestStation<PoliceStation>[];
  emergencyHotlines: { name: string; number: string }[];
}

export async function dispatchSosAlert(
  sosId: string,
  lat: number,
  lng: number,
  accuracy?: number | null,
  userInfo?: { username: string; email: string; phone?: string | null; role: string }
): Promise<SosDispatchResult> {
  const DEFAULT_POLICE_STATIONS: PoliceStation[] = [
    {
      id: 'default-ps-1',
      name: 'Campus Central Police Station',
      email: process.env.DISPATCH_ALERT_EMAIL || 'smahek911@gmail.com',
      phone: process.env.TWILIO_TARGET_PHONE || '+918591680180',
      lat: 19.0770,
      lng: 72.8785,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'default-ps-2',
      name: 'North District Police Precinct',
      email: process.env.DISPATCH_ALERT_EMAIL || 'smahek911@gmail.com',
      phone: process.env.TWILIO_TARGET_PHONE || '+918591680180',
      lat: 19.0820,
      lng: 72.8760,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  let stations: PoliceStation[] = [];
  try {
    stations = await prisma.policeStation.findMany({
      where: { active: true },
    });
    if (!stations || stations.length === 0) {
      stations = DEFAULT_POLICE_STATIONS;
    }
  } catch (dbErr: any) {
    console.warn(`[SOS Dispatch Warning] Database station lookup offline (${dbErr.message}). Using resilient campus fallback stations.`);
    stations = DEFAULT_POLICE_STATIONS;
  }

  const nearestStations = findNearestPoliceStations(lat, lng, stations, 2);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  const now = new Date().toISOString();

  const dispatchedTo: DispatchRecipient[] = [];

  // 1. Dispatch to nearest police stations
  for (const item of nearestStations) {
    dispatchedTo.push({
      type: 'POLICE_STATION',
      name: item.station.name,
      email: item.station.email,
      phone: item.station.phone,
      distanceKm: item.distanceKm,
      dispatchedAt: now,
      channel: 'EMAIL',
    });

    // In production/dev: deliver email alert
    try {
      await mailer.sendMail({
        to: item.station.email,
        subject: `[EMERGENCY SOS ALERT] Distress Signal at Campus Coordinates (${item.distanceKm} km from ${item.station.name})`,
        text: `EMERGENCY DISTRESS CALL
Event ID: ${sosId}
Location: Latitude ${lat}, Longitude ${lng} (Accuracy: ~${accuracy || 15}m)
Google Maps Link: ${mapsUrl}
Proximity: ${item.distanceKm} km to ${item.station.name}
Reported by: ${userInfo ? `${userInfo.username} (${userInfo.role}) - ${userInfo.phone || 'Phone not provided'}` : 'Campus User'}

Please dispatch campus police responder immediately.
Alert dispatched to registered police/security contacts.`,
      });
    } catch (err: any) {
      console.warn(`[SOS Dispatch] Police station email warning: ${err.message}`);
    }

    // Live Twilio SMS dispatch
    await sendTwilioSms({
      to: item.station.phone,
      body: `🚨 SOS EMERGENCY — HELP NEEDED IMMEDIATELY\n\nA student on campus has triggered an emergency distress alert and needs urgent assistance.\n\n📍 LIVE LOCATION:\n${mapsUrl}\nCoordinates: ${lat}, ${lng} (±${accuracy || 15}m)\n\n👤 Victim: ${userInfo?.username || 'Campus Student'} (${userInfo?.role || 'STUDENT'})\n📞 Contact: ${userInfo?.phone || 'Not available'}\n📧 Email: ${userInfo?.email || 'N/A'}\n\n🏛️ Nearest Station: ${item.station.name} (${item.distanceKm} km away)\n⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n⚠️ THIS IS NOT A DRILL. Please dispatch a responder to the location immediately. Call 112 if needed.\n\n— Nirbhik Campus Safety System`,
    });
  }

  // 2. Dispatch to Campus Security Officers
  const securityDeskEmail = process.env.SECURITY_DESK_EMAIL || process.env.DISPATCH_ALERT_EMAIL || 'smahek911@gmail.com';
  const securityDeskPhone = process.env.SECURITY_DESK_PHONE || process.env.TWILIO_TARGET_PHONE || '+918591680180';

  dispatchedTo.push({
    type: 'CAMPUS_SECURITY',
    name: 'Campus Central Security Control',
    email: securityDeskEmail,
    phone: securityDeskPhone,
    dispatchedAt: now,
    channel: 'BROADCAST',
  });

  try {
    await mailer.sendMail({
      to: securityDeskEmail,
      subject: `🚨 [IMMEDIATE ACTION] Campus Emergency SOS Alert (${userInfo?.username || 'Student'})`,
      text: `CAMPUS DISTRESS CALL ACTIVATED
SOS Event ID: ${sosId}
Coordinates: ${lat}, ${lng}
GPS Map: ${mapsUrl}
User: ${userInfo?.username || 'Anonymous Campus Student'}
Contact: ${userInfo?.phone || userInfo?.email || 'N/A'}
Nearest Precinct: ${nearestStations[0]?.station.name || 'Local Post'} (${nearestStations[0]?.distanceKm || 0} km away)

Alert sent to registered police/security contacts. Speed dial 112 active.`,
    });
  } catch (err: any) {
    console.warn(`[SOS Dispatch] Security desk email warning: ${err.message}`);
  }

  // Dispatch live SMS to campus security desk
  await sendTwilioSms({
    to: securityDeskPhone,
    body: `🚨 CAMPUS EMERGENCY — SOS ALERT ACTIVATED\n\nIMPORTANT: A student has pressed the emergency SOS button and is in distress. Immediate help is required at their location.\n\n📍 CURRENT LOCATION (tap to open Google Maps):\n${mapsUrl}\nGPS: ${lat}, ${lng}\n\n👤 Name: ${userInfo?.username || 'Anonymous Student'}\n📞 Phone: ${userInfo?.phone || 'Not provided'}\n📧 Email: ${userInfo?.email || 'N/A'}\n\n🚔 Nearest Police: ${nearestStations[0]?.station.name || 'Campus Police'} (${nearestStations[0]?.distanceKm || '?'} km)\n⏰ Alert Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n🔴 ACTIONS NEEDED:\n1. Call the student immediately\n2. Dispatch security to the location\n3. Dial 112 if life-threatening\n\n— Nirbhik Campus Safety System`,
  });

  // 3. Realtime Broadcast to Security & Admin Consoles via SSE
  sosBus.broadcast('sos_triggered', {
    sosId,
    lat,
    lng,
    accuracy,
    userInfo,
    mapsUrl,
    nearestStations,
    dispatchedTo,
    timestamp: now,
  });

  // Standard emergency hotlines
  const emergencyHotlines = [
    { name: 'National Emergency', number: '112' },
    { name: 'Campus Security Quick Dial', number: securityDeskPhone },
    { name: 'Women Helpline', number: '1091' },
    { name: 'National Anti-Ragging Helpline', number: '1800-180-5522' },
  ];

  return {
    dispatchedTo,
    nearestStations,
    emergencyHotlines,
  };
}
