import { useState, useEffect, useCallback } from "react";
import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../../components/ui/primitives.jsx";
import { api, getToken, reqError } from "../../api/client.js";
import { SAMPLE_TYPE_LABEL, SAMPLE_RESULT_LABEL, SAMPLE_STATUS_LABEL } from "../../data/health.js";
import { fmtDate } from "../../data/format.js";

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

// Privacy-correct sample card: the lab sees case/sample references, animal &
// sample info, the referring officer and village — never the farmer's name.
function SampleCard({ s, showResultForm = false, defaultOpen = false, onResult }) {
  const [open, setOpen] = useState(defaultOpen);
  const res = SAMPLE_RESULT_LABEL[s.result];
  const st = SAMPLE_STATUS_LABEL[s.status];
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {SAMPLE_TYPE_LABEL[s.sample_type]?.label || s.sample_type} sample
            {s.case_id && <span className="ml-1.5 text-[10px] font-normal text-gray-400">case {s.case_id}</span>}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {s.referring_vet ? `From ${s.referring_vet} (vet)` : "referring officer listed"} · {s.village || "village n/a"} · collected {fmtDate(s.collected_at)}
          </p>
          {(s.suspected_disease || s.test_requested) && (
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {s.suspected_disease ? `🦠 ${s.suspected_disease}` : ""}
              {s.suspected_disease && s.test_requested ? " · " : ""}
              {s.test_requested}
            </p>
          )}
        </div>
        {s.status === "resulted" && res ? (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${res.cls}`}>{res.label}</span>
        ) : (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st?.cls}`}>{st?.label || s.status}</span>
        )}
      </div>

      {s.status === "resulted" ? (
        <div className="mt-2">
          {s.pathogen && <p className="text-[11px] text-gray-600">🦠 {s.pathogen}</p>}
          {(s.suspected_disease || s.remarks) && (
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
              {s.suspected_disease ? `Suspected ${s.suspected_disease}. ` : ""}
              {s.remarks || ""}
            </p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            Result returned {fmtDate(s.resulted_at)} · {s.lab_name} {s.resulted_by ? `· by ${s.resulted_by}` : ""}
          </p>
        </div>
      ) : (
        <>
          {showResultForm && (
            <button
              onClick={() => setOpen(!open)}
              className="mt-2 shrink-0 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800"
            >
              {open ? "Cancel" : "Record result"}
            </button>
          )}
          {open && (
            <ResultForm
              sample={s}
              onDone={() => {
                setOpen(false);
                onResult?.();
              }}
            />
          )}
        </>
      )}
      {s.notes && !s.resulted_at && <p className="text-[10px] text-gray-400 mt-2 leading-snug">📝 {s.notes}</p>}
    </div>
  );
}

export default function LabSamplesScreen({ mode = "inbox", title = "District Veterinary Laboratory", subtitle = "" }) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const list =
    mode === "inbox"
      ? pending
      : mode === "results"
        ? resulted.slice().reverse()
        : samples.slice().sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));

  return (
    <AppShell title={title} subtitle={subtitle || "Referred samples · results returned to farm records"}>
      <div className="mx-auto max-w-3xl space-y-6">
        <PrivacyNotice role="lab" />

        {/* KPI summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="🧪" iconBg="bg-amber-100" label="Pending results" value={pending.length} tone="amber" sub="awaiting laboratory result" />
          <Stat icon="🔬" iconBg="bg-green-100" label="Result returned" value={resulted.length} tone="green" sub="returned to farm records" />
          <Stat icon="🧫" iconBg="bg-gray-100" label="Total samples" value={samples.length} tone="ink" sub="referred to this lab" />
        </div>

        <section>
          <SectionTitle icon={mode === "inbox" ? "📥" : mode === "results" ? "🔬" : "🧾"}>
            {mode === "inbox" ? `Pending results (${pending.length})` : mode === "results" ? `Returned results (${resulted.length})` : `All referred samples (${samples.length})`}
          </SectionTitle>
          {!loading && list.length === 0 && (
            <EmptyState
              icon={mode === "inbox" ? "📭" : "🧪"}
              title={mode === "inbox" ? "Inbox clear" : "Nothing here yet"}
              sub={mode === "inbox" ? "No samples awaiting result." : "Samples referred by the veterinary team will appear here."}
            />
          )}
          <div className="space-y-2">
            {list.map((s) => (
              <SampleCard key={s.id} s={s} showResultForm={mode === "inbox"} onResult={refresh} />
            ))}
          </div>
        </section>

        {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}
      </div>
    </AppShell>
  );
}