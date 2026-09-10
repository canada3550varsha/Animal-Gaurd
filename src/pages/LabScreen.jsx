import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, reqError } from "../api/client.js";
import { SAMPLE_TYPE_LABEL, SAMPLE_RESULT_LABEL } from "../data/health.js";

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ResultForm({ sample, onDone }) {
  const [result, setResult] = useState("");
  const [pathogen, setPathogen] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!result || saving) return;
    setSaving(true);
    setError("");
    try {
      await api.recordSampleResult(getToken(), sample.id, {
        result,
        pathogen: pathogen.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(reqError(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-gray-50 rounded-xl p-3 mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600">Record laboratory result</p>
      <div className="flex gap-2">
        {["positive", "negative"].map((r) => (
          <label
            key={r}
            className={`flex-1 text-center py-2 rounded-lg border-2 cursor-pointer text-sm font-medium ${
              result === r
                ? r === "positive"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            <input type="radio" name="result" value={r} checked={result === r} onChange={() => setResult(r)} className="hidden" />
            {SAMPLE_RESULT_LABEL[r].label}
          </label>
        ))}
      </div>
      <input
        type="text"
        value={pathogen}
        onChange={(e) => setPathogen(e.target.value)}
        placeholder="Pathogen detected (e.g. Pasteurella multocida) — optional"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
      />
      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Remarks / recommendations (optional)"
        rows={2}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none"
      />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={!result || saving}
        className="w-full py-2 bg-gray-900 text-white font-semibold rounded-lg text-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Return result to farm"}
      </button>
    </form>
  );
}

export default function LabScreen() {
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  // Refresh after recording a result (event-driven, not in effect).
  const refresh = useCallback(async () => {
    try {
      const data = await api.samples(getToken());
      setSamples(data.samples || []);
      setError("");
    } catch (err) {
      setError(reqError(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .samples(getToken())
      .then((data) => {
        if (!active) return;
        setSamples(data.samples || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(reqError(err));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pending = samples.filter((s) => s.status === "awaiting_result");
  const resulted = samples.filter((s) => s.status === "resulted");

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-gray-900 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-xl">←</button>
            <div>
              <h1 className="text-lg font-bold">🔬 District Veterinary Laboratory</h1>
              <p className="text-xs text-gray-400">Sample inbox — record test results, returned to farm records</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Pending queue */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pending results ({pending.length})
          </h2>
          {!loading && pending.length === 0 && (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-100">No samples awaiting result.</p>
          )}
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {s.farm_name || s.farm_id}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {SAMPLE_TYPE_LABEL[s.sample_type]?.label} · collected {fmt(s.collected_at)}
                    </p>
                    {(s.suspected_disease || s.test_requested) && (
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {s.suspected_disease ? `🦠 ${s.suspected_disease}` : ""}
                        {s.suspected_disease && s.test_requested ? " · " : ""}
                        {s.test_requested}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    className="shrink-0 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800"
                  >
                    {openId === s.id ? "Cancel" : "Record result"}
                  </button>
                </div>
                {openId === s.id && <ResultForm sample={s} onDone={() => { setOpenId(null); refresh(); }} />}
              </div>
            ))}
          </div>
        </section>

        {/* Returned results */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Returned results ({resulted.length})
          </h2>
          <div className="space-y-2">
            {resulted.slice().map((s) => {
              const res = SAMPLE_RESULT_LABEL[s.result];
              return (
                <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {s.farm_name || s.farm_id}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${res?.cls}`}>
                      {res ? res.label : s.result}
                    </span>
                  </div>
                  {s.pathogen && <p className="text-[11px] text-gray-600 mt-1">🦠 {s.pathogen}</p>}
                  {(s.suspected_disease || s.remarks) && (
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      {s.suspected_disease ? `Suspected ${s.suspected_disease}. ` : ""}
                      {s.remarks || ""}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">Result returned {fmt(s.resulted_at)} · {s.lab_name}</p>
                </div>
              );
            })}
          </div>
        </section>

        {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}
      </main>
    </div>
  );
}