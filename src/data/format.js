// Shared formatters — one set across all role screens.

export function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "—";
  }
}

export function fmtShortDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function fmtNum(v) {
  return typeof v === "number" ? Number(v).toFixed(3) : "—";
}

export function fmtCel(v) {
  if (typeof v !== "number") return "—";
  const c = v > 150 ? v - 273.15 : v; // remote sensors return Kelvin soil/air temps
  return `${c.toFixed(1)}°C`;
}

export function fmtMoisture(v) {
  if (typeof v !== "number") return "—";
  // volumetric fraction (0..1) from the soil probe -> readout as %
  const pct = v <= 1 ? v * 100 : v;
  return `${Math.round(pct)}%`;
}

export function timeAgo(ts) {
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