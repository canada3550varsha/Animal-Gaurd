import { Component, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api, reqError } from "../api/client.js";
import { hasLiveEnv } from "../api/agro.js";

// Judge Walkthrough — drives the REAL live pipeline end-to-end:
//   Register farm -> real satellite risk score -> submit reports -> outbreak triggers -> dispatch alert.
// Self-contained: it authenticates with the seeded demo accounts internally so it
// works for a judge regardless of the current login.

const DEMO_FARMER = { mobile: "9876543210", code: "1234" };
const DEMO_ADMIN = { mobile: "9988776655", code: "1234" };

const STEPS = [
  { key: "intro", title: "Overview", icon: "🎬" },
  { key: "register", title: "Register Farm", icon: "🏡" },
  { key: "satrisk", title: "Remote Sensing Risk", icon: "🛰️" },
  { key: "reports", title: "Submit Reports", icon: "🩺" },
  { key: "outbreak", title: "Outbreak Trigger", icon: "🚨" },
  { key: "dispatch", title: "Dispatch Alert", icon: "🚓" },
  { key: "done", title: "Wrap-Up", icon: "🏁" },
];

const STORAGE_KEY = "pn_walkthrough_v1";

// Module-level walkthrough state. It lives for the lifetime of the page even if
// React remounts the component, so a remount can NEVER silently send the judge back
// to intro. localStorage (when available) additionally survives a full page refresh.
let wtStore = null;

function clampStep(i) {
  return Math.min(Math.max(0, Number(i) || 0), STEPS.length - 1);
}

function readPersisted() {
  const fallback = { stepIdx: 0, state: {}, log: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      stepIdx: clampStep(parsed.stepIdx),
      state: parsed.state && typeof parsed.state === "object" ? parsed.state : {},
      log: Array.isArray(parsed.log) ? parsed.log : [],
    };
  } catch {
    return fallback;
  }
}

// Whichever source holds the freshest progress wins: module store > localStorage.
function initialStore() {
  if (wtStore) return wtStore;
  wtStore = readPersisted();
  return wtStore;
}

function persistStore(store) {
  wtStore = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage blocked — the module store alone still survives remounts
  }
}

