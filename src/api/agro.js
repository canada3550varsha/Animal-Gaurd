// Agro Monitoring (agromonitoring.com) integration for:
//   - Polygon registration (Phase 2)
//   - Soil data
//   - Satellite imagery (NDVI / NDWI)
//   - Weather / rainfall (OpenWeather, same API key, via centroid)
// All calls are defensive: they return null on any failure so the UI never crashes.

const AGRO_BASE = "https://api.agromonitoring.com/agro/1.0";
const OWM_BASE = "https://api.openweathermap.org/data/2.5";

function apiKey() {
  return import.meta.env.VITE_AGRO_API_KEY || "";
}

function hasKey() {
  return Boolean(apiKey());
}

async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toGeoJsonPolygon(farmId, corners) {
  const closed = [...corners, corners[0]];
  return {
    name: farmId,
    geo_json: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[...closed.map((c) => [c[1], c[0]])]],
      },
    },
  };
}

// 1. Register the farm polygon with Agro API. Returns polygon_id string or null.
export async function registerPolygon(farmId, corners) {
  if (!hasKey()) return null;
  const body = toGeoJsonPolygon(farmId, corners);
  try {
    const res = await fetch(`${AGRO_BASE}/polygons?appid=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id || null;
  } catch {
    return null;
  }
}

// 2. Soil data: { t0, t10, moisture } or null.
export async function fetchSoil(polygonId) {
  if (!hasKey() || !polygonId) return null;
  const data = await safeFetch(`${AGRO_BASE}/soil?polyid=${polygonId}&appid=${apiKey()}`);
  if (data?.moisture === undefined && data?.t0 === undefined) return null;
  return data;
}

// 3. Latest satellite image capture's mean NDVI / NDWI stats, or null.
export async function fetchSatelliteStats(polygonId) {
  if (!hasKey() || !polygonId) return null;
  const now = Date.now();
  const start7 = now - 7 * 24 * 60 * 60 * 1000;
  const search = await safeFetch(
    `${AGRO_BASE}/image/search?start=${start7}&end=${now}&polyid=${polygonId}&appid=${apiKey()}`
  );
  if (!Array.isArray(search) || search.length === 0) return null;
  const mostRecent = search[search.length - 1];
  const statsLink = mostRecent?.stats;
  if (!statsLink) return null;
  const stats = await safeFetch(statsLink);
  if (!stats) return null;
  return {
    date: mostRecent.dt ? new Date(mostRecent.dt * 1000).toISOString() : null,
    ndvi: typeof stats.mean?.ndvi === "number" ? stats.mean.ndvi : null,
    ndwi: typeof stats.mean?.ndwi === "number" ? stats.mean.ndwi : null,
    dswi: typeof stats.mean?.dswi === "number" ? stats.mean.dswi : null,
  };
}

// 4. Rainfall accumulated over last 7 days via OpenWeather.
async function fetchWeatherRain(lat, lng) {
  if (!hasKey() || lat == null || lng == null) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - 7 * 24 * 60 * 60;
  // Historical daily aggregate (default cnt=7 covers last 7 days).
  const hist = await safeFetch(
    `${OWM_BASE}/onecall/timemachine?lat=${lat}&lon=${lng}&dt=${nowSec}&appid=${apiKey()}`
  );
  let accumulated = 0;
  if (hist?.hourly && Array.isArray(hist.hourly)) {
    for (const h of hist.hourly) {
      if (h.dt >= startSec && h.rain && typeof h.rain["1h"] === "number") {
        accumulated += h.rain["1h"];
      }
    }
  }
  // Also pull current weather surface temp if no soil data available.
  const current = await safeFetch(
    `${OWM_BASE}/weather?lat=${lat}&lon=${lng}&appid=${apiKey()}&units=metric`
  );
  const temp = current?.main?.temp ?? null;
  return { rain7d: accumulated, temp };
}

export async function fetchAllEnvData(farm) {
  const [soil, sat, weather] = await Promise.all([
    fetchSoil(farm.polygon_id),
    fetchSatelliteStats(farm.polygon_id),
    fetchWeatherRain(farm.lat, farm.lng),
  ]);
  return { soil, sat, weather };
}

// ---- Environmental risk computation (0-25) ----
function scale(value, min, max) {
  if (value == null) return null;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

function computeEnvRisk(env) {
  let total = 0;
  let weightSum = 0;

  // Low NDVI -> stressed vegetation -> higher risk (sub score up to 9)
  if (typeof env.sat?.ndvi === "number") {
    // NDVI typical range for cropland ~ [-0.1, 0.9]. Lower NDVI = worse.
    const ndviScore = (1 - scale(env.sat.ndvi, -0.1, 0.9)) * 9;
    total += ndviScore;
    weightSum += 9;
  }

  // High NDWI / DSWI -> standing water / moisture -> vector breeding (up to 6)
  const waterIndex =
    typeof env.sat?.dswi === "number" ? env.sat.dswi : env.sat?.ndwi;
  if (typeof waterIndex === "number") {
    const waterScore = scale(waterIndex, -0.5, 0.5) * 6;
    total += Math.max(0, waterScore);
    weightSum += 6;
  }

  // High soil moisture + high recent rainfall (up to 6)
  if (typeof env.soil?.moisture === "number") {
    const moistureScore = scale(env.soil.moisture, 0, 1) * 4;
    total += moistureScore;
    weightSum += 4;
    if (env.weather && env.weather.rain7d != null) {
      // Rainfall adds on top of moisture (combined driver of standing water)
      const rainScore = Math.min(2, scale(env.weather.rain7d, 0, 60) * 2);
      total += rainScore;
      weightSum += 2;
    }
  }

  // Surface temperature outside normal seasonal band (up to 4)
  const temp = env.soil?.t0 ?? env.weather?.temp;
  if (typeof temp === "number") {
    // Normal band ~ 15-35°C; deviations add risk.
    const lowDev = Math.max(0, 15 - temp);
    const highDev = Math.max(0, temp - 35);
    const dev = Math.max(lowDev, highDev);
    const tempScore = Math.min(4, (dev / 15) * 4);
    total += tempScore;
    weightSum += 4;
  }

  if (weightSum === 0) return null;
  const normalized = (total / weightSum) * 25;
  return Math.round(Math.min(25, Math.max(0, normalized)));
}

export { computeEnvRisk };

// ---- HistoricalRisk per taluka (0-20, seeded) ----
const TALUKA_HISTORICAL_RISK = {
  "Haveli": 7,
  "Mulshi": 5,
  "Maval": 6,
  "Nagpur Rural": 9,
  "Katol": 8,
  "Ahmednagar": 4,
  "Parner": 3,
};

export function historicalRiskFor(taluka) {
  return TALUKA_HISTORICAL_RISK[taluka] ?? 4;
}

// ---- Full FDRS (0-100) ----
export function computeFDRS({ reportedCases = 0, historical = 0, env = 0, nearby = 0 }) {
  return Math.round(
    Math.min(100, Math.max(0, reportedCases + historical + env + nearby))
  );
}

// ---- ReportedCases (0-35) from reports within the last `days` days ----
// Combines the number of affected animals with the severity of the reported
// symptoms, so a severe, high-count outbreak scores much higher than a routine single case.
export function computeReportedCases(reports, { days = 7, max = 35, severityById = {} } = {}) {
  if (!Array.isArray(reports) || reports.length === 0) return 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = reports.filter((r) => {
    const t = r.created_at ? new Date(r.created_at).getTime() : Date.now();
    return t >= cutoff;
  });

  let score = 0;
  for (const r of recent) {
    const count = Number(r.affected_count) || 0;
    // Severity = max severity among the report's symptoms.
    const symptomSeverities = (r.symptoms || []).map((s) => severityById[s] || 1);
    const maxSev = symptomSeverities.length ? Math.max(...symptomSeverities) : 1;
    // Volume factor grows with count but plateaus.
    const volume = Math.min(3, 1 + count / 10);
    // If the AI confidence is very low, temper severity slightly (optional signal).
    const confidence = Number(r.confidence);
    const confidenceFactor =
      Number.isFinite(confidence) && confidence > 0 ? 0.5 + (confidence / 100) * 0.5 : 1;
    score += maxSev * volume * confidenceFactor;
  }
  return Math.round(Math.min(max, score));
}

export function fdrsBand(score) {
  if (score <= 40) return { label: "Low", color: "#16a34a", bg: "bg-green-100", text: "text-green-800", bar: "bg-green-500" };
  if (score <= 70) return { label: "Moderate", color: "#ca8a04", bg: "bg-yellow-100", text: "text-yellow-800", bar: "bg-yellow-500" };
  return { label: "High", color: "#dc2626", bg: "bg-red-100", text: "text-red-800", bar: "bg-red-500" };
}

// True only when the env envelope actually carries live numeric readings.
// (An env object full of nulls means the remote-sensing layer is offline.)
export function hasLiveEnv(env) {
  if (!env) return false;
  const sat = env.sat || {};
  const soil = env.soil || {};
  const w = env.weather || {};
  const readings = [sat.ndvi, sat.ndwi, sat.dswi, soil.moisture, soil.t0, w.temp, w.rain7d];
  return readings.some((v) => typeof v === "number");
}
