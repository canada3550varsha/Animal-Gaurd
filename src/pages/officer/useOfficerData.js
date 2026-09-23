import { useMemo, useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { SYMPTOMS } from "../../data/constants.js";
import { api, getToken } from "../../api/client.js";

export const SYMPTOM_LABEL = Object.fromEntries(
  Object.values(SYMPTOMS)
    .flat()
    .map((s) => [s.id, s.label])
);

// Shared derived data + response actions for all officer (vet/admin) module
// screens. Extracted from the old single multi-section DashboardScreen so each
// role section is now its own page without duplicating logic.
export function useOfficerData() {
  const { user, reports, farms, clusters, criticalClusters, inbox, sensing, getFDRS, dispatchVet, sendAdvisory } = useApp();

  const [acting, setActing] = useState(null);
  const [actionErr, setActionErr] = useState("");
  const [samples, setSamples] = useState([]);
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .samples(getToken())
      .then((data) => active && setSamples(data.samples || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const actOn = async (kind, cluster) => {
    if (acting) return;
    setActing({ id: cluster.id, kind });
    setActionErr("");
    try {
      const fn = kind === "dispatch" ? dispatchVet : sendAdvisory;
      await fn(cluster);
    } catch (e) {
      setActionErr(`${kind === "dispatch" ? "Dispatch" : "Advisory"} failed: ${e?.message || "server error"}`);
    } finally {
      setActing(null);
    }
  };

  const farmById = useMemo(() => new Map(farms.map((f) => [f.farm_id, f])), [farms]);

  const clusteredReportIds = useMemo(() => {
    const ids = new Set();
    for (const c of clusters) for (const r of c.reports) ids.add(r.id);
    return ids;
  }, [clusters]);

  const routineReports = useMemo(
    () =>
      reports
        .filter((r) => !clusteredReportIds.has(r.id) && r.source !== "ai_auto")
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reports, clusteredReportIds]
  );

  const aiAlerts = useMemo(
    () =>
      reports
        .filter((r) => r.source === "ai_auto")
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reports]
  );

  const clusterLevelByFarm = useMemo(() => {
    const ord = { critical: 0, emerging: 1 };
    const map = new Map();
    for (const c of clusters) {
      for (const fid of c.farms) {
        const cur = map.get(fid);
        if (!cur || ord[c.level] < ord[cur]) map.set(fid, c.level);
      }
    }
    return map;
  }, [clusters]);

  const latestReportByFarm = useMemo(() => {
    const map = new Map();
    for (const r of reports) {
      const cur = map.get(r.farm_id);
      if (!cur || new Date(r.created_at) > new Date(cur.created_at)) map.set(r.farm_id, r);
    }
    return map;
  }, [reports]);

  const dispatchedClusterIds = useMemo(() => {
    const s = new Set();
    for (const m of inbox) {
      if ((m.type === "vet" || m.type === "advisory") && m.cluster_id) s.add(m.cluster_id);
    }
    return s;
  }, [inbox]);

  const resolvedClusterIds = useMemo(() => {
    const s = new Set();
    for (const m of inbox) {
      if (m.cluster_id && (m.type === "resolution" || /resolved/i.test(m.en || ""))) s.add(m.cluster_id);
    }
    return s;
  }, [inbox]);

  // For each cluster, the sample workflow state (collected / awaiting / resulted).
  const sampleByCluster = useMemo(() => {
    const map = new Map();
    for (const c of clusters) {
      const own = samples
        .filter((s) => c.farms.includes(s.farm_id))
        .sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at))[0];
      map.set(c.id, own || null);
    }
    return map;
  }, [clusters, samples]);

  const alerts = useMemo(
    () =>
      clusters
        .filter((c) => c.level === "critical" || c.level === "emerging")
        .slice()
        .sort((a, b) => b.report_count - a.report_count),
    [clusters]
  );

  const newAlerts = useMemo(
    () => alerts.filter((c) => c.last_report_at && new Date(c.last_report_at).getTime() > seenAt),
    [alerts, seenAt]
  );

  const mortality = useMemo(() => {
    if (!reports || reports.length === 0) {
      return { d: 0, a: 0, rate: 0, trend: [], villages: [], maxTrend: 1, maxVillage: 1 };
    }
    const deaths = (r) => Number(r.deaths) || 0;
    const WITHIN = (r, days) => new Date(r.created_at).getTime() > now - days * 86400000;
    const in7 = reports.filter((r) => WITHIN(r, 7));
    const in14 = reports.filter((r) => WITHIN(r, 14));
    const totalDeaths = (list) => list.reduce((s, r) => s + deaths(r), 0);
    const totalAffected = (list) => list.reduce((s, r) => s + (Number(r.affected_count) || 0), 0);
    const d = totalDeaths(in7);
    const a = totalAffected(in7.filter((r) => deaths(r) > 0));
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = dayStart.getTime() + 86400000;
      const count = in7
        .filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= dayStart.getTime() && t < dayEnd;
        })
        .reduce((s, r) => s + deaths(r), 0);
      const label = dayStart.toLocaleDateString("en-IN", { weekday: "short" });
      trend.push({ label, count });
    }
    const byVillage = {};
    for (const r of in14) {
      const key = r.village || "Unknown";
      byVillage[key] = byVillage[key] || { village: key, deaths: 0, farms: new Set(), affected: 0 };
      byVillage[key].deaths += deaths(r);
      byVillage[key].farms.add(r.farm_id);
      byVillage[key].affected += Number(r.affected_count) || 0;
    }
    const villages = Object.values(byVillage)
      .map((v) => ({ ...v, farms: v.farms.size }))
      .filter((v) => v.deaths > 0)
      .sort((x, y) => y.deaths - x.deaths);
    const maxVillage = Math.max(1, ...villages.map((v) => v.deaths));
    const maxTrend = Math.max(1, ...trend.map((t) => t.count));
    return { d, a, rate: a ? Math.round((d / a) * 1000) / 10 : 0, trend, villages, maxVillage, maxTrend };
  }, [reports, now]);

  const reportSource = useMemo(() => {
    const map = {};
    for (const r of reports) map[r.id] = r.source || "farmer";
    return map;
  }, [reports]);

  const reports24h = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86400000).length;
  const zoonoticClusters = clusters.filter((c) => c.zoonotic && (c.level === "critical" || c.level === "emerging")).length;

  const kindLabel = (cat) => (cat === "poultry" ? "poultry" : "livestock");

  return {
    user,
    reports,
    farms,
    clusters,
    criticalClusters,
    inbox,
    sensing,
    getFDRS,
    farmById,
    alerts,
    newAlerts,
    markSeen: () => setSeenAt(Date.now()),
    seenAt,
    mortality,
    dispatchedClusterIds,
    resolvedClusterIds,
    clusterLevelByFarm,
    latestReportByFarm,
    routineReports,
    aiAlerts,
    reportSource,
    sampleByCluster,
    actOn,
    acting,
    actionErr,
    reports24h,
    zoonoticClusters,
    kindLabel,
    now,
  };
}