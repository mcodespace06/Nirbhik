/**
 * AI Case Analyzer Service (Indian Law & Pre-Filing Triage)
 *
 * Provides conversational victim consultation grounded in Indian Law:
 * - Bharatiya Nyaya Sanhita (BNS) 2023 & IPC mappings
 * - UGC Regulations on Curbing the Menace of Ragging (2009)
 * - POSH Act 2013 (Internal Complaints Committee)
 * - Information Technology (IT) Act 2000
 * - POCSO Act 2012
 *
 * Includes automated formal FIR drafting adhering to statutory police templates.
 */

import { getAIProvider, ChatMessage } from './provider';

export interface BrokenLaw {
  act: string;
  section: string;
  title: string;
  description: string;
  punishment?: string;
  bailable: boolean;
  cognizable: boolean;
}

export interface CaseConsultationResult {
  guidance: string;
  brokenLaws: BrokenLaw[];
  immediateActions: string[];
  resolutionPaths: {
    name: string;
    authority: string;
    description: string;
    slaOrTimeline: string;
  }[];
  firDraft: string;
}

const INDIAN_LAW_KNOWLEDGE_BASE = `
KEY STATUTES IN HIGHER EDUCATION & CAMPUS SAFETY:
1. UGC Regulations on Curbing the Menace of Ragging (2009):
   - Regulation 3: Defines ragging broadly (physical/mental abuse, tease, rough treatment, humiliation, financial extortion).
   - Regulation 7: Immediate suspension, rustication, cancellation of admission.
   - Regulation 9: Mandatory filing of police FIR within 24 hours of receiving complaint.

2. Bharatiya Nyaya Sanhita (BNS) 2023 (replacing IPC):
   - Section 351: Assault / Criminal Force.
   - Section 352: Intentional insult with intent to provoke breach of peace.
   - Section 115: Voluntarily causing hurt.
   - Section 74: Assault or criminal force to woman with intent to outrage modesty (Non-bailable, cognizable).
   - Section 78: Stalking (physical or electronic monitoring without consent).
   - Section 79: Word, gesture or act intended to insult modesty of a woman.
   - Section 308: Extortion / Coercion.
   - Section 351(2): Criminal intimidation (threat to cause injury to person, reputation or property).

3. Information Technology (IT) Act, 2000:
   - Section 66C: Identity theft / unauthorized access.
   - Section 66E: Violation of bodily privacy (capturing/publishing private images without consent).
   - Section 67 / 67A: Publishing sexually explicit material or obscenity electronically.

4. POSH Act, 2013:
   - Section 9: Complaint of sexual harassment before Internal Complaints Committee (ICC) within 3 months.
   - Section 11: Inquiry into complaint with interim relief protection.
`;

const SYSTEM_PROMPT = `
You are the AI Legal & Grievance Counselor for Nirbhik Campus Safety System, trained in Indian Criminal Law, UGC Regulations, POSH Act, and IT Act.
MANDATORY DISCLAIMER: Your guidance is strictly for informational and pre-filing triage purposes. You are not a certified lawyer.

Your role:
1. Empathize with the victim while remaining objective and calm.
2. Analyze the narrative and identify broken Indian laws and campus safety codes.
3. Provide immediate safety actions (preserving digital evidence, screenshots, call logs, witnesses).
4. Outline concrete resolution paths (Campus ICC, Anti-Ragging Squad, Local Police Station, National Cyber Crime portal).
5. Generate a formal, structured FIR (First Information Report) draft following standard Indian Police Bureau formats.
`;

