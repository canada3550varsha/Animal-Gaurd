import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api, getToken, reqError } from "../api/client.js";
import { VACCINE_CATALOG, DISEASE_CATALOG, DRIVE_STATUS_LABEL } from "../data/health.js";
import { CATEGORY_LABELS } from "../data/constants.js";

const CATEGORIES = ["large_livestock", "small_livestock", "poultry"];
const today = () => new Date().toISOString().slice(0, 10);
const in30 = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function DrivesPanel() {
  const { user } = useApp();
  const [drives, setDrives] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    disease: "",
    vaccine: "",
    taluka: user?.taluka || "",
    district: user?.district || "Pune",
    animal_category: "large_livestock",
    start_date: today(),
    end_date: in30(),
    status: "planned",
  });

  const refresh = () =>
    api
      .drives(getToken())
      .then(({ drives }) => setDrives(drives || []))
      .catch((e) => setErr(reqError(e)));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!form.name.trim()) return setErr("Drive name is required");
    if (!form.district.trim()) return setErr("District is required");
    setBusy(true);
    try {
      await api.createDrive(getToken(), {
        ...form,
        start_date: form.start_date ? new Date(`${form.start_date}T00:00:00`).toISOString() : undefined,
        end_date: form.end_date ? new Date(`${form.end_date}T00:00:00`).toISOString() : undefined,
      });
      setOk(`🚀 Drive "${form.name}" launched — target pool & coverage are now live ✅`);
      setForm((f) => ({ ...f, name: "", vaccine: "", disease: "" }));
      await refresh();
    } catch (ex) {
      setErr(reqError(ex));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (drive, status) => {
    setErr("");
    setOk("");
    try {
      await api.updateDriveStatus(getToken(), drive.drive_id, status);
      setOk(`Drive "${drive.name}" marked ${status.toUpperCase()}`);
      await refresh();
    } catch (ex) {
      setErr(reqError(ex));
    }
  };

  const activeDrives = drives.filter((d) => d.status === "active");

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 leading-snug">
        A drive is a planned mass-vaccination campaign (disease × vaccine × region × animal category).
        Target farms are auto-picked from the region; coverage is live from the health ledger, split by
        farm, animal and village — so a gap (e.g. "Undri lagging") is visible the moment it happens.
      </p>

      <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600">Drive name</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. FMD Drive — Haveli Monsoon 2026"
              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Target disease</label>
            <input list="drv-diseases" value={form.disease} onChange={(e) => set("disease", e.target.value)} placeholder="e.g. Foot and Mouth Disease" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Vaccine used</label>
            <input list="drv-vaccines" value={form.vaccine} onChange={(e) => set("vaccine", e.target.value)} placeholder="e.g. FMD Trivalent Vaccine" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
        </div>
        <datalist id="drv-diseases">
          {DISEASE_CATALOG.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <datalist id="drv-vaccines">
          {VACCINE_CATALOG.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">District</label>
            <input value={form.district} onChange={(e) => set("district", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Taluka (optional)</label>
            <input value={form.taluka} onChange={(e) => set("taluka", e.target.value)} placeholder="All talukas if empty" className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Animal category</label>
            <select value={form.animal_category} onChange={(e) => set("animal_category", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Start</label>
            <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Planned end</label>
            <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Launch as</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
              <option value="planned">Planned</option>
              <option value="active">Active (start now)</option>
            </select>
          </div>
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}
        {ok && <p className="text-xs text-green-700">{ok}</p>}

        <button type="submit" disabled={busy} className="w-full bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-800 disabled:opacity-50">
          {busy ? "Launching…" : "🚀 Launch Drive"}
        </button>
        <p className="text-[11px] text-gray-400">Created by {user?.name} ({user?.role})</p>
      </form>

      <div className="space-y-3">
        {drives.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
            No drives yet. Launch the first one above.
          </div>
        )}
        {drives.map((d) => {
          const cov = d.coverage || {};
          const sx = DRIVE_STATUS_LABEL[d.status] || DRIVE_STATUS_LABEL.planned;
          return (
            <div key={d.drive_id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{d.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {d.disease || "—"} · {d.vaccine || "—"}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    📍 {d.taluka || "All talukas"}, {d.district} · {CATEGORY_LABELS[d.animal_category] || d.animal_category}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${sx.cls}`}>{sx.label.toUpperCase()}</span>
              </div>

              {cov.overdue && d.status !== "completed" && (
                <p className="text-[11px] text-red-600 font-medium mt-2">⚠ Past planned end with coverage gaps</p>
              )}

              <div className="mt-3 space-y-2">
                <CovBar label={`Farm coverage · ${cov.covered_farm_count ?? 0}/${cov.target_farm_count ?? 0} farms`} pct={cov.farm_coverage_pct ?? 0} />
                <CovBar label={`Animal coverage · ${cov.target_animal_count ?? 0} herd target`} pct={cov.animal_coverage_pct ?? 0} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {(cov.villages || []).map((v) => (
                  <span key={v.village} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${v.pct >= 50 ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                    {v.village} {v.covered}/{v.target} · {v.pct}%
                  </span>
                ))}
              </div>

              {(cov.still_to_do || []).length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-amber-800">🎯 Still to vaccinate ({cov.still_to_do.length})</p>
                  <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                    {cov.still_to_do.map((f) => `${f.name} (${f.village})`).join(" · ")}
                  </p>
                </div>
              )}

              <div className="mt-3 text-[11px] text-gray-400">
                📅 {fmtDate(d.start_date)} → {fmtDate(d.end_date)}
              </div>

              {d.status === "planned" && (
                <button onClick={() => setStatus(d, "active")} className="mt-3 w-full bg-green-700 text-white text-xs font-semibold py-2 rounded-xl hover:bg-green-800">
                  ▶ Start drive
                </button>
              )}
              {d.status === "active" && (
                <button onClick={() => setStatus(d, "completed")} className="mt-3 w-full border border-green-700 text-green-700 text-xs font-bold py-2 rounded-xl hover:bg-green-50">
                  ✓ Mark completed · {cov.farm_coverage_pct}% farm coverage
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeDrives.length > 0 && (
        <p className="text-[11px] text-gray-400">
          While recording a vaccination in the Health Ledger tab, select the active drive to count it toward coverage automatically.
        </p>
      )}
    </div>
  );
}

function CovBar({ label, pct }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold text-gray-900">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full transition-all ${pct >= 70 ? "bg-green-600" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}