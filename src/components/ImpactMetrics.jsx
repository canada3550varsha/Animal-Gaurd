import { useEffect, useState } from "react";
import { api, getToken, reqError } from "../api/client.js";

// Impact metric cards — reporting-to-response time, farms covered (livestock/poultry),
// and active outbreak clusters. All numbers come live from the backend.
export default function ImpactMetrics({ compact = false }) {
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.impact(getToken());
        if (active) setImpact(data.impact);
      } catch (e) {
        if (e?.status === 401) {
          if (active) setError("Session expired — go back and pick your role to continue.");
        } else {
          if (active) setError(reqError(e));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!impact) {
    return <p className="text-sm text-gray-400">Impact data unavailable.</p>;
  }

  const rtr = impact.reportingToResponse;
  const covered = impact.farmsCovered;
  const clusters = impact.activeClusters;

  return (
    <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-3"} gap-3`}>
      {/* Reporting-to-response time */}
      <MetricCard
        icon="⏱️"
        label="Avg Report→Response"
        title={`${rtr.kind === "average" ? "Measured average" : "Baseline estimate"}: ${rtr.basis || ""}`}
        iconBg="bg-blue-100"
        main={
          <span className="text-2xl font-bold text-gray-900">
            {rtr.current}
            <span className="text-sm text-gray-400"> {rtr.unit}</span>
          </span>
        }
        sub={
          <span className={rtr.current <= rtr.target ? "text-green-600" : "text-amber-600"}>
            target {rtr.target}{rtr.unit}
          </span>
        }
        foot={
          <span className="text-[10px] text-gray-400">
            {rtr.kind === "average" ? `average of ${rtr.n} measured dispatch(es)` : "no dispatches yet — baseline estimate"}
          </span>
        }
      />

      {/* Farms covered, split livestock/poultry */}
      <MetricCard
        icon="🏡"
        label="Farms Covered"
        iconBg="bg-green-100"
        main={<span className="text-2xl font-bold text-gray-900">{covered.total}</span>}
        sub={
          <span className="text-xs text-gray-500">
            {covered.livestock} livestock · {covered.poultry} poultry · {covered.livestockHerd + covered.poultryHerd} animals
          </span>
        }
      />

      {/* Active outbreak clusters */}
      <MetricCard
        icon="🚨"
        label="Active Outbreaks"
        iconBg="bg-red-100"
        main={<span className="text-2xl font-bold text-gray-900">{clusters.critical + clusters.emerging}</span>}
        sub={
          <span className="text-xs text-gray-500">
            <span className={clusters.critical > 0 ? "text-red-600 font-medium" : ""}>{clusters.critical} critical</span> · {clusters.emerging} emerging
          </span>
        }
      />
    </div>
  );
}

function MetricCard({ icon, label, iconBg, main, sub, foot, title }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm" title={title}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center text-base`}>{icon}</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div>{main}</div>
      <div className="mt-1">{sub}</div>
      {foot && <div className="mt-1">{foot}</div>}
    </div>
  );
}
