import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  KeyRound,
  FileCheck,
  AlertOctagon,
  User,
  ShieldCheck,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  meta: any;
  createdAt: string;
  actor?: {
    username: string;
    role: string;
    collegeEmail: string;
    department?: string;
  };
}

interface BreakGlassItem {
  id: string;
  complaintId: string;
  requestedBy: string;
  reason: string;
  approverId?: string | null;
  status: string;
  createdAt: string;
  decidedAt?: string | null;
  complaint?: {
    id: string;
    title: string;
    mode: string;
    pseudonym: string;
    createdAt: string;
  };
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [reveals, setReveals] = useState<BreakGlassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'reveals'>('logs');

  // New reveal request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestComplaintId, setRequestComplaintId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Decision state
  const [revealedResult, setRevealedResult] = useState<any>(null);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const [logsRes, revealsRes] = await Promise.all([
        fetch(`/api/admin/audit-logs?limit=50${actionFilter ? `&action=${actionFilter}` : ''}`, { headers }),
        fetch('/api/admin/reveal', { headers }),
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.data || []);
      }
      if (revealsRes.ok) {
        const revealsData = await revealsRes.json();
        setReveals(revealsData.data || []);
      }
    } catch (err) {
      console.error('Failed to load audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [actionFilter]);

  const handleRequestReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestComplaintId.trim() || !requestReason.trim()) return;

    setRequestSubmitting(true);
    setRequestMessage(null);
    try {
      const res = await fetch('/api/admin/reveal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId: requestComplaintId.trim(),
          reason: requestReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to submit reveal request.');
      }

      setRequestMessage({ text: data.message, isError: false });
      setRequestComplaintId('');
      setRequestReason('');
      fetchAuditData();
      setTimeout(() => setShowRequestModal(false), 2000);
    } catch (err: any) {
      setRequestMessage({ text: err.message, isError: true });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleDecideReveal = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/admin/reveal/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || 'Failed to process decision.');
        return;
      }

      if (action === 'APPROVE' && data.revealedIdentity) {
        setRevealedResult(data.revealedIdentity);
      } else {
        alert(data.message);
      }
      fetchAuditData();
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.entity.toLowerCase().includes(query) ||
      log.actor?.username.toLowerCase().includes(query) ||
      log.actor?.collegeEmail.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Security Audit Trail & Break-Glass Vault
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Immutable compliance ledger recording all privileged administrator actions, status changes, and dual-authorized identity reveals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium transition"
          >
            <KeyRound className="w-4 h-4" />
            Request Break-Glass Reveal
          </button>

          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'logs'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Audit Ledger ({filteredLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('reveals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'reveals'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          Break-Glass Requests ({reveals.length})
        </button>
      </div>

      {activeTab === 'logs' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by action, actor, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Security Actions</option>
              <option value="ADMIN_LOGIN">Admin Logins</option>
              <option value="CASE_UPDATED">Case Status Changes</option>
              <option value="OUTCOME_DECIDED">Outcome Decisions</option>
              <option value="ROSTER_IMPORT">Roster Imports</option>
              <option value="IDENTITY_REVEAL_REQUESTED">Reveal Requests</option>
              <option value="IDENTITY_REVEAL_APPROVED">Reveal Approvals</option>
              <option value="RULE_CREATED">Rule Creations</option>
              <option value="RULE_UPDATED">Rule Updates</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/70 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details / Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-2" />
                        Loading immutable ledger entries...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        No audit log entries matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-200">
                              {log.actor?.username || 'System Worker'}
                            </span>
                            {log.actor?.role && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {log.actor.role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              log.action.includes('REVEAL')
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : log.action.includes('LOGIN')
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {log.entity}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate font-mono">
                          {JSON.stringify(log.meta)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Break-glass reveal requests */}
          <div className="grid grid-cols-1 gap-4">
            {reveals.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-300">Vault Integrity Secure</p>
                <p className="text-xs text-slate-500 mt-1">
                  Zero active or historical break-glass reveal attempts logged in this cycle.
                </p>
              </div>
            ) : (
              reveals.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-5 h-5 text-rose-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          Case {rev.complaint?.pseudonym || rev.complaintId}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Requested at {new Date(rev.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        rev.status === 'APPROVED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : rev.status === 'REJECTED'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>

                  <div className="text-sm bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 block mb-1">
                      Legal / Safety Justification:
                    </span>
                    <p className="text-slate-200">{rev.reason}</p>
                  </div>

                  {rev.status === 'PENDING' && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-amber-400 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        Requires second Super Administrator review (Dual Authorization)
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecideReveal(rev.id, 'REJECT')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                        >
                          Reject Request
                        </button>
                        <button
                          onClick={() => handleDecideReveal(rev.id, 'APPROVE')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          Approve & Break Glass
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Revealed Identity Modal */}
      {revealedResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
              <h3 className="text-lg font-bold text-white">Identity Revealed (Dual Authorized)</h3>
            </div>

            <p className="text-xs text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-900/50">
              This information is displayed strictly once under dual Super Admin authorization. The event has been logged to the immutable audit trail.
            </p>

            <div className="space-y-2 text-sm bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-500 block">Full Name</span>
                <span className="font-semibold text-white">{revealedResult.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Enrollment / ID</span>
                <span className="font-semibold text-slate-300">{revealedResult.enrollmentNo}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">College Email</span>
                <span className="font-semibold text-slate-300">{revealedResult.collegeEmail}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Department</span>
                <span className="font-semibold text-slate-300">{revealedResult.department || 'N/A'}</span>
              </div>
            </div>

            <button
              onClick={() => setRevealedResult(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Close & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Reveal Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold">
                <KeyRound className="w-5 h-5 text-rose-400" />
                <span>Submit Break-Glass Reveal Request</span>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Break-glass identity decryption is strictly restricted to active life-safety emergencies or formal legal subpoenas. An independent second Super Administrator must review and approve this justification.
            </p>

            {requestMessage && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  requestMessage.isError
                    ? 'bg-rose-950/60 border border-rose-900 text-rose-300'
                    : 'bg-emerald-950/60 border border-emerald-900 text-emerald-300'
                }`}
              >
                {requestMessage.text}
              </div>
            )}

            <form onSubmit={handleRequestReveal} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Complaint UUID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={requestComplaintId}
                  onChange={(e) => setRequestComplaintId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Written Legal / Life-Safety Justification
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the imminent threat to life, active weapon hazard, or formal legal order requiring reporter identification..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                >
                  {requestSubmitting ? 'Submitting...' : 'Submit for Dual Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