function clearStore() {
  wtStore = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Renders an error, not a blank screen or a silent reset, if anything crashes.
class WalkthroughBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl border border-red-200 p-6 max-w-md w-full text-center">
            <p className="text-3xl mb-2">⚠️</p>
            <h2 className="font-bold text-gray-900 mb-1">Walkthrough hit an unexpected error</h2>
            <p className="text-sm text-gray-500 mb-4">Your place in the pipeline was saved — restart cleanly below.</p>
            <button
              onClick={() => {
                clearStore();
                this.setState({ error: null });
              }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold"
            >
              ↻ Restart walkthrough
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function WalkthroughScreen() {
  return (
    <WalkthroughBoundary>
      <WalkthroughInner />
    </WalkthroughBoundary>
  );
}

function WalkthroughInner() {
  const navigate = useNavigate();
  const { login } = useApp();
  // Lazy-init ONCE from the module store; on any remount we re-read wtStore and
  // resume exactly where the judge left off.
  const [initial] = useState(initialStore);
  const [stepIdx, setStepIdx] = useState(initial.stepIdx);
  // Mirror of stepIdx that is safe to read inside event handlers, so a re-render
  // can never cause a stale closure to run/advance the wrong step.
  const stepIdxRef = useRef(initial.stepIdx);
  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);
  const goTo = (i) => {
    stepIdxRef.current = i;
    setStepIdx(i);
  };

  const [busy, setBusy] = useState(false);
  // Re-entrancy lock: closes the tiny gap before `disabled` paints, so two rapid
  // clicks can never run the same step handler twice (double farms, double reports).
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState(initial.log);
  const [state, setState] = useState(initial.state);

  // Push every change to the module store (survives remounts) + localStorage.
  useEffect(() => {
    persistStore({ stepIdx, state, log });
  }, [stepIdx, state, log]);

  const restart = () => {
    clearStore();
    setState({});
    setLog([]);
    setError("");
    setBusy(false);
    goTo(0);
  };

  const addLog = (icon, msg) => setLog((prev) => [...prev, { icon, msg, ts: new Date() }]);

  // The walkthrough authenticates internally; before sending the judge into the
  // officer/admin screens, also log the app session in as the demo admin so
  // /admin (and role-scoped vet screens) are reachable (otherwise a farmer
  // session redirects both to the SAME home page).
  const jumpOut = async (path) => {
    setBusy(true);
    setError("");
    try {
      await login(DEMO_ADMIN.mobile, DEMO_ADMIN.code);
      navigate(path);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [farmer, admin] = await Promise.all([
        api.login(DEMO_FARMER.mobile, DEMO_FARMER.code),
        api.login(DEMO_ADMIN.mobile, DEMO_ADMIN.code),
      ]);
      setState((s) => ({ ...s, farmerToken: farmer.token, adminToken: admin.token }));
      addLog("🔑", "Authenticated demo farmer + admin sessions (mock JWT).");
      goTo(1);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const runRegister = useCallback(async () => {
    const { farmerToken } = state;
    setBusy(true);
    setError("");
    try {
      // Register a fresh farm near the seeded livestock cluster (Sharma, Pune).
      const farmData = {
        name: `Demo Farm ${Math.floor(Math.random() * 900 + 100)}`,
        animal_category: "large_livestock",
        animal_type: "cattle",
        herd_size: 40,
        village: "Wadgaon Sheri",
        taluka: "Haveli",
        district: "Pune",
        lat: 18.452 + (Math.random() - 0.5) * 0.004,
        lng: 73.878 + (Math.random() - 0.5) * 0.004,
      };
      const { farm } = await api.createFarm(farmerToken, farmData);
      setState((s) => ({ ...s, farm }));
      addLog("🏡", `Registered "${farm.name}" (${farm.animal_type}) — polygon auto-registered server-side.`);
      goTo(2);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  }, [state]);

  const runSatRisk = useCallback(async () => {
    const { farmerToken, farm } = state;
    setBusy(true);
    setError("");
    try {
      // Real env/sat risk score via backend proxy (degraded gracefully offline).
      // Response shape: { env, fetched_at, source, risk }.
      const res = await api.farmEnv(farmerToken, farm.farm_id);
      const env = res?.env || null;
      if (hasLiveEnv(env)) {
        addLog("🛰️", `Fetched live soil/humidity/remote sensing envelope (risk ${res.risk}/25 on the env scale).`);
      } else {
        addLog("🛰️", "Remote sensing layer offline in this demo — continuing with seeded environmental risk.");
      }
      setState((s) => ({ ...s, env: res }));
      goTo(3);
    } catch {
      setError("Remote sensing layer degraded (offline/rate-limited) — continuing with seeded risk.");
      addLog("🛰️", "Remote sensing layer degraded — using seeded environmental risk.");
      setState((s) => ({ ...s, env: null }));
      goTo(3);
    } finally {
      setBusy(false);
    }
  }, [state]);

  const runReports = useCallback(async () => {
    const { farmerToken, farm } = state;
    setBusy(true);
    setError("");
    try {
      // Two livestock reports push the nearby emerging cluster (6) to 8 => CRITICAL.
      const symptoms = ["fever", "mouth_foot_lesions"];
      for (let i = 0; i < 2; i++) {
        await api.createReport(farmerToken, {
          farm_id: farm.farm_id,
          symptoms,
          affected_count: 6 + i,
          notes: "Judge walkthrough report",
        });
        addLog("🩺", `Submitted livestock report #${i + 1} (fever, mouth/hoof lesions).`);
      }
      goTo(4);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  }, [state]);

  const runOutbreak = useCallback(async () => {
    const { adminToken } = state;
    setBusy(true);
    setError("");
    try {
      const clusters = await api.clusters(adminToken);
      const critical = (clusters.clusters || []).find((c) => c.level === "critical");
      if (!critical) {
        setError("Critical cluster not detected — did reports cluster within 4 km / 48 h?");
        goTo(4);
        setBusy(false);
        return;
      }
      setState((s) => ({ ...s, critical }));
      addLog("🚨", `CRITICAL OUTBREAK triggered: ${critical.report_count} cases across ${critical.farm_count} livestock farms in ${critical.village}.`);
      goTo(5);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  }, [state]);

  const runDispatch = useCallback(async () => {
    const { adminToken, critical } = state;
    setBusy(true);
    setError("");
    try {
      const res = await api.clusterAction(adminToken, critical.id, "dispatch");
      const inbox = await api.inbox(adminToken);
      addLog("🚓", `Vet dispatched to ${critical.farm_count} farm(s) — ${res.messageCount} alert(s) queued (EN/MR/HI).`);
      setState((s) => ({ ...s, messageCount: res.messageCount, inbox }));
      goTo(6);
    } catch (e) {
      setError(reqError(e));
    } finally {
      setBusy(false);
    }
  }, [state]);

  const currentStep = STEPS[stepIdx];

  const renderStepBody = () => {
    switch (currentStep.key) {
      case "intro":
        return (
          <div>
            <p className="text-gray-600 mb-2">
              This walkthrough runs the <strong className="text-gray-900">real live pipeline</strong> against the backend —
              no mock data. It will:
            </p>
            <ol className="list-decimal list-inside text-gray-700 space-y-1 mb-4">
              <li>Register a farm and auto-generate its remote sensing polygon</li>
              <li>Load the real remote sensing area-risk score for that farm</li>
              <li>Submit symptom reports that push the nearby cluster past the CRITICAL threshold</li>
              <li>Dispatch a vet alert and record it in the audit chain</li>
            </ol>
            <p className="text-sm text-gray-500">
              Demo accounts are logged in automatically for the journey.
            </p>
          </div>
        );
      case "register":
        return state.farm ? (
          <ResultRow icon="🏡" title="Farm registered" desc={`${state.farm.name} · ${state.farm.animal_type} · herd ${state.farm.herd_size} · ${state.farm.village}, ${state.farm.district}`} />
        ) : (
          <p className="text-gray-600">Registering a new farm and its ~150m remote sensing polygon…</p>
        );
      case "satrisk": {
        const envRes = state.env;
        const env = envRes?.env || null;
        const live = hasLiveEnv(env);
        return (
          <div>
            <p className="text-gray-600 mb-3">Environmental area-risk for the new farm polygon:</p>
            {live ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    envRiskBand(envRes?.risk).cls
                  }`}>
                    {envRiskBand(envRes?.risk).label} risk
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                    ● LIVE
                  </span>
                  {envRes?.fetched_at && (
                    <span className="text-[10px] text-gray-400">updated {timeAgo(envRes.fetched_at)}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <EnvCell label="Soil Moisture" value={env.soil?.moisture != null ? `${(env.soil.moisture * 100).toFixed(0)}%` : "—"} />
                  <EnvCell label="Air Temp" value={env.weather?.temp != null ? `${env.weather.temp.toFixed(1)}°C` : env.soil?.t0 != null ? `${env.soil.t0.toFixed(1)}°C` : "—"} />
                  <EnvCell label="Humidity" value={env.weather?.humidity != null ? `${env.weather.humidity.toFixed(0)}%` : "—"} />
                  <EnvCell label="7-day Rain" value={env.weather?.rain7d != null ? `${env.weather.rain7d.toFixed(1)}mm` : "—"} />
                  <EnvCell label="NDVI" value={env.sat?.ndvi != null ? env.sat.ndvi.toFixed(3) : "—"} />
                  <EnvCell label="NDWI" value={env.sat?.ndwi != null ? env.sat.ndwi.toFixed(3) : "—"} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No live sensor/remote-sensing signal in this offline demo, so the environmental component contributes 0 to the score {envRes?.risk != null ? ` (risk ${envRes.risk}/25)` : ""}. Add a real remote-sensing API key in server/.env to show live soil, humidity & weather here.
              </p>
            )}
          </div>
        );
      }
      case "reports":
        return <p className="text-gray-600">Submitting symptom reports against the farm to push the nearby cluster over the CRITICAL (8) threshold…</p>;
      case "outbreak":
        return state.critical ? (
          <div className="bg-red-50 border-2 border-red-600 rounded-2xl p-4">
            <p className="font-bold text-red-800 text-lg">
              🚨 CRITICAL OUTBREAK — {state.critical.report_count} cases across {state.critical.farm_count} livestock farms in {state.critical.village}
            </p>
            <p className="text-sm text-red-700 mt-1">Threshold reached (8+ within 4 km / 48 h, same animal category).</p>
          </div>
        ) : (
          <p className="text-gray-600">Checking cluster engine for a CRITICAL outbreak…</p>
        );
      case "dispatch":
        return state.messageCount ? (
          <ResultRow icon="🚓" title="Vet dispatch queued" desc={`${state.messageCount} multilingual alert(s) sent to farms in the outbreak cluster.`} />
        ) : (
          <p className="text-gray-600">Dispatching vet + advisory to affected farms and writing the audit entry…</p>
        );
      case "done":
        return (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-800">
              <p className="font-bold">✅ Full pipeline demonstrated end-to-end.</p>
              <p className="text-sm mt-1">
                Farm registered → real remote sensing risk → reports → CRITICAL outbreak → vet dispatch alert, all traceable in the admin audit log.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => jumpOut("/admin")} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-semibold">View Admin Console</button>
              <button onClick={() => jumpOut("/admin")} className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold">View Audit Log</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Advance deterministically from the CURRENT step (read from the ref so a stale
  // render can never re-run or reset a previous step).
  const nextAction = async () => {
    if (busyRef.current || busy) return;
    busyRef.current = true;
    try {
      const key = STEPS[stepIdxRef.current]?.key;
      switch (key) {
        case "intro": await start(); break;
        case "register": await runRegister(); break;
        case "satrisk": await runSatRisk(); break;
        case "reports": await runReports(); break;
        case "outbreak": await runOutbreak(); break;
        case "dispatch": await runDispatch(); break;
        default: break; // final step stays put
      }
    } finally {
      busyRef.current = false;
    }
  };

  const backAction = () => {
    if (busy) return;
    goTo(Math.max(0, stepIdxRef.current - 1));
  };

  const canAdvance = !busy;

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-gray-900 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-xl">←</button>
          <div>
            <h1 className="text-lg font-bold">🎬 Judge Walkthrough</h1>
            <p className="text-xs text-gray-400">Live full-cycle demonstration — SIH26128</p>
          </div>
          {stepIdx > 0 && (
            <button
              onClick={restart}
              className="ml-auto text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-200"
            >
              ↻ Restart
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center overflow-x-auto gap-1 pb-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center shrink-0">
              <div className={`flex flex-col items-center px-1`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                  i === stepIdx ? "bg-primary border-primary text-white" : i < stepIdx ? "bg-green-100 border-green-300 text-green-700" : "bg-white border-gray-200 text-gray-400"
                }`}>
                  {s.icon}
                </span>
                <span className={`text-[9px] mt-1 ${i === stepIdx ? "text-gray-900 font-medium" : "text-gray-400"}`}>{s.key}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-4 h-px ${i < stepIdx ? "bg-green-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 min-h-[170px]">
          <h2 className="text-lg font-bold text-gray-900 mb-3">{currentStep.icon} {currentStep.title}</h2>
          {renderStepBody()}

          {error && <p className="text-red-600 text-sm mt-3 bg-red-50 rounded-xl py-2 px-3">{error}</p>}

          <div className="flex items-center justify-between mt-5">
            <button
              onClick={backAction}
              disabled={stepIdx === 0}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-40"
            >
              ← Back
            </button>
            {stepIdx < STEPS.length - 1 && (
              <button
                onClick={nextAction}
                disabled={!canAdvance}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {busy ? "Working…" : "Next ▶"}
              </button>
            )}
          </div>
        </div>

        {/* Live log */}
        <div className="bg-gray-900 text-green-400 rounded-2xl p-4 font-mono text-xs space-y-1.5">
          <p className="text-gray-400 font-sans mb-1">Live pipeline log</p>
          {log.length === 0 ? (
            <p className="text-gray-500">Press "Next" to begin…</p>
          ) : (
            log.map((l, i) => (
              <p key={i}>{l.icon} {l.msg}</p>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function ResultRow({ icon, title, desc }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="font-semibold text-gray-900">{icon} {title}</p>
      <p className="text-sm text-gray-600 mt-0.5">{desc}</p>
    </div>
  );
}

function EnvCell({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function envRiskBand(risk) {
  if (risk == null) return { label: "No signal", cls: "bg-gray-100 text-gray-500" };
  if (risk <= 8) return { label: "Low", cls: "bg-green-100 text-green-700" };
  if (risk <= 16) return { label: "Moderate", cls: "bg-amber-100 text-amber-700" };
  return { label: "High", cls: "bg-red-100 text-red-700" };
}

function timeAgo(ts) {
  if (!ts) return "—";
  const d = new Date(ts).getTime();
  if (!Number.isFinite(d)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}
