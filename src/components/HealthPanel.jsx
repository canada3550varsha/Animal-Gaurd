import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api, getToken, reqError } from "../api/client.js";
import {
  HEALTH_TYPES,
  healthIcon,
  healthLabel,
  VACCINE_CATALOG,
  DRUG_CATALOG,
  DISEASE_CATALOG,
} from "../data/health.js";
import DrivesPanel from "./DrivesPanel.jsx";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export default function HealthPanel({ limit = 10 }) {
  const { farms, user } = useApp();
  const [tab, setTab] = useState("ledger");
  const [records, setRecords] = useState([]);
  const [drives, setDrives] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    farm_id: farms[0]?.farm_id || "",
    record_type: "vaccination",
    name: "",
    disease: "",
    dose: "",
    batch: "",
    date: new Date().toISOString().slice(0, 10),
    animals: "",
    drive_id: "",
    notes: "",
  });

  const refresh = () =>
    Promise.all([api.health(getToken()), api.drives(getToken())])
      .then(([{ records }, drivesData]) => {
        setRecords(records || []);
        setDrives(drivesData.drives || []);
      })
      .catch((e) => setErr(reqError(e)));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalog = useMemo(
    () =>
      form.record_type === "vaccination"
        ? VACCINE_CATALOG
        : form.record_type === "deworming"
          ? DRUG_CATALOG.filter((d) => d.toLowerCase().includes("deworm") || d.includes("Fenbendazole") || d.includes("Albendazole") || d.includes("Ivermectin"))
          : form.record_type === "treatment"
            ? DRUG_CATALOG
            : [],
    [form.record_type]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!form.farm_id) return setErr("Select a farm first");
    if (!form.name.trim()) return setErr("Vaccine/drug name is required");
    setSaving(true);
    try {
      const { record } = await api.createHealth(getToken(), {
        ...form,
        date: form.date ? new Date(`${form.date}T00:00:00`).toISOString() : undefined,
        notes: form.notes.trim() || undefined,
        animals: form.animals ? Number(form.animals) : undefined,
        drive_id: form.drive_id || undefined,
      });
      setOk(`${healthIcon(record.record_type)} ${healthLabel(record.record_type)} recorded for ${record.name} ✅`);
      setForm((f) => ({ ...f, name: "", disease: "", dose: "", batch: "", notes: "", animals: "", drive_id: "" }));
      await refresh();
    } catch (ex) {
      setErr(reqError(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab("ledger")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            tab === "ledger" ? "bg-green-700 text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          📋 Health Ledger
        </button>
        <button
          onClick={() => setTab("drives")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            tab === "drives" ? "bg-green-700 text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          💉 Vaccination Drives
        </button>
      </div>

      {tab === "drives" ? (
        <DrivesPanel />
      ) : (
      <>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        💉 Vaccination & Treatment — Health Ledger
      </h2>
      <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-snug">
        Every vaccination, treatment, deworming and mortality event is recorded here against the herd,
        appears instantly on the farm's health chart, and lands in the tamper-evident audit trail.
        Link vaccinations to an active drive to count them toward live coverage.
      </p>

      <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 space-y-3">
        {/* Farm */}
        <div>
          <label className="text-xs font-semibold text-gray-600">Farm (herd)</label>
          <select
            value={form.farm_id}
            onChange={(e) => set("farm_id", e.target.value)}
            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
          >
            <option value="">— Select farm —</option>
            {farms.map((f) => (
              <option key={f.farm_id} value={f.farm_id}>
                {f.name} · {f.village} ({f.animal_category}/{f.animal_type})
              </option>
            ))}
          </select>
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap gap-1.5">
          {HEALTH_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set("record_type", t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                form.record_type === t.value
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Name + disease */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">
              {form.record_type === "vaccination" ? "Vaccine" : form.record_type === "treatment" ? "Drug / treatment" : form.record_type === "deworming" ? "Dewormer" : "Cause / note"}
            </label>
            <input
              list={form.record_type === "mortality" ? undefined : "health-catalog"}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={form.record_type === "mortality" ? "e.g. sudden death ×3" : "Start typing…"}
              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
            />
          </div>
          {form.record_type !== "mortality" && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Target disease</label>
              <input
                list="health-diseases"
                value={form.disease}
                onChange={(e) => set("disease", e.target.value)}
                placeholder="e.g. FMD"
                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
          )}
        </div>
        <datalist id="health-catalog">
          {catalog.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="health-diseases">
          {DISEASE_CATALOG.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {/* Dose / batch / date / notes */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Dose</label>
            <input value={form.dose} onChange={(e) => set("dose", e.target.value)} placeholder="e.g. 2 ml/animal" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Batch no.</label>
            <input value={form.batch} onChange={(e) => set("batch", e.target.value)} placeholder="e.g. FMD-2609-A" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
        </div>

        {form.record_type === "vaccination" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-600">Animals covered</label>
              <input
                type="number"
                min="1"
                value={form.animals}
                onChange={(e) => set("animals", e.target.value)}
                placeholder="e.g. 45"
                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Count toward drive (optional)</label>
              <select
                value={form.drive_id}
                onChange={(e) => set("drive_id", e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
              >
                <option value="">— No drive —</option>
                {drives
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <option key={d.drive_id} value={d.drive_id}>
                      {d.name} ({d.disease || "—"})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-gray-600">Notes</label>
          <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Animals covered, route, follow-up needed…" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}
        {ok && <p className="text-xs text-green-700">{ok}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : `➕ Record ${healthLabel(form.record_type)}`}
        </button>
        <p className="text-[11px] text-gray-400">
          Recorded by {user?.name} ({user?.role})
        </p>
      </form>

      <div className="space-y-2">
        {records.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
            No health records yet. Record the first vaccination above, or run a drive and tick farms as covered.
          </div>
        )}
        {records.slice(0, limit).map((r) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-start gap-3">
            <div className="text-xl">{healthIcon(r.record_type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {r.name}
                  <span className="ml-2 text-[11px] font-normal text-gray-500 uppercase">{healthLabel(r.record_type)}</span>
                </p>
                <p className="text-[11px] text-gray-400 shrink-0">{fmtDate(r.date || r.ts)}</p>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {r.farm_name} · {r.village || "—"} · {r.animal_category || ""}
                {r.disease ? ` · 🎯 ${r.disease}` : ""}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {[r.dose, r.batch && `Batch ${r.batch}`, r.notes].filter(Boolean).join(" · ") || "—"}
              </p>
              {r.drive_name && (
                <p className="text-[11px] text-green-700 font-medium mt-1">📋 {r.drive_name}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </section>
  );
}