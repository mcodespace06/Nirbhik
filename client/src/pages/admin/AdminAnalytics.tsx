import { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  MapPin, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Star, 
  RefreshCw, 
  Layers, 
  Flame, 
  Award, 
  Zap
} from 'lucide-react';

interface OverviewMetrics {
  totalComplaints: number;
  activeCount: number;
  resolvedCount: number;
  resolutionRate: number;
  avgResolutionHours: number;
  avgResolutionDays: number;
  medianResolutionHours: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  modeDistribution: {
    confidential: number;
    ultraAnon: number;
  };
  satisfaction: {
    averageRating: number;
    totalRatings: number;
    distribution: Record<number, number>;
  };
  alerts: {
    total: number;
    open: number;
    critical: number;
  };
  sosEventsTotal: number;
}

interface CategoryMetric {
  id: string;
  name: string;
  severityWeight: number;
  isSafety: boolean;
  totalComplaints: number;
  percentage: number;
  resolvedComplaints: number;
  avgResolutionHours: number;
}

interface HotspotMetric {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalComplaints: number;
  activeComplaints: number;
  resolvedComplaints: number;
  criticalComplaints: number;
  topCategory: string;
  intensity: number;
}

interface TrendDay {
  date: string;
  submitted: number;
  resolved: number;
}

interface SlaStatus {
  overallComplianceRate: number;
  totalResolved: number;
  resolvedWithinSla: number;
  priorityStats: Record<string, { total: number; breached: number; complianceRate: number }>;
  currentlyBreached: Array<{
    id: string;
    pseudonym: string;
    title: string;
    priority: string;
    hoursOpen: number;
    targetHours: number;
  }>;
}

