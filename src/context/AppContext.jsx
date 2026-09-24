import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { api, getToken, setToken } from "../api/client.js";
import { SEVERITY_BY_ID } from "../data/constants.js";
import {
  computeEnvRisk,
  computeFDRS,
  computeReportedCases,
  historicalRiskFor,
} from "../api/agro.js";
import { haversineKm, RING_INNER_KM, RING_OUTER_KM } from "../api/clustering.js";

const AppContext = createContext(null);

// Role -> seeded demo account. Selecting a role on the landing screen signs the
// app in as that role's demo user (server auth stays intact — no login page).
const ROLE_LOGINS = {
  farmer: { mobile: "9876543210", code: "0000" },
  vet: { mobile: "9123456780", code: "0000" },
  admin: { mobile: "9988776655", code: "0000" },
  lab: { mobile: "9000000001", code: "0000" },
};

export function AppProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const [farms, setFarms] = useState([]);
  const [reports, setReports] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [sensing, setSensing] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [envData, setEnvData] = useState({});
  const [envLoading, setEnvLoading] = useState({});
  const [lang, setLangState] = useState(() => localStorage.getItem("ag_lang") || "en");

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem("ag_lang", next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Restore session from token on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const t = getToken();
      if (!t) {
        setAuthLoaded(true);
        return;
      }
      try {
        const me = await api.me(t);
        if (active) setUser(me.user);
      } catch {
        if (active) {
          setToken(null);
          setTokenState(null);
        }
      } finally {
        if (active) setAuthLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load app data whenever the user is known.
  useEffect(() => {
    if (!user || !token) return;
    let active = true;
    (async () => {
      try {
        const [farmRes, reportRes, clusterRes, inboxRes, sensingRes] = await Promise.all([
          api.farms(token),
          api.reports(token),
          api.clusters(token),
          api.inbox(token),
          api.sensing(token),
        ]);
        if (!active) return;
        setFarms(farmRes.farms);
        setReports(reportRes.reports);
        setClusters(clusterRes.clusters);
        setInbox(inboxRes.inbox);
        setSensing(sensingRes.rows || []);
        setLastSyncedAt(Date.now());
      } catch (e) {
        if (e?.status === 401) {
          handleLogout();
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  // LIVE polling: a report submitted in any session must surface on the vet/office
  // dashboard within a few seconds — no manual refresh. Every tick also refreshes
  // inbox (response status) and reports so everything stays warm.
  useEffect(() => {
    if (!user || !token) return;
    let active = true;
    const tick = async () => {
      try {
        const [freshClusters, freshInbox, freshReports, freshSensing] = await Promise.all([
          api.clusters(token),
          api.inbox(token),
          api.reports(token),
          api.sensing(token),
        ]);
        if (!active) return;
        setClusters(freshClusters.clusters);
        setInbox(freshInbox.inbox);
        setReports(freshReports.reports);
        setSensing(freshSensing.rows || []);
        setLastSyncedAt(Date.now());
      } catch {
        // transient — next tick retries
      }
    };
    const id = setInterval(tick, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const login = useCallback(async (mobile, code) => {
    const data = await api.login(mobile, code);
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // Sign the app in as a role's demo user (called from the role-selection screen).
  const selectRole = useCallback(async (role) => {
    const creds = ROLE_LOGINS[role];
    if (!creds) throw new Error(`Unknown role: ${role}`);
    const data = await api.login(creds.mobile, creds.code);
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setFarms([]);
    setReports([]);
    setInbox([]);
    setClusters([]);
    setSensing([]);
  }, []);

  const getUserFarms = useCallback(() => farms, [farms]);

  // Latest raw sensing row for a farm (from the /api/sensing poll), or null.
  const getLatestReading = useCallback(
    (farmId) => sensing.find((row) => row.farm.farm_id === farmId)?.reading ?? null,
    [sensing]
  );

  // Best-effort env fetch for a farm (via backend proxy). Returns the raw envelope.
  const fetchEnvFor = useCallback(
    async (farm) => {
      if (!token) return null;
      try {
        const { env } = await api.farmEnv(token, farm.farm_id);
        return env || null;
      } catch {
        return envData[farm.farm_id]?.env || null;
      }
    },
    [token, envData]
  );

  const refreshRisk = useCallback(async () => {
    console.log("env:refresh", { hasToken: !!token, farmCount: farms.length, loading: envLoading });
    if (!token) return;
    const targets = farms.filter((f) => !envLoading[f.farm_id]);
    for (const farm of targets) {
      setEnvLoading((prev) => ({ ...prev, [farm.farm_id]: true }));
      try {
        // envData stores the full server response: { env, fetched_at, source, risk }.
        console.log("env:fetch", farm.farm_id);
        const res = await api.farmEnv(token, farm.farm_id);
        console.log("env:got", farm.farm_id, res?.source, res?.risk);
        setEnvData((prev) => ({ ...prev, [farm.farm_id]: res }));
      } catch (err) {
        console.log("env:fail", farm.farm_id, String(err));
      } finally {
        setEnvLoading((prev) => ({ ...prev, [farm.farm_id]: false }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, farms.length, envLoading]);

  // Fetch env for a single farm (triggered when its detail screen opens).
  const refreshFarmEnv = useCallback(
    async (farmId) => {
      console.log("env:open", { farmId, hasToken: !!token });
      if (!token) return null;
      setEnvData((prev) => ({ ...prev, [farmId]: { ...(prev[farmId] || {}), env: null } }));
      try {
        console.log("env:fetch", farmId);
        const res = await api.farmEnv(token, farmId);
        console.log("env:got", farmId, res?.source, res?.risk);
        setEnvData((prev) => ({ ...prev, [farmId]: res }));
        return res;
      } catch (err) {
        console.log("env:fail", farmId, String(err));
        return null;
      }
    },
    [token]
  );

  useEffect(() => {
    if (user && token) refreshRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, farms.length]);

  const addFarm = useCallback(
    async (farmData) => {
      if (!token) throw new Error("Not authenticated");
      const data = await api.createFarm(token, farmData);
      setFarms((prev) => [...prev, data.farm]);
      return data.farm;
    },
    [token]
  );

  const addReport = useCallback(
    async (payload) => {
      if (!token) throw new Error("Not authenticated");
      const data = await api.createReport(token, payload);
      setReports((prev) => [...prev, data.report]);
      // Refresh clusters after new report.
      try {
        const clusterRes = await api.clusters(token);
        setClusters(clusterRes.clusters);
      } catch {
        /* ignore */
      }
      return data.report;
    },
    [token]
  );

  const criticalClusters = useMemo(
    () => clusters.filter((c) => c.level === "critical"),
    [clusters]
  );

  const getFarmInbox = useCallback(
    (farmId) => inbox.filter((m) => m.farm_id === farmId).sort((a, b) => b.ts - a.ts),
    [inbox]
  );

  // Vet/admin actions -> backend writes audit chain + inbox, then reload inbox.
  const runClusterAction = useCallback(
    async (action, cluster) => {
      if (!token) throw new Error("Not authenticated");
      await api.clusterAction(token, cluster.id, action);
      const inboxRes = await api.inbox(token);
      setInbox(inboxRes.inbox);
    },
    [token]
  );
  const dispatchVet = useCallback((cluster) => runClusterAction("dispatch", cluster), [runClusterAction]);
  const sendAdvisory = useCallback((cluster) => runClusterAction("advisory", cluster), [runClusterAction]);

  // Compute an FDRS summary for a given farm using server-provided base + local env.
  const getFDRS = useCallback(
    (farm) => {
      if (!farm) return null;
      const envEntry = envData[farm.farm_id];
      const envRisk = envEntry?.env ? computeEnvRisk(envEntry.env) : null;
      const historical = historicalRiskFor(farm.taluka);
      const reported = computeReportedCases(
        reports.filter((r) => r.farm_id === farm.farm_id),
        { days: 7, max: 35, severityById: SEVERITY_BY_ID }
      );
      let nearby = 0;
      let ringInfo = null;
      for (const c of criticalClusters) {
        if (c.animal_category !== farm.animal_category) continue;
        const dist = haversineKm(farm.lat, farm.lng, c.centroid.lat, c.centroid.lng);
        if (dist <= RING_OUTER_KM) {
          const score =
            dist <= RING_INNER_KM
              ? 20
              : Math.round(20 * (1 - (dist - RING_INNER_KM) / (RING_OUTER_KM - RING_INNER_KM)));
          if (score > nearby) {
            nearby = Math.min(20, score);
            ringInfo = { dist, cluster: c };
          }
        }
      }
      const env = envRisk ?? null;
      const total = computeFDRS({ reportedCases: reported, historical, env: env ?? 0, nearby });
      return { reportedCases: reported, historical, env, nearby, ringInfo, total };
    },
    [envData, reports, criticalClusters]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        authLoaded,
        login,
        selectRole,
        logout: handleLogout,
        farms,
        getUserFarms,
        addFarm,
        reports,
        addReport,
        inbox,
        getFarmInbox,
        dispatchVet,
        sendAdvisory,
        clusters,
        criticalClusters,
        sensing,
        getLatestReading,
        envData,
        envLoading,
        refreshRisk,
        refreshFarmEnv,
        fetchEnvFor,
        lastSyncedAt,
        getFDRS,
        lang,
        setLang,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
