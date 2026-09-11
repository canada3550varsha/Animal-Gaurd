import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api, getToken, reqError } from "../api/client.js";

const LEVEL_META = {
  officer: { icon: "🏛️", label: "District Officer", cls: "bg-indigo-100 text-indigo-700" },
  referral: { icon: "🏥", label: "Dispensary Referral", cls: "bg-teal-100 text-teal-700" },
  hospital: { icon: "🚑", label: "Vet Hospital", cls: "bg-rose-100 text-rose-700" },
};

const STATUS_META = {
  escalated: { label: "Escalated", cls: "bg-red-600 text-white" },
  acknowledged: { label: "Acknowledged", cls: "bg-amber-500 text-white" },
  in_progress: { label: "In progress", cls: "bg-blue-600 text-white" },
  follow_up: { label: "Follow-up", cls: "bg-purple-600 text-white" },
  resolved: { label: "Resolved", cls: "bg-green-600 text-white" },
};

const STATUS_CHAIN = ["escalated", "acknowledged", "in_progress", "follow_up", "resolved"];

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " " + new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function EscalationPanel({ clusters = [] }) {
  const { user } = useApp();
  const [escalations, setEscalations] = useState([]);
  const [openClusterId, setOpenClusterId] = useState(null);
  const [level, setLevel] = useState("officer");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    try {
      const data = await api.escalations(getToken());
      setEscalations(data.escalations || []);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    let active = true;
    api
      .escalations(getToken())
      .then((data) => active && setEscalations(data.escalations || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const submit = async (clusterId) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api.escalateCluster(getToken(), clusterId, {
        level,
        target: target.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setOpenClusterId(null);
      setTarget("");
      setNotes("");
      setLevel("officer");
      setOk("Escalation raised — the district officer console now shows the case for follow-up.");
      await load();
    } catch (err) {
      setError(reqError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (esc, status) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.escalationStatus(getToken(), esc.id, { status });
      await load();
    } catch (err) {
      setError(reqError(err));
    } finally {
      setBusy(false);
    }
  };

  const actionable = clusters.filter((c) => c.level === "critical" || c.level === "emerging");
  const openEsc = escalations.filter((e) => e.status !== "resolved");
  const resolvedEsc = escalations.filter((e) => e.status === "resolved");
  const activeClusterIds = new Set(actionable.map((c) => c.id));
  const raisedIds = new Set(escalations.map((e) => e.cluster_id));

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">🔺 Case Escalation Ladder</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            {openEsc.length} open · {resolvedEsc.length} resolved
          </span>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg py-1.5 px-3 mb-2">{error}</p>}
        {ok && <p className="text-green-700 text-xs bg-green-50 rounded-lg py-1.5 px-3 mb-2">{ok}</p>}

        {/* Raise new escalation from an active cluster */}
        <div>
          <select
            value={openClusterId || ""}
            onChange={(e) => {
              setOpenClusterId(e.target.value || null);
              setError("");
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          >
            <option value="">Escalate a cluster… ({actionable.length} active)</option>
            {actionable
              .filter((c) => !raisedIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.level === "critical" ? "🚨 CRITICAL" : "⚠️ EMERGING"} — {c.village} · {c.report_count} cases
                </option>
              ))}
          </select>

          {openClusterId && (
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600">Referral level</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(LEVEL_META).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLevel(key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      level === key
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {meta.icon} {meta.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`Target (default: ${Object.values(LEVEL_META)[0].label})`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason / recommended action (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => submit(openClusterId)}
                disabled={busy}
                className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {busy ? "Escalating…" : "🚨 Escalate to district / refer case"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Open cases with follow-up status chain */}
      {openEsc.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Open escalations ({openEsc.length})</p>
          {openEsc.map((e) => {
            const lm = LEVEL_META[e.level];
            const sm = STATUS_META[e.status];
            const idx = STATUS_CHAIN.indexOf(e.status);
            return (
              <div key={e.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {lm?.icon || "🔺"} {e.village} · {e.report_count} cases
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${sm?.cls}`}>{sm?.label}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 truncate">→ {e.target}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {e.farm_count} farm(s) · {e.affected_animals} affected · {e.animal_category}
                </p>
                {e.notes && <p className="text-[11px] text-gray-600 mt-1 leading-snug">📝 {e.notes}</p>}
                <p className="text-[10px] text-gray-400 mt-1">Raised {fmt(e.raised_at)}</p>

                {/* Follow-up status chain */}
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {STATUS_CHAIN.map((st, i) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateStatus(e, st)}
                      disabled={busy}
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors disabled:opacity-60 ${
                        i === idx ? STATUS_META[st].cls : i < idx ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {STATUS_META[st].label}
                    </button>
                  ))}
                </div>
                {e.timeline?.length > 1 && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Last: {STATUS_META[e.timeline[e.timeline.length - 1].status].label} · {fmt(e.updated_at)} · {user?.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent resolved */}
      {resolvedEsc.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Resolved ({resolvedEsc.length})</p>
          {resolvedEsc.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
              <p className="text-gray-600 truncate">
                {LEVEL_META[e.level]?.icon || "🔺"} {e.village} · {e.report_count} cases → {e.target}
              </p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-600 text-white font-semibold shrink-0">Resolved</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}