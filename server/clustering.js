// Server-side spatio-temporal clustering + risk scoring.
// Mirrors the frontend logic but runs where the data (PII) actually lives.

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

export function detectClusters(reports) {
  const windowMs = CLUSTER_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = reports.filter((r) => reportTime(r) >= Date.now() - windowMs);
  const byCategory = new Map();
  for (const r of recent) {
    if (!byCategory.has(r.animal_category)) byCategory.set(r.animal_category, []);
    byCategory.get(r.animal_category).push(r);
  }

  const clusters = [];
  for (const [cat, catReports] of byCategory) {
    const n = catReports.length;
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
        const a = catReports[i];
        const b = catReports[j];
        const timeDiff = Math.abs(reportTime(a) - reportTime(b));
        if (timeDiff > windowMs) continue;
        const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
        if (dist <= CLUSTER_RADIUS_KM) union(i, j);
      }
    }
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(catReports[i]);
    }
    for (const group of groups.values()) {
      if (group.length < EMERGING_THRESHOLD) continue;
      let lat = 0;
      let lng = 0;
      for (const r of group) {
        lat += r.lat;
        lng += r.lng;
      }
      const centroid = { lat: lat / group.length, lng: lng / group.length };
      const farms = new Set(group.map((r) => r.farm_id));
      const villages = new Set(group.map((r) => r.village).filter(Boolean));
      const seen = new Set();
      const symptoms = group
        .flatMap((r) => r.symptoms || [])
        .filter((s) => !seen.has(s) && seen.add(s))
        .slice(0, 3);
      const affected_animals = group.reduce((s, r) => s + (Number(r.affected_count) || 0), 0);
      const first_report_at = group.reduce((m, r) => Math.min(m, reportTime(r)), Number.MAX_SAFE_INTEGER);
      const last_report_at = group.reduce((m, r) => Math.max(m, reportTime(r)), 0);
      clusters.push({
        id: `cl_${centroid.lat.toFixed(4)}_${centroid.lng.toFixed(4)}`,
        animal_category: cat,
        report_count: group.length,
        farm_count: farms.size,
        farms: [...farms],
        village: villages.size ? [...villages].join(", ") : "Unknown",
        centroid,
        reports: group.map((r) => r.id),
        symptoms,
        affected_animals,
        first_report_at: new Date(first_report_at).toISOString(),
        last_report_at: new Date(last_report_at).toISOString(),
        level: group.length >= CRITICAL_THRESHOLD ? "critical" : "emerging",
      });
    }
  }
  const order = { critical: 0, emerging: 1 };
  clusters.sort((a, b) => order[a.level] - order[b.level] || b.report_count - a.report_count);
  return clusters;
}

export function recommendedAction(cluster) {
  const symptomList =
    cluster.symptoms && cluster.symptoms.length ? cluster.symptoms.join(", ") : "reported signs";
  if (cluster.animal_category === "poultry") {
    return `Culling zone assessment for poultry (consider depopulation within 1 km and strict biosecurity). Visible signs: ${symptomList}.`;
  }
  return `Ring-vaccination for livestock within 5 km and movement restrictions. Visible signs: ${symptomList}.`;
}

// Historical risk per taluka (0-20).
const TALUKA_HISTORICAL_RISK = {
  Haveli: 7,
  Mulshi: 5,
  Maval: 6,
  "Nagpur Rural": 9,
  Katol: 8,
  Ahmednagar: 4,
  Parner: 3,
};
export function historicalRiskFor(taluka) {
  return TALUKA_HISTORICAL_RISK[taluka] ?? 4;
}

// ReportedCases (0-35) from 7-day reports for a farm.
export function computeReportedCases(reports, severityById, { days = 7, max = 35 } = {}) {
  if (!Array.isArray(reports) || reports.length === 0) return 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = reports.filter((r) => reportTime(r) >= cutoff);
  let score = 0;
  for (const r of recent) {
    const count = Number(r.affected_count) || 0;
    const symptomSeverities = (r.symptoms || []).map((s) => severityById[s] || 1);
    const maxSev = symptomSeverities.length ? Math.max(...symptomSeverities) : 1;
    const volume = Math.min(3, 1 + count / 10);
    const confidence = Number(r.confidence);
    const confidenceFactor = Number.isFinite(confidence) && confidence > 0 ? 0.5 + (confidence / 100) * 0.5 : 1;
    score += maxSev * volume * confidenceFactor;
  }
  return Math.round(Math.min(max, score));
}

// Environmental risk (0-25) from real env data.
export function computeEnvRisk(env) {
  let total = 0;
  let weightSum = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const scale01 = (v, min, max) => (clamp(v, min, max) - min) / (max - min);

  if (typeof env?.sat?.ndvi === "number") {
    // NDVI (cropland) ~ [-0.1, 0.9]; lower = stressed vegetation = higher risk (up to 9)
    const ndviScore = (1 - scale01(env.sat.ndvi, -0.1, 0.9)) * 9;
    total += ndviScore;
    weightSum += 9;
  }
  const waterIndex = typeof env?.sat?.dswi === "number" ? env.sat.dswi : env?.sat?.ndwi;
  if (typeof waterIndex === "number") {
    // High water index => standing water => vector breeding (up to 6)
    const waterScore = Math.max(0, scale01(waterIndex, -0.5, 0.5)) * 6;
    total += waterScore;
    weightSum += 6;
  }
  if (typeof env?.soil?.moisture === "number") {
    // High soil moisture + high 7-day rainfall (up to 4 + 2)
    total += clamp(env.soil.moisture, 0, 1) * 4;
    weightSum += 4;
    if (env?.weather && env.weather.rain7d != null) {
      total += Math.min(2, scale01(env.weather.rain7d, 0, 60) * 2);
      weightSum += 2;
    }
  }
  const temp = env?.soil?.t0 ?? env?.weather?.temp;
  if (typeof temp === "number") {
    // Deviation outside ~15-35C seasonal band => higher risk (up to 4)
    const dev = Math.max(0, 15 - temp, temp - 35);
    total += Math.min(4, (dev / 15) * 4);
    weightSum += 4;
  }
  if (weightSum === 0) return null;
  return Math.round(Math.min(25, Math.max(0, (total / weightSum) * 25)));
}

export function computeFDRS({ reportedCases = 0, historical = 0, env = 0, nearby = 0 } = {}) {
  return Math.round(Math.min(100, Math.max(0, reportedCases + historical + env + nearby)));
}

// Severity map shared with client's whitelist.
export const SEVERITY_BY_ID = {
  fever: 5,
  mouth_foot_lesions: 8,
  lameness: 4,
  reduced_milk: 3,
  nasal_discharge: 3,
  sudden_death: 10,
  egg_drop: 3,
  respiratory_distress: 6,
  diarrhea: 4,
  ruffled_feathers: 2,
  swollen_head: 7,
  mass_mortality: 10,
};

// Symptom whitelist per animal_category (validated server-side).
export const SYMPTOMS_BY_CATEGORY = {
  large_livestock: [
    "fever", "mouth_foot_lesions", "lameness", "reduced_milk", "nasal_discharge", "sudden_death",
  ],
  poultry: [
    "egg_drop", "respiratory_distress", "diarrhea", "ruffled_feathers", "swollen_head", "mass_mortality",
  ],
};
