import { useState, useEffect } from 'react';
import { 
  Send, 
  MessageSquare, 
  StickyNote, 
  RefreshCw, 
  X, 
  Sparkles, 
  SlidersHorizontal, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Database,
  ShieldCheck,
  FileCheck,
  Scale,
  Users,
  FileText,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CaseDetailModalProps {
  caseId: string;
  onClose: () => void;
  onCaseUpdated: () => void;
}

export default function CaseDetailModal({ caseId, onClose, onCaseUpdated }: CaseDetailModalProps) {
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'CORRELATIONS' | 'ACTION_TAKEN' | 'CHAT' | 'NOTES'>('DETAILS');

  // Transition / Action states
  const [actionReason, setActionReason] = useState('');
  const [pendingTargetStatus, setPendingTargetStatus] = useState<string | null>(null);

  // Phase 5: Central DB Correlations (AI-Assisted & Human-in-the-Loop Sign-Off)
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loadingCorrelations, setLoadingCorrelations] = useState(false);
  const [selectedSignOffCase, setSelectedSignOffCase] = useState<any | null>(null);
  const [officerBadge, setOfficerBadge] = useState('');
  const [officerSignOffNotes, setOfficerSignOffNotes] = useState('');
  const [submittingSignOff, setSubmittingSignOff] = useState(false);

  // Phase 5: Supervisor Approval & QC Workflow
  const [showSubmitApprovalModal, setShowSubmitApprovalModal] = useState(false);
  const [proposedAction, setProposedAction] = useState('');
  const [proposedDecision, setProposedDecision] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [showSupervisorDecideModal, setShowSupervisorDecideModal] = useState(false);
  const [supervisorDecision, setSupervisorDecision] = useState<'APPROVE' | 'REQUEST_REVISION'>('APPROVE');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [submittingSupervisorDecision, setSubmittingSupervisorDecision] = useState(false);

  // Phase 5: Official Action Taken & Proof of Action
  const [showActionTakenModal, setShowActionTakenModal] = useState(false);
  const [actionTakenText, setActionTakenText] = useState('');
  const [proofFileKey, setProofFileKey] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [submittingActionTaken, setSubmittingActionTaken] = useState(false);

  // Outcome modal
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [outcome, setOutcome] = useState('VALID');
  const [outcomeReason, setOutcomeReason] = useState('');

  // AI Override modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overridePriority, setOverridePriority] = useState('HIGH');
  const [overrideCategoryId, setOverrideCategoryId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Note composer
  const [noteBody, setNoteBody] = useState('');

  // Chat composer
  const [chatBody, setChatBody] = useState('');
  const [requestInfo, setRequestInfo] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  const fetchCorrelations = async () => {
    setLoadingCorrelations(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/correlations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCorrelations(data.correlations || []);
      }
    } finally {
      setLoadingCorrelations(false);
    }
  };

  const fetchDetails = async () => {
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCaseData(data.case);
        setMessages(data.case.messages || []);
        if (data.case) {
          setOverridePriority(data.case.priority || 'MEDIUM');
          setOverrideCategoryId(data.case.categoryId || '');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/complaints/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchCategories();

    // Setup SSE stream for live case chat
    const eventSource = new EventSource(`/api/admin/cases/${caseId}/messages/stream`);

    eventSource.addEventListener('message', (e) => {
      try {
        const newMsg = JSON.parse(e.data);
        setMessages((prev) => [...prev, newMsg]);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('status_change', (e) => {
      try {
        const data = JSON.parse(e.data);
        setCaseData((prev: any) => (prev ? { ...prev, status: data.status } : prev));
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [caseId]);

  const handleOverrideAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;
    setOverrideSubmitting(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/override-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priority: overridePriority,
          categoryId: overrideCategoryId || undefined,
          reason: overrideReason,
        }),
      });

      if (res.ok) {
        setOverrideModalOpen(false);
        setOverrideReason('');
        fetchDetails();
        onCaseUpdated();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Override failed.');
      }
    } catch {
      alert('Network error while applying override.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string, reason?: string) => {
    const token = localStorage.getItem('cv_token');
    const res = await fetch(`/api/admin/cases/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: targetStatus,
        reason: reason || actionReason,
      }),
    });

    if (res.ok) {
      setPendingTargetStatus(null);
      setActionReason('');
      fetchDetails();
      onCaseUpdated();
    } else {
      const data = await res.json();
      alert(data.error?.message || 'Transition failed.');
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;

    const token = localStorage.getItem('cv_token');
    const res = await fetch(`/api/admin/cases/${caseId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body: noteBody }),
    });

    if (res.ok) {
      setNoteBody('');
      fetchDetails();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatBody.trim()) return;

    const token = localStorage.getItem('cv_token');
    const res = await fetch(`/api/admin/cases/${caseId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body: chatBody, requestInfo }),
    });

    if (res.ok) {
      setChatBody('');
      setRequestInfo(false);
      fetchDetails();
      onCaseUpdated();
    }
  };

  const handleRecordOutcome = async () => {
    const token = localStorage.getItem('cv_token');
    const res = await fetch(`/api/admin/cases/${caseId}/outcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ outcome, outcomeReason }),
    });

    if (res.ok) {
      setOutcomeModalOpen(false);
      fetchDetails();
      onCaseUpdated();
    } else {
      const data = await res.json();
      alert(data.error?.message || 'Outcome recording failed.');
    }
  };

  const handleSignOffCorrelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSignOffCase || !officerBadge.trim() || !officerSignOffNotes.trim()) return;
    setSubmittingSignOff(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/correlations/sign-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetCaseId: selectedSignOffCase.id,
          officerBadge: officerBadge.trim(),
          officerNotes: officerSignOffNotes.trim(),
        }),
      });
      if (res.ok) {
        alert('Official Human-in-the-Loop Officer Sign-Off recorded. Cases formally linked.');
        setSelectedSignOffCase(null);
        setOfficerBadge('');
        setOfficerSignOffNotes('');
        fetchDetails();
        fetchCorrelations();
        onCaseUpdated();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Sign-off failed.');
      }
    } finally {
      setSubmittingSignOff(false);
    }
  };

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedAction.trim() || !proposedDecision.trim()) return;
    setSubmittingApproval(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/submit-for-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposedAction: proposedAction.trim(),
          proposedDecision: proposedDecision.trim(),
        }),
      });
      if (res.ok) {
        setShowSubmitApprovalModal(false);
        setProposedAction('');
        setProposedDecision('');
        fetchDetails();
        onCaseUpdated();
        alert('Proposed decision submitted to Superior Officer for Legal Validation.');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Submission failed.');
      }
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleSupervisorDecide = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSupervisorDecision(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/supervisor-decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decision: supervisorDecision,
          supervisorNotes: supervisorNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowSupervisorDecideModal(false);
        setSupervisorNotes('');
        fetchDetails();
        onCaseUpdated();
        alert(`Supervisor decision '${supervisorDecision}' registered.`);
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Supervisor decision failed.');
      }
    } finally {
      setSubmittingSupervisorDecision(false);
    }
  };

  const handleRecordActionTaken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTakenText.trim()) return;
    setSubmittingActionTaken(true);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch(`/api/admin/cases/${caseId}/action-taken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actionTaken: actionTakenText.trim(),
          proofFileKey: proofFileKey.trim() || undefined,
          resolutionSummary: resolutionSummary.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowActionTakenModal(false);
        setActionTakenText('');
        setProofFileKey('');
        setResolutionSummary('');
        fetchDetails();
        onCaseUpdated();
        alert('Official Action Taken recorded and published to victim dashboard.');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to record action taken.');
      }
    } finally {
      setSubmittingActionTaken(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-700" />
          <span className="font-semibold text-sm">Loading case dossier...</span>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              {caseData.status}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-500">
              {caseData.pseudonym}
            </span>
            <span className="text-xs text-slate-400">• {caseData.category.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex gap-4 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'DETAILS'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Case Dossier & Triage
          </button>
          <button
            onClick={() => {
              setActiveTab('CORRELATIONS');
              if (correlations.length === 0) fetchCorrelations();
            }}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'CORRELATIONS'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Central DB Correlations ({correlations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ACTION_TAKEN')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ACTION_TAKEN'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Action Taken & Supervisor QC</span>
          </button>
          <button
            onClick={() => setActiveTab('CHAT')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'CHAT'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Anonymous Two-Way Chat ({messages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('NOTES')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'NOTES'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Internal Notes ({(caseData.notes || []).length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'DETAILS' && (
            <div className="space-y-6">
              {/* Active Risk Alerts Banner */}
              {caseData.riskAlerts && caseData.riskAlerts.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Active System Risk Alerts ({caseData.riskAlerts.length})</span>
                  </div>
                  {caseData.riskAlerts.map((alert: any) => (
                    <div key={alert.id} className="text-xs text-rose-900 bg-white/90 p-3 rounded-xl border border-rose-200 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                          {alert.type} • {alert.status}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-medium text-slate-800">{alert.message}</p>
                      {alert.recommendedActions && Array.isArray(alert.recommendedActions) && alert.recommendedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {alert.recommendedActions.map((act: string, idx: number) => (
                            <span key={idx} className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                              • {act}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Title & Description */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">{caseData.title}</h2>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {caseData.description}
                </div>
              </div>

              {/* Phase 5 Review: FIR Draft & Accused Information */}
              {(() => {
                const submittedEvent = (caseData.events || []).find((e: any) => e.type === 'SUBMITTED');
                const accusedList = submittedEvent?.payload?.accusedList || [];
                const firDraft = submittedEvent?.payload?.firDraft;

                return (
                  <>
                    {firDraft && (
                      <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                          <FileText className="w-4 h-4 text-sky-400" />
                          <span>Formal First Information Report (FIR Draft) - Section 173 BNSS / 154 CrPC</span>
                        </div>
                        <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-300 max-h-48 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {firDraft}
                        </pre>
                      </div>
                    )}

                    {accusedList.length > 0 && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                          <Users className="w-4 h-4 text-sky-700" />
                          <span>Reported Accused & Associated Individuals ({accusedList.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {accusedList.map((acc: any, i: number) => (
                            <div key={i} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <strong className="text-slate-900 font-bold text-sm">{acc.name}</strong>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  acc.role === 'PRIMARY_ACCUSED' ? 'bg-rose-100 text-rose-800' :
                                  acc.role === 'ACCOMPLICE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {acc.role}
                                </span>
                              </div>
                              {acc.onlineHandles && (
                                <div className="text-[11px] text-sky-800 font-mono bg-sky-50 px-2 py-0.5 rounded">
                                  Handles: {acc.onlineHandles}
                                </div>
                              )}
                              {acc.image && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  Photo: {acc.image}
                                </div>
                              )}
                              {acc.proof && (
                                <p className="text-[11px] text-slate-600 italic border-l-2 border-slate-300 pl-2 mt-1">
                                  "{acc.proof}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* AI Intelligence & Screening Card (PRD §5 / ARCHITECTURE §7) */}
              {caseData.aiAnalyses && caseData.aiAnalyses.length > 0 ? (
                (() => {
                  const ai = caseData.aiAnalyses[0];
                  return (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-sky-50/50 to-slate-50 border border-sky-200/90 shadow-sm space-y-4">
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-900">AI Screening & Risk Intelligence</h3>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                {ai.model} • v{ai.promptVersion}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Automated severity screening with safety-floor overrides & spam heuristics
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {ai.overriddenBy && (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <SlidersHorizontal className="w-3 h-3 text-amber-700" /> Overridden by {ai.overriddenBy}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setOverrideModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-600" />
                            <span>Manual Admin Override</span>
                          </button>
                        </div>
                      </div>

                      {/* AI Summary */}
                      <div className="bg-white/90 rounded-xl p-3.5 border border-sky-100 space-y-1">
                        <div className="text-[10px] font-bold text-sky-900 uppercase tracking-wider">AI Executive Summary</div>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">{ai.summary}</p>
                      </div>

                      {/* 4-Metric Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Severity Meter */}
                        <div className="bg-white/90 p-3 rounded-xl border border-sky-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Severity Score</span>
                            <span className={`text-[10px] font-black ${
                              ai.severityScore >= 8 ? 'text-rose-600' :
                              ai.severityScore >= 5 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {ai.severityScore}/10
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                ai.severityScore >= 8 ? 'bg-rose-500' :
                                ai.severityScore >= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(10, ai.severityScore * 10))}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {ai.severityScore >= 8 ? 'Severe / Urgent' : ai.severityScore >= 5 ? 'Moderate' : 'Low Severity'}
                          </span>
                        </div>

                        {/* Priority Calculation */}
                        <div className="bg-white/90 p-3 rounded-xl border border-sky-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Priority</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              ai.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                              ai.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                              ai.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ai.priority}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            Active Case: <strong className="text-slate-700">{caseData.priority}</strong>
                          </span>
                        </div>

                        {/* Spam Probability */}
                        <div className="bg-white/90 p-3 rounded-xl border border-sky-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Spam Score</span>
                            <span className={`text-[10px] font-bold ${
                              ai.spamProbability >= 0.7 ? 'text-rose-600' :
                              ai.spamProbability >= 0.4 ? 'text-amber-600' : 'text-slate-600'
                            }`}>
                              {(ai.spamProbability * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                ai.spamProbability >= 0.7 ? 'bg-rose-500' :
                                ai.spamProbability >= 0.4 ? 'bg-amber-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, ai.spamProbability * 100))}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {ai.spamProbability >= 0.7 ? 'High Risk' : ai.spamProbability >= 0.4 ? 'Suspect Review' : 'Clean Report'}
                          </span>
                        </div>

                        {/* Suggested Dept / Category */}
                        <div className="bg-white/90 p-3 rounded-xl border border-sky-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggested Dept</div>
                          <div className="text-xs font-bold text-slate-800 truncate" title={ai.suggestedCategory}>
                            {ai.suggestedCategory}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            {ai.suggestedCategory.toLowerCase() === caseData.category.name.toLowerCase() ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Confirmed
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3" /> Diverges
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Anomaly & Urgency Flags */}
                      {Array.isArray(ai.anomalyFlags) && ai.anomalyFlags.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Detected Urgency Signals & Heuristic Indicators:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ai.anomalyFlags.map((flag: string, idx: number) => {
                              const isDanger = flag.includes('IMMINENT') || flag.includes('WEAPONS') || flag.includes('VIOLENCE');
                              const isSpam = flag.includes('SPAM') || flag.includes('BURST') || flag.includes('REPETITIVE');
                              return (
                                <span
                                  key={idx}
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                    isDanger
                                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                                      : isSpam
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-sky-100 text-sky-900 border-sky-200'
                                  }`}
                                >
                                  {isDanger && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                  {flag}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* AI Reasoning */}
                      {ai.reasoning && (
                        <div className="p-3 bg-white/70 rounded-xl border border-sky-100 text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-bold text-slate-800 block mb-0.5">AI Classification Rationale:</span>
                          <p className="whitespace-pre-wrap">{ai.reasoning}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span>AI screening is pending or not generated for this case.</span>
                </div>
              )}

              {/* State Machine Transition Bar (WORKFLOW.md §4) */}
              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-900 block mb-3">
                  Workflow Lifecycle Controls
                </span>
                <div className="flex flex-wrap gap-2">
                  {caseData.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleStatusTransition('TRIAGED')}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold"
                    >
                      Accept into Triage
                    </button>
                  )}
                  {(caseData.status === 'TRIAGED' || caseData.status === 'ASSIGNED') && (
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      Start Investigation (IN_PROGRESS)
                    </button>
                  )}
                  {caseData.status === 'IN_PROGRESS' && (
                    <>
                      <button
                        onClick={() => {
                          setPendingTargetStatus('NEEDS_INFO');
                          setActionReason('Awaiting student clarification');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                      >
                        Request More Information
                      </button>
                      <button
                        onClick={() => setPendingTargetStatus('ESCALATED')}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                      >
                        Escalate Case
                      </button>
                      <button
                        onClick={() => setShowSubmitApprovalModal(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold shadow-sm"
                      >
                        Submit to Supervisor (QC)
                      </button>
                      <button
                        onClick={() => setPendingTargetStatus('RESOLVED')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      >
                        Mark Resolved
                      </button>
                    </>
                  )}
                  {caseData.status === 'FLAGGED_REVIEW' && (
                    <button
                      onClick={() => setShowSupervisorDecideModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-800 hover:bg-indigo-900 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Supervisor QC Review & Decision</span>
                    </button>
                  )}
                  {caseData.status === 'NEEDS_INFO' && (
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold"
                    >
                      Resume Investigation
                    </button>
                  )}

                  <button
                    onClick={() => setShowActionTakenModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                  >
                    Record Action Taken & Proof
                  </button>

                  <button
                    onClick={() => setOutcomeModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold ml-auto"
                  >
                    Record Outcome & Score
                  </button>
                </div>

                {/* Reason modal if transition requires reason */}
                {pendingTargetStatus && (
                  <div className="mt-4 p-4 rounded-xl bg-white border border-slate-300 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Mandatory Reason for Transition to {pendingTargetStatus}:
                    </span>
                    <input
                      type="text"
                      required
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="State justification (e.g. Electrical maintenance crew replaced breaker)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusTransition(pendingTargetStatus)}
                        className="px-3 py-1 bg-sky-700 text-white text-xs font-bold rounded-lg"
                      >
                        Confirm Transition
                      </button>
                      <button
                        onClick={() => setPendingTargetStatus(null)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase 5: Central DB Correlations Tab */}
          {activeTab === 'CORRELATIONS' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-950 uppercase tracking-wider">
                    <Database className="w-4 h-4 text-sky-700" />
                    <span>Central DB Correlation Engine (AI-Assisted)</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Scans all active and historical cases for matching accused identities, social handles, and location patterns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchCorrelations}
                  disabled={loadingCorrelations}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCorrelations ? 'animate-spin' : ''}`} />
                  <span>Scan Central DB</span>
                </button>
              </div>

              {/* Human-in-the-Loop Safeguard Notice */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Human-in-the-Loop Safeguard Mandate:</strong> The AI acts strictly as an advisory matching recommendation engine. Explicit <strong>Officer Sign-Off with Official Badge Number</strong> is strictly required before formally linking distinct case dossiers together.
                </div>
              </div>

              {loadingCorrelations ? (
                <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-700" />
                  <span>Querying Central DB correlations and cross-referencing accused records...</span>
                </div>
              ) : correlations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  No matching accused records or correlated case patterns detected across the central database.
                </div>
              ) : (
                <div className="space-y-4">
                  {correlations.map((corr) => (
                    <div key={corr.caseId} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{corr.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {corr.pseudonym}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                            {corr.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            corr.confidence >= 0.8 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Match Confidence: {(corr.confidence * 100).toFixed(0)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSignOffCase({ id: corr.caseId, title: corr.title })}
                            className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Officer Sign-Off to Link</span>
                          </button>
                        </div>
                      </div>

                      {/* Match Reasons */}
                      {corr.matchReasons && (
                        <div className="flex flex-wrap gap-1.5">
                          {corr.matchReasons.map((reason: string, rIdx: number) => (
                            <span key={rIdx} className="text-[10px] font-semibold bg-sky-50 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200">
                              ✓ {reason}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Correlated Accused Profiles */}
                      {corr.accusedList && corr.accusedList.length > 0 && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Correlated Accused Profiles from Linked Case:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {corr.accusedList.map((acc: any, aIdx: number) => (
                              <div key={aIdx} className="bg-white p-2 rounded-lg border border-slate-200">
                                <div className="font-bold text-slate-800">{acc.name} ({acc.role})</div>
                                {acc.onlineHandles && (
                                  <div className="text-[11px] text-slate-500 font-mono">Handles: {acc.onlineHandles}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Phase 5: Action Taken & Supervisor QC Tab */}
          {activeTab === 'ACTION_TAKEN' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-sky-700" />
                    <span>Superior Officer Quality Control Gate</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    caseData.status === 'FLAGGED_REVIEW' ? 'bg-amber-100 text-amber-800' :
                    caseData.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {caseData.status === 'FLAGGED_REVIEW' ? 'Pending Supervisor Approval' : caseData.status === 'RESOLVED' ? 'Legally Concluded' : 'Investigation Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Before finalizing the investigation or issuing public written documents, the proposed decision must be reviewed and legally validated by a Superior Officer.
                </p>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                  {caseData.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => setShowSubmitApprovalModal(true)}
                      className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Proposal to Superior Officer</span>
                    </button>
                  )}

                  {(caseData.status === 'FLAGGED_REVIEW' || user?.role === 'SUPER_ADMIN') && (
                    <button
                      type="button"
                      onClick={() => setShowSupervisorDecideModal(true)}
                      className="px-4 py-2 bg-indigo-800 hover:bg-indigo-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Superior Officer Review (Approve / Revise)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowActionTakenModal(true)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm ml-auto"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Record Official Action Taken & Upload Proof</span>
                  </button>
                </div>
              </div>

              {/* Action Taken Audit Events History */}
              {(() => {
                const actionEv = (caseData.events || []).find((e: any) => e.type === 'ACTION_TAKEN_RECORDED');
                if (!actionEv) return null;
                const p = actionEv.payload || {};
                return (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <strong className="text-emerald-950 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Certified Action Taken Record
                      </strong>
                      <span className="text-[10px] text-slate-400">{new Date(actionEv.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-emerald-200">
                      {p.actionTaken}
                    </p>
                    {p.proofFileKey && (
                      <div className="text-xs text-emerald-900 flex items-center gap-2">
                        <span className="font-semibold">Uploaded Proof of Action:</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">{p.proofFileKey}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'CHAT' && (
            <div className="flex flex-col h-[420px]">
              {/* Message History */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    No messages exchanged yet. Complainant will see your replies as "Admin Office".
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAdmin = m.sender === 'ADMIN';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isAdmin
                              ? 'bg-sky-700 text-white rounded-br-none'
                              : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                          }`}
                        >
                          <span className="block font-bold text-[10px] mb-1 opacity-80">
                            {isAdmin ? 'Admin Office' : caseData.pseudonym}
                          </span>
                          {m.body}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Composer */}
              <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-info"
                    checked={requestInfo}
                    onChange={(e) => setRequestInfo(e.target.checked)}
                    className="accent-sky-700"
                  />
                  <label htmlFor="req-info" className="text-xs text-slate-600 font-medium">
                    Mark as Request Clarification (Auto-toggles case to NEEDS_INFO)
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={chatBody}
                    onChange={(e) => setChatBody(e.target.value)}
                    placeholder="Write a message to complainant (identity is shielded)..."
                    className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveNote} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Add Internal Staff Note</label>
                <textarea
                  rows={3}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Record internal committee discussion, phone inquiries, or investigative observations. Never visible to complainant."
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                >
                  Save Internal Note
                </button>
              </form>

              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Staff Notes History</span>
                {(caseData.notes || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No internal notes added yet.</p>
                ) : (
                  caseData.notes.map((n: any) => (
                    <div key={n.id} className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
                      <div className="flex justify-between items-center text-slate-500 mb-1">
                        <strong className="text-slate-800">Staff Note by {n.admin?.username || 'Staff'}</strong>
                        <span className="text-[10px]">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Outcome Modal Overlay */}
        {outcomeModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Record Case Outcome</h3>
              <p className="text-xs text-slate-500">
                Outcomes adjust trust scores via the isolated vault. 'MALICIOUS' outcome strictly requires Super Admin.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="VALID">VALID (+4 Trust)</option>
                  <option value="PARTIAL">PARTIAL (+2 Trust)</option>
                  <option value="DUPLICATE">DUPLICATE (+1 Trust)</option>
                  <option value="UNVERIFIABLE">UNVERIFIABLE (0 Trust)</option>
                  <option value="SPAM">SPAM (-10 Trust)</option>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <option value="MALICIOUS">MALICIOUS (-20 Trust • Super Admin)</option>
                  ) : (
                    <option value="MALICIOUS" disabled>
                      MALICIOUS (Requires Super Admin)
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rationale</label>
                <textarea
                  rows={3}
                  value={outcomeReason}
                  onChange={(e) => setOutcomeReason(e.target.value)}
                  placeholder="Document findings and justification for this outcome."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRecordOutcome}
                  disabled={outcomeReason.length < 5}
                  className="flex-1 py-2.5 bg-sky-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  Confirm Outcome
                </button>
                <button
                  onClick={() => setOutcomeModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual AI Override Modal Overlay (ADM-4) */}
        {overrideModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                  <span>Manual Admin Override</span>
                </div>
                <button
                  onClick={() => setOverrideModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Staff admins retain final decision authority over AI suggestions. All adjustments and justifications are recorded in the audit log.
              </p>

              <form onSubmit={handleOverrideAnalysis} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Priority</label>
                  <select
                    value={overridePriority}
                    onChange={(e) => setOverridePriority(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-sky-600 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL (Emergency / Immediate Action)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Re-assign Category / Routing</label>
                  <select
                    value={overrideCategoryId}
                    onChange={(e) => setOverrideCategoryId(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-sky-600 focus:outline-none"
                  >
                    <option value="">Keep Current Category ({caseData.category?.name})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Override Justification <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document factual justification (e.g., student brought physical evidence to security desk)..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-600 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={overrideSubmitting || overrideReason.trim().length < 5}
                    className="flex-1 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {overrideSubmitting ? 'Saving Override...' : 'Apply Admin Override'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DIALOG 1: Human-in-the-Loop Officer Sign-Off Dialog */}
        {selectedSignOffCase && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Officer Sign-Off (Case Linkage)</span>
                </div>
                <button onClick={() => setSelectedSignOffCase(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950">
                You are explicitly affirming that <strong>{selectedSignOffCase.title}</strong> is correlated to this case by verified common actors, modus operandi, or corroborating physical/electronic proof.
              </div>

              <form onSubmit={handleSignOffCorrelation} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Officer Badge / ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={officerBadge}
                    onChange={(e) => setOfficerBadge(e.target.value)}
                    placeholder="e.g. POL-KA-4491 or SEC-OFFICER-07"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Investigative Corroboration Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={officerSignOffNotes}
                    onChange={(e) => setOfficerSignOffNotes(e.target.value)}
                    placeholder="Document basis for linking: e.g. same Instagram burner handle identified across both victim complaints..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingSignOff || !officerBadge.trim() || !officerSignOffNotes.trim()}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    {submittingSignOff ? 'Recording Sign-Off...' : 'Confirm Explicit Officer Sign-Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSignOffCase(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DIALOG 2: Submit for Supervisor Approval */}
        {showSubmitApprovalModal && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Submit Proposed Resolution to Supervisor</span>
                </div>
                <button onClick={() => setShowSubmitApprovalModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Submits the case findings and proposed disciplinary/legal action for superior review. The case state transitions to <strong>FLAGGED_REVIEW</strong>.
              </p>

              <form onSubmit={handleSubmitForApproval} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Proposed Redressal / Disciplinary Action <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={proposedAction}
                    onChange={(e) => setProposedAction(e.target.value)}
                    placeholder="e.g. Issue formal warning, institute anti-ragging squad hearing, suspension from hostel..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recommended Case Disposition / Legal Finding <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={proposedDecision}
                    onChange={(e) => setProposedDecision(e.target.value)}
                    placeholder="e.g. Substantiated breach under UGC Anti-Ragging Regulation 6.1"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingApproval || !proposedAction.trim() || !proposedDecision.trim()}
                    className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    {submittingApproval ? 'Submitting...' : 'Submit to Supervisor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSubmitApprovalModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DIALOG 3: Supervisor QC Decision */}
        {showSupervisorDecideModal && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  <span>Superior Officer Legal & QC Decision</span>
                </div>
                <button onClick={() => setShowSupervisorDecideModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSupervisorDecide} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supervisor Decision</label>
                  <select
                    value={supervisorDecision}
                    onChange={(e) => setSupervisorDecision(e.target.value as any)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="APPROVE">APPROVE Resolution (Case marked RESOLVED)</option>
                    <option value="REQUEST_REVISION">REQUEST REVISION (Returned to IN_PROGRESS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quality Control & Legal Validation Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={supervisorNotes}
                    onChange={(e) => setSupervisorNotes(e.target.value)}
                    placeholder="Validate that due process, witness testimonies, and statutory protections were satisfied..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingSupervisorDecision}
                    className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    {submittingSupervisorDecision ? 'Recording Decision...' : 'Record Supervisor Decision'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSupervisorDecideModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DIALOG 4: Record Official Action Taken & Upload Proof */}
        {showActionTakenModal && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Record Official Action Taken & Proof</span>
                </div>
                <button onClick={() => setShowActionTakenModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Finalizes and publishes the official Action Taken Report (ATR) visible on the victim's tracking portal. Marks the case as <strong>RESOLVED</strong>.
              </p>

              <form onSubmit={handleRecordActionTaken} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Action Taken by Authority / Police <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={actionTakenText}
                    onChange={(e) => setActionTakenText(e.target.value)}
                    placeholder="Specify sanctions, police referral, committee orders, counseling mandates..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proof File Key / Certified Document Reference <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={proofFileKey}
                    onChange={(e) => setProofFileKey(e.target.value)}
                    placeholder="evidence/disciplinary-order-signed-2026.pdf"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Victim Resolution & Redressal Summary <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    placeholder="Summary visible to complainant confirming safety arrangements or institutional support..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingActionTaken || !actionTakenText.trim()}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    {submittingActionTaken ? 'Publishing ATR...' : 'Publish Official Action Taken'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActionTakenModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
