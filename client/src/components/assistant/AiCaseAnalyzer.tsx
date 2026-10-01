import { useState } from 'react';
import { 
  Sparkles, 
  Scale, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Lock,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface BrokenLaw {
  act: string;
  section: string;
  title: string;
  description: string;
  punishment?: string;
  bailable: boolean;
  cognizable: boolean;
}

interface ResolutionPath {
  name: string;
  authority: string;
  description: string;
  slaOrTimeline: string;
}

interface CaseAnalysisData {
  disclaimer: string;
  guidance: string;
  brokenLaws: BrokenLaw[];
  immediateActions: string[];
  resolutionPaths: ResolutionPath[];
  firDraft: string;
}

interface AiCaseAnalyzerProps {
  onStartComplaintWithFir?: (data: { title: string; story: string; firDraft: string; suggestedCategory?: string }) => void;
  onClose?: () => void;
}

const SAMPLE_SCENARIOS = [
  { label: 'Hostel Ragging & Harassment', prompt: 'Senior students in the hostel entered my room at 1 AM, forced junior students to perform demeaning acts, and threatened rustication if anyone reported it.' },
  { label: 'Blackmail / Cyber Harassment', prompt: 'An anonymous account on Instagram is threatening to leak private photos and edited chat screenshots unless money is transferred via UPI.' },
  { label: 'Unwanted Stalking & Intimidation', prompt: 'A person has been persistently following me across the campus library and cafeteria despite explicit warnings, and waiting outside my classroom.' },
];

export default function AiCaseAnalyzer({ onStartComplaintWithFir, onClose }: AiCaseAnalyzerProps) {
  const [story, setStory] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CaseAnalysisData | null>(null);
  const [copiedFir, setCopiedFir] = useState(false);
  const [activeTab, setActiveTab] = useState<'GUIDANCE' | 'LAWS' | 'FIR'>('GUIDANCE');

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!story.trim() || story.trim().length < 10) {
      setError('Please provide at least 10 characters detailing what happened.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/assistant/case-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: story.trim(),
          incidentLocation: incidentLocation || undefined,
          incidentDate: incidentDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to analyze situation.');
      }

      setAnalysis(data);
      setActiveTab('GUIDANCE');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFir = () => {
    if (!analysis?.firDraft) return;
    navigator.clipboard.writeText(analysis.firDraft);
    setCopiedFir(true);
    setTimeout(() => setCopiedFir(false), 2000);
  };

  const handleTransferToComplaint = () => {
    if (!analysis || !onStartComplaintWithFir) return;
    const title = story.slice(0, 60).replace(/\n/g, ' ') + (story.length > 60 ? '...' : '');
    onStartComplaintWithFir({
      title: `Grievance: ${title}`,
      story,
      firDraft: analysis.firDraft,
      suggestedCategory: analysis.brokenLaws[0]?.act.includes('Ragging') ? 'Ragging' : 'Harassment',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mandatory Statutory Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs">
          <strong className="block text-amber-950 font-bold uppercase tracking-wider text-[11px] mb-0.5">
            Mandatory Statutory AI Legal Disclaimer
          </strong>
          <p className="leading-relaxed text-amber-800">
            This AI Case Analyzer provides guidance for informational and grievance-structuring purposes only. It is trained on Indian Law (Bharatiya Nyaya Sanhita, UGC Regulations, POSH Act, IT Act) but <strong>does not constitute certified legal counsel or formal police acceptance</strong>. In emergency or life-threatening situations, dial <strong>112</strong> immediately.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Section 2: Pre-Filing Triage & Legal Consultation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">AI Case Analyzer</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Discuss what occurred in complete confidence. Our legal AI will evaluate broken laws, outline immediate actions, and generate a formal FIR draft.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              Close
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Narrative of What Happened (Your Story)
            </label>
            <textarea
              rows={4}
              required
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Describe what occurred, who was involved, any demands made, threats issued, or electronic harassment..."
              className="w-full p-3.5 text-sm rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Quick Scenario Pills */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Or pick an example scenario:
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SCENARIOS.map((sc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStory(sc.prompt)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 text-xs font-medium text-slate-700 transition-colors text-left"
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Incident Location <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={incidentLocation}
                onChange={(e) => setIncidentLocation(e.target.value)}
                placeholder="e.g. North Hostel 3rd Floor / Main Library"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date & Time <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                placeholder="e.g. Last night around 11:30 PM"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Zero-Storage Pre-Check Session</span>
            </div>

            <button
              type="submit"
              disabled={loading || !story.trim()}
              className="px-6 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-sm shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating Indian Statutes...</span>
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4" />
                  <span>Analyze Case & Draft FIR</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('GUIDANCE')}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'GUIDANCE'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Victim Guidance & Actions</span>
            </button>

            <button
              onClick={() => setActiveTab('LAWS')}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'LAWS'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Broken Laws ({analysis.brokenLaws.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('FIR')}
              className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'FIR'
                  ? 'border-sky-600 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Automated FIR Draft</span>
            </button>
          </div>

          {/* TAB 1: GUIDANCE & ACTIONS */}
          {activeTab === 'GUIDANCE' && (
            <div className="space-y-6">
              {/* Guidance Box */}
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-sm text-sky-950 leading-relaxed">
                <div className="font-bold text-xs uppercase tracking-wider text-sky-800 mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  Legal Counselor Assessment
                </div>
                <p className="whitespace-pre-wrap">{analysis.guidance}</p>
              </div>

              {/* Immediate Action Checklist */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Recommended Immediate Steps for the Victim
                </h3>
                <div className="space-y-2">
                  {analysis.immediateActions.map((act, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resolution Paths */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <ChevronRight className="w-4 h-4 text-sky-600" />
                  Statutory Resolution Paths Available
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analysis.resolutionPaths.map((path, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <strong className="text-xs font-bold text-slate-900 block">{path.name}</strong>
                      <span className="text-[11px] text-sky-700 font-semibold block">{path.authority}</span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{path.description}</p>
                      <div className="pt-1 text-[10px] text-emerald-700 font-medium">SLA: {path.slaOrTimeline}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BROKEN LAWS */}
          {activeTab === 'LAWS' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                The AI Legal Engine mapped your narrative against Indian criminal laws and campus safety regulations:
              </div>

              <div className="space-y-3">
                {analysis.brokenLaws.map((law, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-sky-700" />
                        <span className="text-xs font-bold text-sky-900">{law.act}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-mono font-bold">
                          {law.section}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${law.cognizable ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                          {law.cognizable ? 'Cognizable' : 'Non-Cognizable'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${law.bailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {law.bailable ? 'Bailable' : 'Non-Bailable'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <strong className="text-xs text-slate-900 block">{law.title}</strong>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{law.description}</p>
                    </div>
                    {law.punishment && (
                      <div className="text-[11px] text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                        ⚖️ Statutory Penalty: {law.punishment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FORMAL FIR DRAFT */}
          {activeTab === 'FIR' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Formally structured First Information Report (FIR) under Section 173 BNSS / 154 CrPC:
                </span>
                <button
                  type="button"
                  onClick={handleCopyFir}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                >
                  {copiedFir ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedFir ? 'Copied!' : 'Copy FIR Text'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto border border-slate-800">
                {analysis.firDraft}
              </div>
            </div>
          )}

          {/* Action Footer: Seamless Transfer to Complaint Registration */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              Ready to file your grievance? You can pre-fill the complaint form with this FIR draft.
            </span>

            {onStartComplaintWithFir && (
              <button
                type="button"
                onClick={handleTransferToComplaint}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue to Official Complaint Registration</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
