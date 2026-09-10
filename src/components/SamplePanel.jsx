import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api, getToken, reqError } from "../api/client.js";
import { DISEASE_CATALOG, SAMPLE_TYPE_LABEL, SAMPLE_STATUS_LABEL, SAMPLE_RESULT_LABEL } from "../data/health.js";

export default function SamplePanel() {
  const { farms } = useApp();
  const [samples, setSamples] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [sampleType, setSampleType] = useState("blood");
  const [disease, setDisease] = useState("");
  const [test, setTest] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // Refresh list after referral (event-driven).
  const load = async () => {
    try {
      const data = await api.samples(getToken());
      setSamples(data.samples || []);
    } catch {
      /* ignore */
    }
  };
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

  const canSubmit = farmId && sampleType;
  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await api.createSample(getToken(), {
        farm_id: farmId,
        sample_type: sampleType,
        suspected_disease: disease.trim() || undefined,
        test_requested: test.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setFarmId("");
      setDisease("");
      setTest("");
      setNotes("");
      setSampleType("blood");
      setOk("Sample collected and referred to the district lab. The lab will return the result to the farm record.");
      await load();
    } catch (err) {
      setError(reqError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="p-4">
        <h3 className="font-semibold mb-3">🧪 Sample Collection &amp; Lab Referral</h3>
        <form onSubmit={submit} className="space-y-3">
          <select
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          >
            <option value="">Select farm…</option>
            {farms.map((f) => (
              <option key={f.farm_id} value={f.farm_id}>{f.name} · {f.village}</option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SAMPLE_TYPE_LABEL).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSampleType(key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  sampleType === key
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
            value={disease}
            onChange={(e) => setDisease(e.target.value)}
            list="disease-catalog"
            placeholder="Suspected disease (e.g. Foot and Mouth Disease)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          />
          <datalist id="disease-catalog">
            {DISEASE_CATALOG.map((d) => <option key={d} value={d} />)}
          </datalist>

          <input
            type="text"
            value={test}
            onChange={(e) => setTest(e.target.value)}
            placeholder="Test requested (e.g. ELISA — FMD serotype panel)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
          />

          {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg py-1.5 px-3">{error}</p>}
          {ok && <p className="text-green-700 text-xs bg-green-50 rounded-lg py-1.5 px-3">{ok}</p>}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full py-2.5 bg-accent text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {busy ? "Referring…" : `🩸 Collect sample → Refer to lab`}
          </button>
        </form>
      </div>

      {/* In-scope samples */}
      {samples.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Referred samples ({samples.length})</p>
          {samples.map((s) => {
            const st = SAMPLE_STATUS_LABEL[s.status];
            const res = SAMPLE_RESULT_LABEL[s.result];
            return (
              <div key={s.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {s.farm_name} · {s.sample_type}
                  </p>
                  {s.status === "resulted" && res ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${res.cls}`}>{res.label}</span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st?.cls}`}>
                      {st?.label || s.status}
                    </span>
                  )}
                </div>
                {(s.suspected_disease || s.test_requested) && (
                  <p className="text-[11px] text-gray-500 mt-1 truncate">
                    {[s.suspected_disease ? `🦠 ${s.suspected_disease}` : null, s.test_requested].filter(Boolean).join(" · ")}
                  </p>
                )}
                {s.resulted_at && s.status === "resulted" && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {res?.label} {s.pathogen ? `· 🦠 ${s.pathogen}` : ""} · {new Date(s.resulted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.lab_name}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}