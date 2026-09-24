import { useEffect, useState } from "react";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { SAMPLE_TYPE_LABEL, SAMPLE_RESULT_LABEL, SAMPLE_STATUS_LABEL } from "../data/health.js";
import { fmtDate } from "../data/format.js";
import { T } from "../data/i18n.js";

export default function MyLabResultsScreen() {
  const { farms, lang } = useApp();
  const [samples, setSamples] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .samples(getToken())
      .then(({ samples }) => active && setSamples(samples || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const ordered = samples.slice().sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));
  const resulted = ordered.filter((s) => s.status === "resulted");
  const pending = ordered.filter((s) => s.status === "awaiting_result");
  const positive = resulted.filter((s) => s.result === "positive");

  const farmById = new Map(farms.map((f) => [f.farm_id, f]));

  return (
    <AppShell title={T(lang, "Lab Results")} subtitle={T(lang, "Sample & test results for your herds")}>
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="🧪" iconBg="bg-amber-100" label="In lab" value={pending.length} tone="amber" sub="awaiting result" />
          <Stat icon="🔬" iconBg="bg-green-100" label="Results returned" value={resulted.length} tone="green" sub="back on farm records" />
          <Stat icon="🦠" iconBg="bg-red-100" label="Positive findings" value={positive.length} tone={positive.length > 0 ? "red" : "ink"} sub="pathogen confirmed" />
        </div>

        <section>
          <SectionTitle icon="🧪">Your samples &amp; results ({ordered.length})</SectionTitle>
          {ordered.length === 0 ? (
            <EmptyState icon="🧫" title="No samples yet" sub="When the veterinary team collects a sample from your herd, its lab result appears here." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {ordered.map((s) => {
                const res = SAMPLE_RESULT_LABEL[s.result];
                const st = SAMPLE_STATUS_LABEL[s.status];
                const f = farmById.get(s.farm_id);
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {SAMPLE_TYPE_LABEL[s.sample_type]?.label || s.sample_type} sample
                        {f ? ` · ${f.name}` : ""}
                      </p>
                      {s.status === "resulted" && res ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${res.cls}`}>{res.label}</span>
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st?.cls}`}>{st?.label || s.status}</span>
                      )}
                    </div>
                    {(s.suspected_disease || s.test_requested) && (
                      <p className="text-[11px] text-gray-500 mt-1 truncate">
                        {[s.suspected_disease ? `🦠 Suspected ${s.suspected_disease}` : null, s.test_requested].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {s.status === "resulted" && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        Result: {res ? res.label : s.result}
                        {s.pathogen ? ` · 🦠 Pathogen: ${s.pathogen}` : ""}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      Collected {fmtDate(s.collected_at)}
                      {s.resulted_at ? ` · Result ${fmtDate(s.resulted_at)}` : ""}
                      {" · "}{s.lab_name}
                    </p>
                    {s.remarks && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{s.remarks}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}