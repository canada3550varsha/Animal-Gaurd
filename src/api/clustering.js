// Spatio-temporal clustering for reports, run SEPARATELY per animal_category.
// Poultry and large-livestock signals are never merged — they are different
// diseases with different response protocols.
//
// Cluster rule: same-category reports within `radiusKm` (4 km) AND within
// `windowHours` (48 h). Thresholds:
//   3+  reports -> "Emerging Cluster"
//   8+  reports -> "CRITICAL OUTBREAK"

export const CLUSTER_RADIUS_KM = 4;
export const CLUSTER_WINDOW_HOURS = 48;
export const EMERGING_THRESHOLD = 3;
export const CRITICAL_THRESHOLD = 8;
export const RING_INNER_KM = 1;
export const RING_OUTER_KM = 5;

function toRad(x) {
  return (x * Math.PI) / 180;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function reportTime(report) {
  const t = new Date(report.created_at).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

// Union-find over same-category reports, joining those within radius + window.
function clusterReports(reports, { radiusKm, windowMs }) {
  const n = reports.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = reports[i];
      const b = reports[j];
      if (a.animal_category !== b.animal_category) continue; // never mix categories
      const timeDiff = Math.abs(reportTime(a) - reportTime(b));
      if (timeDiff > windowMs) continue;
      const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
      if (dist <= radiusKm) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(reports[i]);
  }
  return Array.from(groups.values());
}

// Return clusters with computed centroid + level. Sorted most severe first.
export function detectClusters(reports) {
  const windowMs = CLUSTER_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = reports.filter((r) => reportTime(r) >= Date.now() - windowMs);

  const byCategory = new Map();
  for (const r of recent) {
    if (!byCategory.has(r.animal_category)) byCategory.set(r.animal_category, []);
    byCategory.get(r.animal_category).push(r);
  }

  const clusters = [];
  for (const [, catReports] of byCategory) {
    const groups = clusterReports(catReports, { radiusKm: CLUSTER_RADIUS_KM, windowMs });
    for (const group of groups) {
      if (group.length < EMERGING_THRESHOLD) continue; // below 3 => routine
      const centroid = groupCentroid(group);
      const farms = new Set(group.map((r) => r.farm_id));
      const villages = new Set(group.map((r) => r.village).filter(Boolean));
      clusters.push({
        id: `cl_${centroid.lat.toFixed(4)}_${centroid.lng.toFixed(4)}`,
        animal_category: group[0].animal_category,
        report_count: group.length,
        farm_count: farms.size,
        farms: [...farms],
        village: villages.size ? [...villages].join(", ") : "Unknown",
        centroid,
        reports: group,
        level: group.length >= CRITICAL_THRESHOLD ? "critical" : "emerging",
      });
    }
  }

  const order = { critical: 0, emerging: 1 };
  clusters.sort((a, b) => order[a.level] - order[b.level] || b.report_count - a.report_count);
  return clusters;
}

function groupCentroid(group) {
  let lat = 0;
  let lng = 0;
  for (const r of group) {
    lat += r.lat;
    lng += r.lng;
  }
  return { lat: lat / group.length, lng: lng / group.length };
}

export function isCritical(cluster) {
  return cluster.level === "critical";
}

// English label for the recommended action, tailored to animal_category.
export function recommendedAction(cluster) {
  const used = new Set();
  const firstSymptoms = cluster.reports
    .flatMap((r) => r.symptoms || [])
    .filter((s) => !used.has(s) && used.add(s))
    .slice(0, 3)
    .map((s) => s)
    .join(", ");
  if (cluster.animal_category === "poultry") {
    return `Culling zone assessment for poultry (consider depopulation within 1 km and strict biosecurity). Visible signs: ${firstSymptoms}.`;
  }
  return `Ring-vaccination for livestock within 5 km and movement restrictions. Visible signs: ${firstSymptoms}.`;
}
