import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import ZoonoticBadge from "../components/ZoonoticBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS, SYMPTOMS } from "../data/constants.js";
import { fmtTime } from "../data/format.js";

const SYMPTOM_LABEL = Object.fromEntries(
  Object.values(SYMPTOMS)
    .flat()
    .map((s) => [s.id, s.label])
);

export default function MyReportsScreen() {
  const { reports, farms } = useApp();
  const farmById = new Map(farms.map((f) => [f.farm_id, f]));

  const ordered = reports
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const manual = ordered.filter((r) => r.source !== "ai_auto");
  const ai = ordered.filter((r) => r.source === "ai_auto");
  const deaths7 = reports
    .filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000)
    .reduce((s, r) => s + (Number(r.deaths) || 0), 0);
  const affected = reports.reduce((s, r) => s + (Number(r.affected_count) || 0), 0);

  return (
    <AppShell title="My Reports" subtitle="Everything reported from your farms">
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="📄" iconBg="bg-blue-100" label="Reports" value={ordered.length} tone="ink" sub={`${manual.length} manual · ${ai.length} AI-sensed`} />
          <Stat icon="🩹" iconBg="bg-red-100" label="Animals affected" value={affected} tone={affected > 0 ? "amber" : "ink"} sub="across all reports" />
          <Stat icon="⚰️" iconBg="bg-gray-100" label="Deaths (7d)" value={deaths7} tone={deaths7 > 0 ? "red" : "ink"} sub="reported with your submissions" />
        </div>

        <section>
          <SectionTitle icon="📄">All reports ({ordered.length})</SectionTitle>
          {ordered.length === 0 ? (
            <EmptyState icon="🩺" title="No reports yet" sub="Report symptoms from any of your farms using the voice or form report." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map((r) => {
                const f = farmById.get(r.farm_id);
                const emoji = ANIMAL_ICONS[r.animal_category]?.[r.animal_type] || "🐾";
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {emoji} {f?.name || r.farm_name}
                      </p>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          {r.affected_count || 0} affected
                        </span>
                        {(Number(r.deaths) || 0) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-white font-medium">
                            ⚰️ {r.deaths}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {CATEGORY_LABELS[r.animal_category]} · {r.village}, {r.district} · {fmtTime(r.created_at)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.source === "ai_auto" ? (
                        <span className="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                          🛰️ AI-sensed
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-medium">
                          ✍️ Manual
                        </span>
                      )}
                      {(r.symptoms || []).map((s) => (
                        <span key={s} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                          {SYMPTOM_LABEL[s] || s}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5">
                      <ZoonoticBadge item={r} compact />
                    </div>
                    {r.notes && <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{r.notes}</p>}
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