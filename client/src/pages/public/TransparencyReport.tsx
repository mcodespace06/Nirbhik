import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Star, 
  Layers, 
  RefreshCw,
  KeyRound
} from 'lucide-react';

interface TransparencyData {
  reportTitle: string;
  period: string;
  lastUpdated: string;
  overallMetrics: {
    totalHandled: number;
    totalResolved: number;
    resolutionRatePercent: number;
    avgResolutionDays: number;
    avgSatisfactionScore: number;
  };
  monthlyStats: Array<{
    month: string;
    received: number;
    resolved: number;
    avgDays: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  institutionalIntegrity: {
    breakGlassRevealsQuarterly: number;
    dualAuthorizationRequired: boolean;
    vaultIsolatedEncryption: string;
    zeroPiiPublicPolicy: string;
  };
}

export default function TransparencyReport() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/transparency')
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.error('[Transparency Report Error]:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <span className="text-sm font-semibold text-slate-600">Loading Public Institutional Transparency Data...</span>
      </div>
    );
  }

  const overall = data?.overallMetrics;

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-800 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Statutory Public Transparency Disclosure</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Institutional Safety & Grievance Transparency Report
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
          CampusVoice publishes monthly anonymized grievance handling metrics. We believe genuine student safety requires public accountability without ever compromising individual complainant anonymity.
        </p>
        <div className="text-xs text-slate-400 pt-2 flex flex-wrap items-center gap-4 border-t border-slate-800">
          <span>Reporting Period: <strong className="text-slate-200">{data?.period}</strong></span>
          <span>Last Synchronized: <strong className="text-slate-200">{new Date(data?.lastUpdated || '').toLocaleDateString()}</strong></span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Anonymized (Zero PII)
          </span>
        </div>
      </div>

      {/* Primary KPI Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Handled</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{overall?.totalHandled || 0}</div>
          <div className="text-xs text-slate-400 mt-1">Verified grievances</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600">{overall?.resolutionRatePercent || 0}%</div>
          <div className="text-xs text-slate-400 mt-1">{overall?.totalResolved || 0} resolved to completion</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {overall?.avgResolutionDays || 0} <span className="text-sm font-semibold text-slate-500">days</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">From intake to resolution</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Satisfaction Index</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600">
            {overall?.avgSatisfactionScore || 0} <span className="text-sm font-semibold text-slate-400">/ 5</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Complainant feedback rating</div>
        </div>
      </div>

      {/* Monthly Case Trajectory & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Breakdown Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">Monthly Intake vs Resolution Trajectory</h3>
            <p className="text-xs text-slate-500">Historical performance across the past 6 operational months</p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-50 p-3 grid grid-cols-3 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              <span>Month</span>
              <span className="text-center">Cases Received</span>
              <span className="text-right">Cases Resolved</span>
            </div>
            {data?.monthlyStats.map((m) => (
              <div key={m.month} className="p-3 grid grid-cols-3 text-slate-800 hover:bg-slate-50 transition-colors">
                <span className="font-semibold text-slate-900">{m.month}</span>
                <span className="text-center font-mono font-medium text-sky-700">{m.received}</span>
                <span className="text-right font-mono font-bold text-emerald-700">{m.resolved}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">Grievance Category Breakdown</h3>
            <p className="text-xs text-slate-500">Aggregated proportions of institutional grievances filed</p>
          </div>

          <div className="space-y-3 pt-1">
            {data?.categoryDistribution.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{cat.category}</span>
                  <span className="text-slate-500 font-semibold">{cat.count} cases ({cat.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(cat.percentage, 4)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Institutional Privacy & Anonymity Safeguards (PRD §5.1 / ARCHITECTURE §11) */}
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50/70 via-white to-indigo-50/50 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sky-800 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Cryptographic Trust & Governance Framework</span>
          </div>
          <h3 className="text-xl font-black text-slate-900">Institutional Anonymity & Data Protection Guarantees</h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            CampusVoice operates under a zero-compromise architectural guarantee. Below are the verified metrics of our privacy isolation layer for this reporting period.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Identity Vault Isolation</span>
            <div className="text-base font-black text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <span>{data?.institutionalIntegrity.vaultIsolatedEncryption}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Admin database accounts have zero read permissions on identity tables.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Break-Glass De-anonymizations</span>
            <div className="text-3xl font-black text-emerald-600">
              {data?.institutionalIntegrity.breakGlassRevealsQuarterly}
            </div>
            <p className="text-[11px] text-slate-500">
              Dual Super Admin written approval required. 0 reveals executed.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ultra-Anonymous Mode</span>
            <div className="text-base font-black text-sky-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Supported & Unlinkable</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Zero identity records created on server. Trackable exclusively by cryptographic key.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
