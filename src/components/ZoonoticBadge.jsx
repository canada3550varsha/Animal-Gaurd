// Zoonotic-risk badge — shown wherever a report/cluster is flagged ⚠️ zoonotic
// (HPAI / anthrax / brucellosis). `compact` renders just the chip; otherwise the
// human-health advisory line is included too (outbreak contexts).
const ZOONOTIC_ADVISORY_EN =
  "Human-health alert: this disease can spread to people. Wear gloves and a mask, avoid raw milk/carcass contact, keep children away, and notify the nearest Primary Health Centre immediately.";

const diseaseNames = (item) =>
  (item?.zoonotic_diseases || [])
    .map((d) => (typeof d === "string" ? d : d.name))
    .filter(Boolean);

export default function ZoonoticBadge({ item, compact = false }) {
  if (!(item && item.zoonotic)) return null;
  const names = diseaseNames(item);
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
        ⚠️ ZOONOTIC{names.length > 0 ? ` · ${names.join(", ")}` : ""}
      </span>
      {!compact && (
        <p className="text-[11px] leading-snug text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
          {ZOONOTIC_ADVISORY_EN}
        </p>
      )}
    </div>
  );
}