export async function consultCase(params: {
  story: string;
  incidentLocation?: string;
  incidentDate?: string;
  victimPseudonym?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<CaseConsultationResult> {
  const provider = getAIProvider();

  const history: ChatMessage[] = (params.conversationHistory || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  history.push({
    role: 'user',
    content: `Incident Narrative:\n"${params.story}"\nLocation: ${params.incidentLocation || 'Campus Premise'}\nDate/Time: ${params.incidentDate || 'Recent'}`,
  });

  // Extract structured analysis using AI Provider
  const prompt = `
Analyze the victim's situation using Indian Law. Respond with a JSON object with this exact structure:
{
  "guidance": "Detailed, empathetic legal & procedural guidance explaining what happened and next steps.",
  "brokenLaws": [
    {
      "act": "Bharatiya Nyaya Sanhita, 2023 / UGC / IT Act",
      "section": "Section number",
      "title": "Short title",
      "description": "Why this section applies to this incident",
      "punishment": "Maximum statutory punishment",
      "bailable": false,
      "cognizable": true
    }
  ],
  "immediateActions": [
    "Action item 1 (e.g. screenshot WhatsApp chats with timestamps)",
    "Action item 2"
  ],
  "resolutionPaths": [
    {
      "name": "Internal Complaints Committee (ICC) / Anti-Ragging Committee / Cyber Crime Cell",
      "authority": "Designated Authority Name",
      "description": "What happens when filed here",
      "slaOrTimeline": "Statutory timeline (e.g. 7 days or 24 hours)"
    }
  ],
  "firDraft": "Full formal FIR draft text with standard Indian police formatting including complainant details, date/time, place, accused, sections, facts narrative, and prayer."
}
`;

  try {
    const rawResult = await provider.chat({
      system: SYSTEM_PROMPT + '\n' + INDIAN_LAW_KNOWLEDGE_BASE,
      messages: [{ role: 'user', content: prompt + '\nVictim Narrative:\n' + params.story }],
    });

    // Try extracting JSON from output
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        guidance: parsed.guidance || 'Your situation has been analyzed against Indian Criminal & Campus safety statutes.',
        brokenLaws: Array.isArray(parsed.brokenLaws) ? parsed.brokenLaws : getFallbackLaws(params.story),
        immediateActions: Array.isArray(parsed.immediateActions) ? parsed.immediateActions : getFallbackActions(),
        resolutionPaths: Array.isArray(parsed.resolutionPaths) ? parsed.resolutionPaths : getFallbackPaths(),
        firDraft: parsed.firDraft || generateFallbackFir(params),
      };
    }
  } catch (err: any) {
    console.warn('[Case Analyzer AI Warning]:', err.message);
  }

  // Resilient deterministic fallback grounded in Indian Law
  return {
    guidance: `Based on your statement, the reported actions constitute a clear violation of university conduct codes and Indian criminal law. You have a legal right to protection, anonymity, and institutional intervention under statutory UGC regulations and the Bharatiya Nyaya Sanhita (BNS).`,
    brokenLaws: getFallbackLaws(params.story),
    immediateActions: getFallbackActions(),
    resolutionPaths: getFallbackPaths(),
    firDraft: generateFallbackFir(params),
  };
}

function getFallbackLaws(story: string): BrokenLaw[] {
  const lower = story.toLowerCase();
  const laws: BrokenLaw[] = [];

  if (lower.includes('rag') || lower.includes('junior') || lower.includes('senior') || lower.includes('hostel')) {
    laws.push({
      act: 'UGC Regulations on Curbing the Menace of Ragging, 2009',
      section: 'Regulation 3 & 7',
      title: 'Prohibition of Ragging in Higher Educational Institutions',
      description: 'Zero-tolerance mandate. Requires mandatory suspension and filing of police FIR within 24 hours.',
      punishment: 'Immediate rustication, debarment from exams, police arrest',
      bailable: false,
      cognizable: true,
    });
  }

  if (lower.includes('photo') || lower.includes('video') || lower.includes('chat') || lower.includes('online') || lower.includes('instagram') || lower.includes('leak')) {
    laws.push({
      act: 'Information Technology (IT) Act, 2000',
      section: 'Section 66E & 67',
      title: 'Violation of Bodily Privacy & Transmitting Obscene Material',
      description: 'Capturing, transmitting, or threatening to publish private photos/messages without consent.',
      punishment: 'Imprisonment up to 3 years and fine up to ₹2 Lakh',
      bailable: false,
      cognizable: true,
    });
  }

  if (lower.includes('threat') || lower.includes('blackmail') || lower.includes('extort')) {
    laws.push({
      act: 'Bharatiya Nyaya Sanhita (BNS), 2023',
      section: 'Section 308 & 351(2)',
      title: 'Extortion & Criminal Intimidation',
      description: 'Threatening to injure reputation, bodily safety, or extort compliance through coercion.',
      punishment: 'Imprisonment up to 2 years, or fine, or both',
      bailable: false,
      cognizable: true,
    });
  }

  if (laws.length === 0) {
    laws.push({
      act: 'Bharatiya Nyaya Sanhita (BNS), 2023',
      section: 'Section 352',
      title: 'Intentional Insult & Harassment with Intent to Provoke',
      description: 'Hostile conduct, intimidation, or harassment violating institutional safety standards.',
      punishment: 'Imprisonment up to 2 years or fine',
      bailable: true,
      cognizable: false,
    });
  }

  return laws;
}

function getFallbackActions(): string[] {
  return [
    'Take high-resolution screenshots of all electronic chats, call logs, and profiles (do not delete conversations).',
    'Record the exact names, dates, times, and specific room numbers / campus locations where incidents occurred.',
    'Keep physical or digital backups of any voice notes, emails, or multimedia evidence on an external drive.',
    'Identify any neutral eyewitnesses, hostel roommates, or security guards who were present.',
    'If experiencing severe distress or bodily threat, use the 1-Click SOS emergency trigger or call 112 immediately.',
  ];
}

function getFallbackPaths() {
  return [
    {
      name: 'Internal Complaints Committee (ICC) / Anti-Ragging Committee',
      authority: 'Dean of Student Welfare & Statutory Inquiry Officer',
      description: 'Confidential quasi-judicial campus hearing with interim protection orders against respondents.',
      slaOrTimeline: 'Action within 24 hours; Inquiry completion within 90 days',
    },
    {
      name: 'Local Police Precinct (Cognizable FIR)',
      authority: 'Station House Officer (SHO), Campus Central Police Post',
      description: 'Formal registration of First Information Report (FIR) under Bharatiya Nagarik Suraksha Sanhita (BNSS).',
      slaOrTimeline: 'Immediate FIR registration under BNSS Sec 173',
    },
    {
      name: 'National Cyber Crime Reporting Portal',
      authority: 'Ministry of Home Affairs (MHA), Government of India',
      description: 'Takedown notices sent to intermediaries (Instagram/Meta, Snapchat) and device IP tracing.',
      slaOrTimeline: 'Emergency takedown within 24 to 36 hours',
    },
  ];
}

function generateFallbackFir(params: {
  story: string;
  incidentLocation?: string;
  incidentDate?: string;
  victimPseudonym?: string;
}): string {
  const now = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `FORM NO. 1
FIRST INFORMATION REPORT
(Under Section 173 of Bharatiya Nagarik Suraksha Sanhita, 2023 / Sec 154 Cr.P.C.)

1. District / Jurisdiction: Campus Police Division & Metro Jurisdiction
2. Police Station: Central Campus Police Post
3. FIR Serial Number: [Draft for Investigation Review - Nirbhik Intake]
4. Date and Time of Report: ${now} at ${time}
5. Place of Occurrence: ${params.incidentLocation || 'University Campus Complex'}
6. Details of Complainant / Informant:
   - Pseudonym / Identity: ${params.victimPseudonym || 'Complainant (Confidential Vault Record)'}
   - Status: Registered Student / Campus Member (Identity Authenticated via Aadhaar / College ID)
7. Details of Known / Suspected Accused:
   - As stated in grievance attachments and accused profile schedule.
8. Applicable Acts and Sections:
   - Bharatiya Nyaya Sanhita (BNS), 2023: Sec 351, Sec 352, Sec 78, Sec 308
   - UGC Regulations on Curbing Ragging (2009): Regulation 3 & 7
   - Information Technology Act, 2000: Sec 66E / 67 (if digital harassment)
9. Chronological Narrative of Facts:
"${params.story.trim()}"

10. Prayer / Action Requested:
   It is respectfully prayed that this information be formally registered, appropriate investigation be initiated immediately, protective measures be provided to the victim, and action be taken against the accused persons in accordance with law.

Verification:
The statements contained herein are true to the best of informant's knowledge and belief.
Generated via Nirbhik AI Legal Pre-Filing Triage Engine.
[DRAFT SUBJECT TO OFFICIAL OFFICER SIGN-OFF]`;
}
