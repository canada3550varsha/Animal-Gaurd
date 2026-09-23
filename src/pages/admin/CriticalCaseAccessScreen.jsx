import { useEffect, useState } from "react";
import AppShell from "../../components/ui/AppShell.jsx";
import { Stat, SectionTitle, EmptyState } from "../../components/ui/primitives.jsx";
import ZoonoticBadge from "../../components/ZoonoticBadge.jsx";
import { api, getToken, reqError } from "../../api/client.js";
import { timeAgo } from "../../data/format.js";

function fdrsBand(total) {
  if (total >= 70) return "High";
  if (total >= 40) return "Moderate";
  return "Low";
}

export default function CriticalCaseAccessScreen() {
  const [critical, setCritical] = useState([]);
  const [audit, setAudit] = useState([]);
  const [open, setOpen] = useState(null); // cluster id
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [c, a] = await Promise.all([api.clusters(getToken()), api.audit(getToken())]);
        if (!active) return;
        setCritical((c.clusters || []).filter((x) => x.level === "critical"));
        setAudit((a.log || []).filter((e) => e.action === "critical_case_access"));
      } catch (e) {
        if (active) setError(reqError(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [result]);

  const grant = async () => {
    if (!open) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await api.criticalAccess(getToken(), open, reason.trim() || undefined);
      setResult(data);
      setOpen(null);
      setReason("");
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Critical Case Access" subtitle="Gated · minimum-necessary · fully audited">
      <div className="space-y-6">
        <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-2xl p-4">
          <p className="font-bold text-sm">🚨 Restricted access</p>
          <p className="text-xs mt-1 leading-snug opacity-90">
            The dashboard above stays aggregated and de-identified. This screen alone can reveal which farms sit inside a
            CRITICAL outbreak — only for government intervention, and every request is written to the tamper-evident audit
            log with who, when and why.
          </p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Stat icon="🚨" iconBg="bg-red-100" label="Critical clusters" value={critical.length} tone={critical.length > 0 ? "red" : "ink"} sub="eligible for identified access" />
          <Stat icon="🧾" iconBg="bg-indigo-100" label="Past accesses" value={audit.length} tone="ink" sub="recorded in audit chain" />
        </div>

        {/* Select + grant */}
        <section>
          <SectionTitle icon="🚨">Request identified access</SectionTitle>
          {critical.length === 0 ? (
            <EmptyState icon="✅" title="No critical clusters" sub="Identified access is only available for CRITICAL-level outbreaks." />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {critical.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setOpen(open === c.id ? null : c.id);
                      setResult(null);
                      setError("");
                    }}
                    className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${
                      open === c.id ? "border-red-600 bg-red-50" : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-bold text-red-800">🚨 {c.village}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {c.report_count} cases · {c.farm_count} farms · {c.animal_category === "poultry" ? "poultry" : "livestock"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.affected_animals ?? 0} affected animals · {c.district}
                    </p>
                    <div className="mt-1.5">
                      <ZoonoticBadge item={c} compact />
                    </div>
                  </button>
                ))}
              </div>

              {open && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-red-800">
                    ⚠️ This will release the MINIMUM necessary identified farm list for this critical cluster.
                  </p>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Government intervention reason (e.g. coordinated culling, ring vaccination drive) — required for audit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                  />
                  <button
                    onClick={grant}
                    disabled={busy}
                    className="w-full py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {busy ? "Recording…" : "🚨 Grant identified access (audited)"}
                  </button>
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}
        </section>

        {/* Result of granted access */}
        {result && (
          <section>
            <SectionTitle icon="📋">Released case detail — {result.cluster.village}</SectionTitle>
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-3">
              <p className="text-xs font-semibold text-indigo-800">
                🧾 This access was recorded in the audit log at {timeAgo(result.accessedAt)} ({new Date(result.accessedAt).toLocaleString()}).
              </p>
              <p className="text-[11px] text-indigo-700 mt-1 leading-snug">
                {result.notice}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(result.identifiedFarms || []).map((f) => (
                <div key={f.farm_id} className="bg-white rounded-xl border border-red-200 p-3">
                  <p className="font-semibold text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-500">
                    📍 {f.village}, {f.taluka}, {f.district}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    {f.animal_type} · herd {f.herd_size} · {f.animal_category === "poultry" ? "poultry" : "livestock"}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    FDRS {f.fdrs?.total ?? "--"}/100 · {fdrsBand(f.fdrs?.total)} risk
                  </p>
                  {typeof f.lat === "number" && typeof f.lng === "number" && (
                    <p className="text-[10px] text-gray-400 mt-1">📍 {f.lat.toFixed(4)}, {f.lng.toFixed(4)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past accesses from audit chain */}
        {audit.length > 0 && (
          <section>
            <SectionTitle icon="🧾">Recent audited accesses</SectionTitle>
            <div className="space-y-2">
              {audit
                .slice()
                .reverse()
                .slice(0, 10)
                .map((e) => (
                  <div key={e.seq} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        #{e.seq} · {e.data?.village || "—"} ({e.data?.report_count} cases)
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Reason: {e.data?.reason || "—"} · {e.data?.farms_accessed?.length || 0} farm(s) released
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(e.ts)}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}