export default function AdminAnalytics() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [categories, setCategories] = useState<CategoryMetric[]>([]);
  const [hotspots, setHotspots] = useState<HotspotMetric[]>([]);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [slaStats, setSlaStats] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotMetric | null>(null);
  const [slaChecking, setSlaChecking] = useState(false);
  const [slaCheckMessage, setSlaCheckMessage] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cv_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resOverview, resCats, resHotspots, resTrends, resSla] = await Promise.all([
        fetch('/api/admin/analytics/overview', { headers }),
        fetch('/api/admin/analytics/categories', { headers }),
        fetch('/api/admin/analytics/hotspots', { headers }),
        fetch('/api/admin/analytics/trends?days=14', { headers }),
        fetch('/api/admin/analytics/sla/status', { headers }),
      ]);

      if (resOverview.ok) setOverview(await resOverview.json());
      if (resCats.ok) {
        const d = await resCats.json();
        setCategories(d.breakdown || []);
      }
      if (resHotspots.ok) {
        const d = await resHotspots.json();
        setHotspots(d.hotspots || []);
        if (d.hotspots?.length > 0 && !selectedHotspot) {
          setSelectedHotspot(d.hotspots[0]);
        }
      }
      if (resTrends.ok) {
        const d = await resTrends.json();
        setTrends(d.trends || []);
      }
      if (resSla.ok) setSlaStats(await resSla.json());
    } catch (err) {
      console.error('[Analytics Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRunSlaCheck = async () => {
    setSlaChecking(true);
    setSlaCheckMessage(null);
    try {
      const token = localStorage.getItem('cv_token');
      const res = await fetch('/api/admin/analytics/sla/check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlaCheckMessage(
          `Evaluated ${data.report.evaluatedCasesCount} cases: ${data.report.breachedCasesCount} breaches, ${data.report.escalatedCasesCount} newly escalated.`
        );
        fetchAnalytics();
      }
    } catch {
      setSlaCheckMessage('Failed to execute SLA check.');
    } finally {
      setSlaChecking(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <span className="text-sm font-semibold text-slate-600">Generating Campus Safety & SLA Analytics...</span>
      </div>
    );
  }

  const maxTrend = Math.max(...trends.map((t) => Math.max(t.submitted, t.resolved)), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Analytics Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 text-xs font-bold uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Institutional Grievance Intelligence</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Campus Safety & SLA Analytics</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Geographic hotspot analysis, SLA compliance tracking, category distribution, and satisfaction indicators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunSlaCheck}
            disabled={slaChecking}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Zap className={`w-3.5 h-3.5 ${slaChecking ? 'animate-bounce text-amber-600' : 'text-amber-700'}`} />
            <span>{slaChecking ? 'Auditing SLAs...' : 'Audit SLAs Now'}</span>
          </button>

          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {slaCheckMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{slaCheckMessage}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Volume</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{overview?.totalComplaints || 0}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {overview?.activeCount || 0} currently active
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">
            {overview?.resolutionRate || 0}%
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {overview?.resolvedCount || 0} closed cases
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Speed</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {overview?.avgResolutionDays || 0} <span className="text-sm font-semibold text-slate-500">days</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Median: {overview?.medianResolutionHours || 0} hrs
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">SLA Compliance</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700">
            {slaStats?.overallComplianceRate || 100}%
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {slaStats?.currentlyBreached.length || 0} overdue breaches
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Satisfaction</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600">
            {overview?.satisfaction.averageRating || '—'}{' '}
            <span className="text-sm font-semibold text-slate-400">/ 5</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {overview?.satisfaction.totalRatings || 0} student ratings
          </div>
        </div>
      </div>

      {/* Campus Hotspot & Heatmap Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Interactive Campus Hotspot Heatmap</h3>
              <p className="text-xs text-slate-500">
                Density clusters and incident frequencies mapped across campus facilities and hostels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
              <span className="text-slate-600 text-[11px]">High Density</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-600 text-[11px]">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-600 text-[11px]">Low Density</span>
            </div>
          </div>
        </div>

        {/* Campus Map Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative h-96 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-800 overflow-hidden shadow-inner p-4 flex flex-col justify-between">
            {/* Map Grid Background Overlay */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono uppercase font-bold text-[11px] text-slate-300">Live Campus Coordinate Grid (19.076N, 72.877E)</span>
              </div>
              <span className="text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-400">Geo-referenced Pins</span>
            </div>

            {/* Hotspot Nodes positioned schematically */}
            <div className="relative z-10 flex-1 grid grid-cols-3 grid-rows-3 gap-4 my-2">
              {hotspots.map((h) => {
                const isSelected = selectedHotspot?.id === h.id;
                const isHigh = h.intensity >= 0.7;
                const isMed = h.intensity >= 0.3 && h.intensity < 0.7;

                const colorClass = isHigh
                  ? 'bg-red-500/20 border-red-500 text-red-400 ring-red-500/30'
                  : isMed
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 ring-amber-500/30'
                  : 'bg-emerald-500/20 border-emerald-500 text-emerald-400 ring-emerald-500/30';

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHotspot(h)}
                    className={`relative p-2.5 rounded-xl border flex flex-col justify-between transition-all group text-left ${
                      isSelected
                        ? 'bg-slate-700/90 border-sky-400 ring-2 ring-sky-400 shadow-lg'
                        : `${colorClass} hover:bg-slate-800/90`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <MapPin className={`w-3.5 h-3.5 ${isHigh ? 'text-red-400' : isMed ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        isHigh ? 'bg-red-900/80 text-red-200' : isMed ? 'bg-amber-900/80 text-amber-200' : 'bg-emerald-900/80 text-emerald-200'
                      }`}>
                        {h.totalComplaints}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                        {h.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {h.criticalComplaints > 0 ? (
                          <span className="text-red-400 font-bold">{h.criticalComplaints} Critical</span>
                        ) : (
                          `${h.activeComplaints} Active`
                        )}
                      </div>
                    </div>

                    {isHigh && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 text-right">
              Click any campus location block to inspect safety profile & breakdown.
            </div>
          </div>

          {/* Selected Hotspot Inspector Panel */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
            {selectedHotspot ? (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-1.5 text-xs text-sky-700 font-bold mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Location Focus</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 leading-snug">{selectedHotspot.name}</h4>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Coordinates: {selectedHotspot.lat.toFixed(4)}, {selectedHotspot.lng.toFixed(4)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Reports</span>
                    <span className="text-xl font-black text-slate-900">{selectedHotspot.totalComplaints}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Active / Pending</span>
                    <span className="text-xl font-black text-amber-600">{selectedHotspot.activeComplaints}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Resolved</span>
                    <span className="text-xl font-black text-emerald-600">{selectedHotspot.resolvedComplaints}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Critical Alerts</span>
                    <span className={`text-xl font-black ${selectedHotspot.criticalComplaints > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {selectedHotspot.criticalComplaints}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">Primary Issue Category</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{selectedHotspot.topCategory}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700">
                      Top Driver
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Heatmap Density Weight</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Calculated intensity: <span className="font-mono font-bold">{(selectedHotspot.intensity * 100).toFixed(0)}%</span> based on volume and severity index.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400">
                Select a campus facility to view telemetry
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown & Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Category Distribution</h3>
              <p className="text-xs text-slate-500">Incident breakdown sorted by institutional volume</p>
            </div>
            <span className="text-xs font-bold text-slate-400">{categories.length} Active Categories</span>
          </div>

          <div className="space-y-3">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{cat.name}</span>
                    {cat.isSafety && (
                      <span className="px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 font-bold text-[9px] uppercase">
                        Safety Floor
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-semibold">{cat.totalComplaints} cases ({cat.percentage}%)</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.isSafety ? 'bg-rose-500' : 'bg-sky-600'
                    }`}
                    style={{ width: `${Math.max(cat.percentage, 3)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 14-Day Activity Trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">14-Day Timeline Trajectory</h3>
              <p className="text-xs text-slate-500">Comparison of incoming reports vs resolved cases</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <span className="text-slate-600">Submitted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Resolved</span>
              </div>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-1.5 pt-4">
            {trends.slice(-14).map((t) => {
              const subH = Math.round((t.submitted / maxTrend) * 160);
              const resH = Math.round((t.resolved / maxTrend) * 160);
              const dateLabel = t.date.split('-').slice(1).join('/');

              return (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex items-end justify-center gap-0.5 h-44">
                    <div
                      className="w-2.5 sm:w-3.5 bg-sky-500 rounded-t-sm transition-all group-hover:bg-sky-600"
                      style={{ height: `${Math.max(subH, 4)}px` }}
                      title={`${t.date}: ${t.submitted} submitted`}
                    ></div>
                    <div
                      className="w-2.5 sm:w-3.5 bg-emerald-400 rounded-t-sm transition-all group-hover:bg-emerald-500"
                      style={{ height: `${Math.max(resH, 4)}px` }}
                      title={`${t.date}: ${t.resolved} resolved`}
                    ></div>
                  </div>
                  <span className="text-[9px] text-slate-400 rotate-45 sm:rotate-0 mt-1 font-mono">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SLA Performance & Overdue Breaches Monitor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Institutional SLA Compliance Monitor</h3>
              <p className="text-xs text-slate-500">
                Enforcing statutory turnaround response windows per priority tier (WORKFLOW §7)
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 font-bold block">Overall Compliance</span>
            <span className="text-lg font-black text-purple-700">{slaStats?.overallComplianceRate || 100}%</span>
          </div>
        </div>

        {/* Priority SLA Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(slaStats?.priorityStats || {}).map(([p, stat]) => (
            <div key={p} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">{p}</span>
                <span className={`font-black ${stat.complianceRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {stat.complianceRate}%
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {stat.breached} breached / {stat.total} total cases
              </div>
            </div>
          ))}
        </div>

        {/* Currently Breached Cases Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Active Overdue Cases ({slaStats?.currentlyBreached.length || 0})
            </span>
          </div>

          {slaStats?.currentlyBreached && slaStats.currentlyBreached.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {slaStats.currentlyBreached.map((b) => (
                <div key={b.id} className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{b.pseudonym}</span>
                        <span className="text-slate-600 truncate max-w-xs">{b.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Priority: {b.priority}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-rose-600 block">
                      {b.hoursOpen}h open
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Target: {b.targetHours}h allowed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero cases currently exceeding institutional turnaround targets. All queues compliant.</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold uppercase">100% on schedule</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
