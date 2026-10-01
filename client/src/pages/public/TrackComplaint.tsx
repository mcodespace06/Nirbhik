import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Shield, 
  Clock, 
  MapPin, 
  Tag, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Calendar,
  MessageSquare,
  Send,
  Lock,
  Info,
  Download,
  CheckCircle2,
  Scale,
  PlusCircle,
  History,
  X
} from 'lucide-react';

interface EventItem {
  id: string;
  type: string;
  actorRole: string | null;
  payload: any;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  senderType: 'STAFF' | 'COMPLAINANT';
  senderRole?: string | null;
  content: string;
  requestInfo: boolean;
  createdAt: string;
}

interface ComplaintDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  pseudonym: string;
  incidentAt: string;
  mode: string;
  createdAt: string;
  resolvedAt?: string | null;
  category: { name: string };
  location: { name: string };
  attachments?: Array<{ id: string; fileKey: string; mime: string; size: number }>;
}

interface TrackComplaintProps {
  initialKey?: string;
  onBack: () => void;
}

const STATUS_STEPS = ['SUBMITTED', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED'];

export default function TrackComplaint({ initialKey = '', onBack }: TrackComplaintProps) {
  const [keyInput, setKeyInput] = useState(initialKey);
  const [complaint, setComplaint] = useState<ComplaintDetails | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CHAT'>('OVERVIEW');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Phase 4: Mid-Investigation Amendment (Append-Only Log)
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentContent, setAmendmentContent] = useState('');
  const [amendmentFileKey, setAmendmentFileKey] = useState('');
  const [submittingAmendment, setSubmittingAmendment] = useState(false);

  // Phase 4: Formal Escalation / Appeal
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [desiredRelief, setDesiredRelief] = useState('');
  const [submittingEscalate, setSubmittingEscalate] = useState(false);

  // Phase 4: Reactivate Case
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateReason, setReactivateReason] = useState('');
  const [newEvidenceText, setNewEvidenceText] = useState('');
  const [submittingReactivate, setSubmittingReactivate] = useState(false);

  // Phase 4: Case Dossier Export
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierData, setDossierData] = useState<any | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  const fetchCase = async (searchKey: string) => {
    if (!searchKey) return;
    setError(null);
    setLoading(true);

    try {
      const cleanKey = searchKey.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Complaint not found. Verify the tracking key.');
      }

      setComplaint(data.complaint);

      // Fetch timeline events
      const eventsRes = await fetch(`/api/track/${cleanKey}/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }

      // Fetch initial chat messages
      const msgsRes = await fetch(`/api/track/${cleanKey}/messages`);
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        setMessages(msgsData.messages || []);
      }
    } catch (err: any) {
      setError(err.message);
      setComplaint(null);
      setEvents([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendmentContent.trim() || !keyInput) return;
    setSubmittingAmendment(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: amendmentContent.trim(),
          attachments: amendmentFileKey.trim()
            ? [{ fileKey: amendmentFileKey.trim(), mime: 'application/octet-stream', size: 1024 }]
            : undefined,
        }),
      });
      if (res.ok) {
        setAmendmentContent('');
        setAmendmentFileKey('');
        setShowAmendmentModal(false);
        fetchCase(cleanKey);
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to append amendment.');
      }
    } finally {
      setSubmittingAmendment(false);
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim() || !keyInput) return;
    setSubmittingEscalate(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appealReason: escalateReason.trim(),
          desiredRelief: desiredRelief.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowEscalateModal(false);
        setEscalateReason('');
        setDesiredRelief('');
        fetchCase(cleanKey);
        alert('Formal Escalation/Appeal submitted for Higher-Level Authority Review.');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to file appeal.');
      }
    } finally {
      setSubmittingEscalate(false);
    }
  };

  const handleReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateReason.trim() || !keyInput) return;
    setSubmittingReactivate(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reactivationReason: reactivateReason.trim(),
          newEvidence: newEvidenceText.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowReactivateModal(false);
        setReactivateReason('');
        setNewEvidenceText('');
        fetchCase(cleanKey);
        alert('Case successfully reactivated with new evidence.');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to reactivate case.');
      }
    } finally {
      setSubmittingReactivate(false);
    }
  };

  const handleExportDossier = async () => {
    if (!keyInput) return;
    setLoadingDossier(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/dossier`);
      if (res.ok) {
        const data = await res.json();
        setDossierData(data.dossier);
        setShowDossierModal(true);
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to load case dossier.');
      }
    } finally {
      setLoadingDossier(false);
    }
  };

  useEffect(() => {
    if (initialKey) {
      fetchCase(initialKey);
    }
  }, [initialKey]);

  // Setup SSE stream for chat when complaint is loaded
  useEffect(() => {
    if (!complaint || !keyInput) return;
    const cleanKey = keyInput.trim().toUpperCase();
    const eventSource = new EventSource(`/api/track/${cleanKey}/messages/stream`);

    eventSource.addEventListener('message', (e) => {
      try {
        const newMsg = JSON.parse(e.data);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('status_change', (e) => {
      try {
        const statusData = JSON.parse(e.data);
        setComplaint((prev) => (prev ? { ...prev, status: statusData.status } : prev));
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [complaint?.id, keyInput]);

  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCase(keyInput);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !keyInput) return;

    setSendingMessage(true);
    try {
      const cleanKey = keyInput.trim().toUpperCase();
      const res = await fetch(`/api/track/${cleanKey}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatInput.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setChatInput('');
        // If status was NEEDS_INFO, update to IN_PROGRESS locally
        if (complaint && complaint.status === 'NEEDS_INFO') {
          setComplaint({ ...complaint, status: 'IN_PROGRESS' });
        }
      }
    } catch {
      // ignore
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'IN_PROGRESS':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'NEEDS_INFO':
        return 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse';
      case 'TRIAGED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FLAGGED_REVIEW':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </button>

      {/* Tracker Search Box */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 mb-8">
        <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-2">
          <Search className="w-4 h-4" />
          <span>Case Lookup by Tracking Key</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">Track Complaint</h1>
        <p className="text-xs sm:text-sm text-slate-500 mb-6">
          Enter your <code>CV-YYMM-XXXX-XXXX</code> key to check case progress, status changes, and communicate with investigators anonymously.
        </p>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
            placeholder="CV-2610-A1B2-C3D4"
            className="flex-1 px-4 py-3 text-base font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent tracking-wider uppercase font-semibold"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Lookup Case</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Case Details View */}
      {complaint && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Action Needed Banner if NEEDS_INFO */}
          {complaint.status === 'NEEDS_INFO' && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start gap-3 shadow-sm">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-sm text-amber-950 mb-0.5">Additional Information Requested</div>
                <p className="text-amber-800 leading-relaxed mb-2">
                  The case handler has asked clarifying questions. Check the <strong>Anonymous Chat</strong> tab below to reply. Replying will automatically transition the status to <strong>In Progress</strong>.
                </p>
                <button
                  onClick={() => setActiveTab('CHAT')}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Open Anonymous Chat
                </button>
              </div>
            </div>
          )}

          {/* Main Case Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(complaint.status)}`}>
                    Status: {complaint.status}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    Priority: {complaint.priority}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 text-xs font-semibold">
                    Mode: {complaint.mode}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{complaint.title}</h2>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 block">Pseudonym</span>
                <span className="text-sm font-bold text-sky-700 font-mono">{complaint.pseudonym}</span>
              </div>
            </div>

            {/* Stepper Bar */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">Lifecycle Progress</span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {STATUS_STEPS.map((step, idx) => {
                  const currentIdx = STATUS_STEPS.indexOf(complaint.status);
                  const isDone = currentIdx >= idx;
                  const isCurrent = complaint.status === step;
                  return (
                    <div key={step} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full transition-colors ${
                          isDone ? 'bg-sky-600' : 'bg-slate-200'
                        }`}
                      />
                      <span className={`block font-semibold ${isCurrent ? 'text-sky-700' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase 4: Mid-Investigation Update CTA (For active cases) */}
            {complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED' && complaint.status !== 'REJECTED' && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
                    <History className="w-4 h-4 text-sky-700" />
                    <span>Mid-Investigation Update (Append-Only Log)</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Have new facts or evidence emerged? You can append versioned updates (v1.1, v1.2) while keeping the original report unaltered.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Case Update</span>
                </button>
              </div>
            )}

            {/* Phase 4: Official Action Taken & Resolution Card (For resolved cases) */}
            {(complaint.status === 'RESOLVED' || events.some((e) => e.type === 'ACTION_TAKEN_RECORDED')) && (
              <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-4 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Official Police & Authority Action Taken</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                    Case Concluded
                  </span>
                </div>

                {(() => {
                  const actionEv = events.find((e) => e.type === 'ACTION_TAKEN_RECORDED');
                  const p = actionEv?.payload || {};
                  return (
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-emerald-900 block mb-0.5">Summary of Action Taken:</span>
                        <p className="text-slate-800 bg-white/90 p-3 rounded-xl border border-emerald-200 leading-relaxed font-medium">
                          {p.actionTaken || 'Investigation completed and certified disciplinary/legal action has been enforced.'}
                        </p>
                      </div>

                      {p.resolutionSummary && (
                        <div>
                          <span className="font-bold text-emerald-900 block mb-0.5">Institutional Resolution Notes:</span>
                          <p className="text-slate-700 bg-white/80 p-3 rounded-xl border border-emerald-100 leading-relaxed">
                            {p.resolutionSummary}
                          </p>
                        </div>
                      )}

                      {p.proofFileKey && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-slate-600 font-semibold">Proof of Action Taken:</span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-mono text-[11px] font-bold">
                            <Shield className="w-3.5 h-3.5 text-emerald-600" />
                            {p.proofFileKey}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Satisfaction & Escalation Panel */}
                <div className="pt-3 border-t border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <strong className="text-xs text-slate-800 block">Are you satisfied with this decision?</strong>
                    <span className="text-[11px] text-slate-500">
                      Download full certified audit documents or file a formal escalation for higher review.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportDossier}
                      disabled={loadingDossier}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      {loadingDossier ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export Case Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEscalateModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>File Formal Appeal / Escalate</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reactivate Case Button (For Closed/Resolved cases) */}
            {(complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' || complaint.status === 'REJECTED') && (
              <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">
                  Has new, critical evidence emerged after case resolution?
                </span>
                <button
                  type="button"
                  onClick={() => setShowReactivateModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Reactivate Case</span>
                </button>
              </div>
            )}

            {/* Navigation Tabs between Overview and Anonymous Chat */}
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'OVERVIEW'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Details & Timeline</span>
              </button>

              <button
                onClick={() => setActiveTab('CHAT')}
                className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'CHAT'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Secure Victim-Police Chat</span>
                {messages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                    {messages.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab 1: OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Metadata Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Category:</span>
                    <strong className="text-slate-900">{complaint.category.name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Location:</span>
                    <strong className="text-slate-900">{complaint.location.name}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Incident:</span>
                    <strong className="text-slate-900">{new Date(complaint.incidentAt).toLocaleDateString()}</strong>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-2">Original Reported Incident Narrative</span>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {complaint.description}
                  </div>
                </div>

                {/* Evidence Attachments */}
                {complaint.attachments && complaint.attachments.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-2">Submitted Evidence</span>
                    <div className="flex flex-wrap gap-2">
                      {complaint.attachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200"
                        >
                          <Shield className="w-3.5 h-3.5 text-sky-700" />
                          Sanitized File ({att.mime.split('/')[1] || 'doc'})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline Events Log */}
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-700" />
                    Audit Timeline & Append-Only Log
                  </h3>

                  {events.length === 0 ? (
                    <p className="text-xs text-slate-500">No events recorded yet.</p>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-5 pb-2">
                      {events.map((ev) => {
                        const isAmendment = ev.type === 'AMENDMENT_APPENDED';
                        const isActionTaken = ev.type === 'ACTION_TAKEN_RECORDED';
                        const isEscalation = ev.type === 'ESCALATION_SUBMITTED';
                        const isReactivation = ev.type === 'CASE_REACTIVATED';
                        const isSignOff = ev.type === 'OFFICER_SIGNOFF_LINKED';

                        return (
                          <div key={ev.id} className="relative pl-6">
                            <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 ${
                              isActionTaken ? 'bg-emerald-600 ring-emerald-100' :
                              isEscalation ? 'bg-amber-600 ring-amber-100' :
                              isAmendment ? 'bg-indigo-600 ring-indigo-100' :
                              'bg-sky-600 ring-sky-100'
                            }`} />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{ev.type}</span>
                                {isAmendment && ev.payload?.version && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                    Version {ev.payload.version}
                                  </span>
                                )}
                                {ev.actorRole && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                    By {ev.actorRole}
                                  </span>
                                )}
                              </div>

                              {/* Payload Specific Snippet */}
                              {isAmendment && ev.payload?.content && (
                                <div className="text-xs text-indigo-950 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200 font-medium">
                                  {ev.payload.content}
                                </div>
                              )}

                              {isActionTaken && ev.payload?.actionTaken && (
                                <div className="text-xs text-emerald-950 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-medium">
                                  {ev.payload.actionTaken}
                                </div>
                              )}

                              {isEscalation && ev.payload?.appealReason && (
                                <div className="text-xs text-amber-950 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                                  Appeal Ground: {ev.payload.appealReason}
                                </div>
                              )}

                              {isReactivation && ev.payload?.reactivationReason && (
                                <div className="text-xs text-orange-950 bg-orange-50 p-2.5 rounded-xl border border-orange-200 font-medium">
                                  Reactivation Reason: {ev.payload.reactivationReason}
                                </div>
                              )}

                              {isSignOff && ev.payload?.officerBadge && (
                                <div className="text-xs text-slate-800 bg-slate-100 p-2 rounded-lg border border-slate-200">
                                  Officer Sign-Off (Badge #{ev.payload.officerBadge}) - Linked Case #{ev.payload.targetCaseId}
                                </div>
                              )}

                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {new Date(ev.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: CHAT */}
            {activeTab === 'CHAT' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Legal Evidentiary Watermark Notice */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
                  <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Official Evidentiary Admissibility Notice:</strong> All victim-police messages in this channel are cryptographically timestamped and officially logged into the case evidence vault. Statements made here are legally admissible as formal case proceedings.
                  </div>
                </div>

                <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-100 flex items-center gap-2 text-xs text-sky-800">
                  <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>
                    Your chat is end-to-end pseudonymous. Handlers only see your pseudonym <strong>{complaint.pseudonym}</strong>.
                  </span>
                </div>

                {/* Message Scroll Container */}
                <div className="h-80 overflow-y-auto space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                      <div className="text-xs font-medium">No messages in this case yet.</div>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        If investigators require more evidence or clarify details, messages will appear here in real-time.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderType === 'COMPLAINANT';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              {isMe ? 'You (Complainant)' : `Staff Handler (${m.senderRole || 'Investigator'})`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                              isMe
                                ? 'bg-sky-700 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                            }`}
                          >
                            {m.requestInfo && (
                              <div className="mb-1 text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Information Requested
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Composer */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send an anonymous message or reply to investigator..."
                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !chatInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {sendingMessage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Mid-Investigation Amendment (Append-Only Log) */}
      {showAmendmentModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <History className="w-4 h-4 text-sky-600" />
                <span>Append Mid-Investigation Update</span>
              </div>
              <button onClick={() => setShowAmendmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              The original complaint is legally immutable. This update will be logged as an official append-only version (e.g., v1.1) in the audit timeline.
            </p>
            <form onSubmit={handleAddAmendment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Narrative / Clarification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={amendmentContent}
                  onChange={(e) => setAmendmentContent(e.target.value)}
                  placeholder="Detail the new facts, additional threats, or witness clarifications..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Evidence Reference / File Key <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={amendmentFileKey}
                  onChange={(e) => setAmendmentFileKey(e.target.value)}
                  placeholder="evidence/new-screenshot-02.png"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingAmendment || !amendmentContent.trim()}
                  className="flex-1 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {submittingAmendment ? 'Appending Log...' : 'Submit Versioned Amendment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Formal Escalation / Appeal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Scale className="w-4 h-4 text-amber-600" />
                <span>File Formal Appeal / Escalation</span>
              </div>
              <button onClick={() => setShowEscalateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              If you believe the police/committee decision was biased, incomplete, or procedurally flawed, this triggers a high-priority risk alert for Superior Officer review.
            </p>
            <form onSubmit={handleEscalate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Grounds for Appeal / Disagreement <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Explain why the current outcome is unsatisfactory and what was overlooked..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Desired Relief / Resolution Sought <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={desiredRelief}
                  onChange={(e) => setDesiredRelief(e.target.value)}
                  placeholder="e.g. Hosteller reassignment, police FIR filing, disciplinary rustication"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingEscalate || !escalateReason.trim()}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {submittingEscalate ? 'Submitting Appeal...' : 'Submit Formal Appeal'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reactivate Case */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <History className="w-4 h-4 text-orange-600" />
                <span>Reactivate Case with New Evidence</span>
              </div>
              <button onClick={() => setShowReactivateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Reopening a closed matter moves the lifecycle back to <strong>IN_PROGRESS</strong> and re-alerts the investigative supervisor.
            </p>
            <form onSubmit={handleReactivate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Reactivation <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="Why should this case be reopened? State any ongoing harassment or recurring incident..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description of New Critical Evidence <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newEvidenceText}
                  onChange={(e) => setNewEvidenceText(e.target.value)}
                  placeholder="New CCTV footage timestamp, audio recording, witness testimony..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingReactivate || !reactivateReason.trim()}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {submittingReactivate ? 'Reopening...' : 'Confirm Reactivation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReactivateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Full Case Dossier Export Modal */}
      {showDossierModal && dossierData && (
        <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wider mb-1">
                  <Shield className="w-4 h-4" />
                  <span>Certified Investigation Dossier Pack</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">{dossierData.title}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                  <span>Key: {keyInput}</span>
                  <span>• Pseudonym: {dossierData.pseudonym}</span>
                  <span>• Certified At: {new Date(dossierData.certifiedAt).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => setShowDossierModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Case Overview */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">Incident Summary</span>
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{dossierData.description}</p>
            </div>

            {/* AI Drafted FIR if present */}
            {dossierData.firDraft && (
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-sky-400 uppercase tracking-wider text-[10px] block">
                  Automated Structured FIR (BNSS §173 / CrPC §154)
                </span>
                <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto text-slate-300">
                  {dossierData.firDraft}
                </pre>
              </div>
            )}

            {/* Accused Roster */}
            {dossierData.accusedList && dossierData.accusedList.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block">
                  Identified Accused / Associated Entities ({dossierData.accusedList.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dossierData.accusedList.map((acc: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-slate-900 font-bold">{acc.name}</strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                          {acc.role}
                        </span>
                      </div>
                      {acc.onlineHandles && (
                        <div className="text-[11px] text-slate-500 truncate">Handles: {acc.onlineHandles}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amendments */}
            {dossierData.amendments && dossierData.amendments.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block">
                  Mid-Investigation Append-Only Log ({dossierData.amendments.length})
                </span>
                <div className="space-y-2">
                  {dossierData.amendments.map((am: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 text-xs">
                      <div className="flex justify-between items-center text-[10px] font-bold text-indigo-900 mb-1">
                        <span>Version {am.version}</span>
                        <span className="text-slate-400 font-normal">{new Date(am.appendedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-800">{am.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Taken Record */}
            {dossierData.actionTaken && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs space-y-1">
                <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px] block">
                  Official Redressal Action & Outcome
                </span>
                <p className="text-emerald-900 font-medium leading-relaxed">{dossierData.actionTaken.actionTaken}</p>
                {dossierData.actionTaken.proofFileKey && (
                  <div className="text-[11px] text-emerald-800 pt-1">
                    Proof Reference: <span className="font-mono font-bold">{dossierData.actionTaken.proofFileKey}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                Digitally authenticated by CampusVoice Cryptographic Vault
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
