import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_USERS,
  USER_BY_MOBILE,
  SEED_FARMS,
  SEED_REPORTS,
  SEED_HEALTH,
  SEED_DRIVES,
  SEED_SAMPLES,
} from "./seed.js";
import {
  detectClusters,
  recommendedAction,
  haversineKm,
  historicalRiskFor,
  computeReportedCases,
  computeEnvRisk,
  computeFDRS,
  SEVERITY_BY_ID,
  SYMPTOMS_BY_CATEGORY,
  RING_INNER_KM,
  RING_OUTER_KM,
} from "./clustering.js";
import { appendAudit, verifyAudit } from "./audit.js";
import {
  evaluateSync,
  topRisk,
  buildAutoReport,
  AUTO_TRIGGER_SCORE,
  AUTO_COOLDOWN_MS,
} from "./diseaseModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");

// Load server/.env regardless of which directory the server was started from
// (npm run server runs from the repo root; dotenv/config alone would read a
// root .env instead and silently leave AGRO_API_KEY empty).
dotenv.config({ path: join(__dirname, ".env") });

// ---------- Secrets: server-side only ----------
const JWT_SECRET = process.env.JWT_SECRET || "demo-insecure-secret";
const AGRO_API_KEY = process.env.AGRO_API_KEY || "";
const VISION_API_KEY = process.env.VISION_API_KEY || "";
const VISION_BASE_URL = (process.env.VISION_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

const AGRO_BASE = "https://api.agromonitoring.com/agro/1.0";
const OWM_BASE = "https://api.openweathermap.org/data/2.5";

// ---------- Persistence (JSON files, server-side; PII never leaves the server) ----------
function loadJson(file, fallback) {
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) {
    writeJson(file, fallback);
    return JSON.parse(JSON.stringify(fallback));
  }
  return JSON.parse(readFileSync(p, "utf8"));
}
function writeJson(file, data) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

let DB = {
  users: loadJson("users.json", SEED_USERS),
  farms: loadJson("farms.json", SEED_FARMS),
  reports: loadJson("reports.json", SEED_REPORTS),
  inbox: loadJson("inbox.json", []),
  audit: loadJson("audit.json", []),
  // Raw sensing log: one row per farm per scheduled Agro poll, independent of alerts.
  sensing_readings: loadJson("sensing_readings.json", []),
  // Herd-level health ledger: vaccinations, treatments, deworming, mortality events.
  health: loadJson("health.json", SEED_HEALTH),
  // Vaccination drives: planned mass-vaccination campaigns with live coverage.
  drives: loadJson("drives.json", SEED_DRIVES),
  // Lab samples: referrals from vet to district laboratory + returned results.
  samples: loadJson("samples.json", SEED_SAMPLES),
};
const persist = () => {
  writeJson("users.json", DB.users);
  writeJson("farms.json", DB.farms);
  writeJson("reports.json", DB.reports);
  writeJson("inbox.json", DB.inbox);
  writeJson("audit.json", DB.audit);
  writeJson("sensing_readings.json", DB.sensing_readings);
  writeJson("health.json", DB.health);
  writeJson("drives.json", DB.drives);
  writeJson("samples.json", DB.samples);
};

// ---------- Express setup ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const now = () => Date.now();

// ---------- Session auth ----------
function signToken(user) {
  // Mock JWT. Claims: roles + scope. Never includes phone number.
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      district: user.district || null,
      taluka: user.taluka || null,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authentication token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = DB.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid session" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// Farmers can only act on/see their own farms.
function canAccessFarm(farm, user) {
  if (user.role === "admin") return true;
  if (user.role === "vet") {
    return !farm.district || farm.district === user.district;
  }
  // farmer
  return farm.user_id === user.id;
}

// ---------- Input validation ----------
const NOTES_MAX = 500;
const NAME_MAX = 80;
const VALID_CATEGORY_TYPES = {
  large_livestock: ["cattle", "buffalo", "goat", "sheep"],
  poultry: ["chicken", "duck", "turkey"],
};

function validAnimalType(category, type) {
  return VALID_CATEGORY_TYPES[category]?.includes(type) || false;
}
function validCoord(v, min, max) {
  return Number.isFinite(v) && v >= min && v <= max;
}

function validateFarm(body) {
  const { name, animal_category, animal_type, herd_size, lat, lng } = body || {};
  const errors = [];
  if (typeof name !== "string" || !name.trim()) errors.push("name is required");
  else if (name.trim().length > NAME_MAX) errors.push("name too long");
  if (!["large_livestock", "poultry"].includes(animal_category)) errors.push("invalid animal_category");
  if (!validAnimalType(animal_category, animal_type)) errors.push("invalid animal_type for category");
  if (!Number.isInteger(herd_size) || herd_size < 1 || herd_size > 100000) errors.push("invalid herd_size");
  if (!validCoord(lat, -90, 90) || !validCoord(lng, -180, 180)) errors.push("coordinates out of range");
  for (const f of ["village", "taluka", "district"]) {
    if (typeof body?.[f] !== "string" || !body[f]) errors.push(`${f} is required`);
    else if (body[f].length > 80) errors.push(`${f} too long`);
  }
  return errors;
}

function validateReport(body, farm) {
  const { symptoms, affected_count, notes, deaths } = body || {};
  const errors = [];
  const allowed = new Set(SYMPTOMS_BY_CATEGORY[farm.animal_category] || []);
  if (!Array.isArray(symptoms) || symptoms.length === 0) errors.push("symptoms required");
  else {
    for (const s of symptoms) {
      if (typeof s !== "string" || !allowed.has(s)) errors.push(`invalid symptom: ${s}`);
    }
    if (new Set(symptoms).size !== symptoms.length) errors.push("duplicate symptoms");
  }
  if (!Number.isInteger(affected_count) || affected_count < 0 || affected_count > farm.herd_size)
    errors.push("affected_count out of range");
  if (deaths !== undefined) {
    const maxDeaths = Number.isInteger(affected_count) ? Math.min(affected_count, farm.herd_size) : farm.herd_size;
    if (!Number.isInteger(deaths) || deaths < 0 || deaths > maxDeaths)
      errors.push("deaths out of range (0..affected)");
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > NOTES_MAX))
    errors.push("notes too long or invalid");
  return errors;
}

// ---------- Rate limiting: cap report submissions per farm per hour ----------
const REPORT_RATE_PER_HOUR = 5;
const reportWindows = new Map(); // farm_id -> [{ts}]
function reportRateLimited(farmId) {
  const cutoff = now() - 60 * 60 * 1000;
  const list = (reportWindows.get(farmId) || []).filter((t) => t >= cutoff);
  if (list.length >= REPORT_RATE_PER_HOUR) return true;
  list.push(now());
  reportWindows.set(farmId, list);
  return false;
}

// ---------- Third-party proxy helpers (server-side only) ----------
async function safeJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function generatePolygon(lat, lng, radiusMeters = 150) {
  const R = 6371000;
  const dLat = (radiusMeters / R) * (180 / Math.PI);
  const dLng = (radiusMeters / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];
}

async function registerPolygon(farmId, polygon) {
  if (!AGRO_API_KEY || !polygon) return null;
  const closed = [...polygon, polygon[0]];
  const body = {
    name: farmId,
    geo_json: {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...closed.map((c) => [c[1], c[0]])]] },
    },
  };
  try {
    const res = await fetch(`${AGRO_BASE}/polygons?appid=${AGRO_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      // Agro dedupes by geometry: if the exact polygon already exists it returns
      // 422 and names the existing polygon id. Adopt it (idempotent re-run).
      const existing = txt.match(/already existed polygon '([0-9a-f]{16,})'/i);
      if (existing) return existing[1];
      console.warn(`[env] polygon register failed: HTTP ${res.status} ${res.statusText} — ${txt.slice(0, 140)}`);
      return null;
    }
    const data = await res.json();
    return data?.id || null;
  } catch (err) {
    console.warn(`[env] polygon register error: ${String(err).slice(0, 140)}`);
    return null;
  }
}

async function fetchSoil(polygonId) {
  if (!AGRO_API_KEY || !polygonId) return null;
  return safeJson(`${AGRO_BASE}/soil?polyid=${polygonId}&appid=${AGRO_API_KEY}`);
}
async function fetchSatelliteStats(polygonId) {
  if (!AGRO_API_KEY || !polygonId) return null;
  // Agro expects SECONDS even on /image/search (ms timestamps -> HTTP 400
  // "start can not be after now, end can not be after now").
  const nowSec = Math.floor(now() / 1000);
  const startSec = nowSec - 7 * 24 * 60 * 60;
  const search = await safeJson(
    `${AGRO_BASE}/image/search?start=${startSec}&end=${nowSec}&polyid=${polygonId}&appid=${AGRO_API_KEY}`
  );
  if (!Array.isArray(search) || search.length === 0) return null;
  const latest = search[search.length - 1];
  if (!latest?.stats) return null;
  const date = latest.dt ? new Date(latest.dt * 1000).toISOString() : null;

  // New schema: image.stats = { ndvi: <url>, ndwi: <url>, dswi: <url>, … }
  // — one stats URL per band, each returning { mean: <number>, … }.
  // Legacy schema: image.stats = <single url>|object returning { mean:{ ndvi,… } }.
  const bandMean = async (url) => {
    if (!url) return null;
    const stats = await safeJson(url);
    if (!stats) return null;
    if (typeof stats.mean === "number") return stats.mean;
    if (stats.mean && typeof stats.mean?.value === "number") return stats.mean.value;
    return null;
  };

  let ndvi = null;
  let ndwi = null;
  let dswi = null;
  if (typeof latest.stats === "object" && !Array.isArray(latest.stats) && typeof latest.stats.ndvi === "string") {
    [ndvi, ndwi, dswi] = await Promise.all([
      bandMean(latest.stats.ndvi),
      bandMean(latest.stats.ndwi),
      bandMean(latest.stats.dswi),
    ]);
  } else {
    const data = typeof latest.stats === "string" ? await safeJson(latest.stats) : latest.stats;
    const m = data?.mean;
    ndvi = typeof m?.ndvi === "number" ? m.ndvi : null;
    ndwi = typeof m?.ndwi === "number" ? m.ndwi : null;
    dswi = typeof m?.dswi === "number" ? m.dswi : null;
  }

  return { date, ndvi, ndwi, dswi };
}
// Current weather + 7-day rainfall. Primary source is Agro Monitoring's /weather
// endpoint (same key as OpenWeather, no extra subscription). Rainfall uses the farm
// polygon's Agro history or the OWM time-machine when available; stays null otherwise.
async function fetchWeatherCurrent(lat, lng, polygonId) {
  if (!AGRO_API_KEY || lat == null || lng == null) return null;
  const nowSec = Math.floor(now() / 1000);
  const startSec = nowSec - 7 * 24 * 60 * 60;
  const agroCurrent = await safeJson(`${AGRO_BASE}/weather?lat=${lat}&lon=${lng}&appid=${AGRO_API_KEY}`);
  let temp = agroCurrent?.main?.temp ?? null;
  let humidity = agroCurrent?.main?.humidity ?? null;

  let rain7d = null;
  if (polygonId) {
    const hist = await safeJson(
      `${AGRO_BASE}/weather/history?polyid=${polygonId}&start=${startSec}&end=${nowSec}&appid=${AGRO_API_KEY}`
    );
    if (hist?.hourly && Array.isArray(hist.hourly)) {
      let acc = 0;
      for (const h of hist.hourly) {
        if (h.dt >= startSec && h.rain && typeof h.rain["1h"] === "number") acc += h.rain["1h"];
      }
      rain7d = acc;
    }
  }
  if (rain7d == null) {
    const hist = await safeJson(
      `${OWM_BASE}/onecall/timemachine?lat=${lat}&lon=${lng}&dt=${nowSec}&appid=${AGRO_API_KEY}`
    );
    if (hist?.hourly && Array.isArray(hist.hourly)) {
      let acc = 0;
      for (const h of hist.hourly) {
        if (h.dt >= startSec && h.rain && typeof h.rain["1h"] === "number") acc += h.rain["1h"];
      }
      rain7d = acc;
    }
  }
  if (temp == null || humidity == null) {
    const cur = await safeJson(`${OWM_BASE}/weather?lat=${lat}&lon=${lng}&appid=${AGRO_API_KEY}&units=metric`);
    temp = temp ?? cur?.main?.temp ?? null;
    humidity = humidity ?? cur?.main?.humidity ?? null;
  }
  return { rain7d, temp, humidity };
}

const ENV_CACHE_TTL_MS = 10 * 60 * 1000; // refresh live readings every 10 minutes
// farm_id -> { env, fetchedAt, source, risk, reading }
const envCache = new Map();
function hasLiveReading(env) {
  if (!env) return false;
  const s = env.sat || {};
  const soil = env.soil || {};
  const w = env.weather || {};
  return [s.ndvi, s.ndwi, s.dswi, soil.moisture, soil.t0, w.temp, w.rain7d, w.humidity].some(
    (v) => typeof v === "number"
  );
}

// Raw sensing log row — this is the source of truth records, NOT an alert. One row
// is appended for every actual Agro poll regardless of whether anything fired.
//   success -> live numeric readings captured
//   pending -> poll attempted but no fresh satellite/soil pass yet
//   failed  -> the poll itself errored
function addSensingReading(farm, { env, status }) {
  const reading = {
    id: `sr_${now()}_${Math.random().toString(36).slice(2, 7)}`,
    farm_id: farm.farm_id,
    ndvi: env?.sat?.ndvi ?? null,
    soil_temp: env?.soil?.t0 ?? env?.weather?.temp ?? null,
    soil_moisture: env?.soil?.moisture ?? null,
    fetched_at: new Date().toISOString(),
    fetch_status: status, // "success" | "pending" | "failed"
  };
  DB.sensing_readings.push(reading);
  return reading;
}

async function fetchEnv(farm, { force = false } = {}) {
  const cached = envCache.get(farm.farm_id);
  if (cached && !force && now() - cached.fetchedAt < ENV_CACHE_TTL_MS) return cached;
  if (!farm.polygon_id) {
    const env = null;
    const reading = addSensingReading(farm, { env, status: "pending" });
    const offline = { env, fetchedAt: now(), source: "offline", risk: null, reading: reading.id };
    envCache.set(farm.farm_id, offline);
    persist();
    return offline;
  }
  try {
    const [soil, sat, weather] = await Promise.all([
      fetchSoil(farm.polygon_id),
      fetchSatelliteStats(farm.polygon_id),
      fetchWeatherCurrent(farm.lat, farm.lng, farm.polygon_id),
    ]);
    const env = { soil, sat, weather };
    const live = hasLiveReading(env);
    const status = live ? "success" : "pending";
    const reading = addSensingReading(farm, { env, status });
    const result = {
      env,
      fetchedAt: now(),
      source: live ? "live" : "offline",
      risk: live ? computeEnvRisk(env) : null,
      reading: reading.id,
    };
    envCache.set(farm.farm_id, result);
    persist();
    return result;
  } catch (err) {
    const reading = addSensingReading(farm, { env: null, status: "failed" });
    const result = { env: null, fetchedAt: now(), source: "offline", risk: null, reading: reading.id };
    envCache.set(farm.farm_id, result);
    persist();
    console.warn(`[sensing] poll failed for ${farm.farm_id}: ${String(err).slice(0, 120)}`);
    return result;
  }
}

const VISION_CATEGORY_ANIMALS = {
  large_livestock: "cattle, buffalo, goat, or sheep",
  poultry: "chicken, duck, or turkey",
};
const VISION_CATEGORY_SIGNS = {
  large_livestock: [
    "fever / elevated temperature",
    "lesions on the mouth or hooves",
    "lameness or difficulty standing",
    "reduced milk yield",
    "nasal discharge or drooling",
    "lethargy or sudden death",
  ],
  poultry: [
    "drop in egg production",
    "respiratory distress or gasping",
    "diarrhea or pasty vent",
    "ruffled feathers or weakness",
    "swollen head/comb",
    "sudden mass mortality",
  ],
};
async function analyzePhoto(buffer, mimetype, animalCategory) {
  if (!VISION_API_KEY || !buffer) return null;
  // Reject non-image types before touching the vision API.
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(mimetype)) return null;
  if (buffer.length > 5 * 1024 * 1024) return null;
  const dataUrl = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const signs = (VISION_CATEGORY_SIGNS[animalCategory] || []).map((s) => `- ${s}`).join("\n");
  const prompt = [
    `You are a veterinary field assistant. Look at the photo of a sick ${VISION_CATEGORY_ANIMALS[animalCategory] || "animal"}.`,
    `Assess only visible disease signs relevant to this species. Signs to look for:`,
    signs,
    ``,
    `Return JSON with exactly two keys: "description" (plain-language, 2-4 sentences) and "confidence" (integer 0-100).`,
    `If the image is not a clear animal photo, set confidence low and describe what you see.`,
  ].join("\n");
  try {
    const res = await fetch(`${VISION_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${VISION_API_KEY}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if (!parsed) return null;
    const confidence = Math.round(Math.min(100, Math.max(0, Number(parsed.confidence) || 0)));
    return { description: String(parsed.description || content).trim(), confidence };
  } catch {
    return null;
  }
}

// ---------- Derived data (computed server-side from server-owned data) ----------
function computeAllClusters() {
  return detectClusters(DB.reports);
}

function computeNearbyOutbreak(farm) {
  const criticals = computeAllClusters().filter((c) => c.level === "critical");
  let nearby = 0;
  let ringInfo = null;
  for (const c of criticals) {
    if (c.animal_category !== farm.animal_category) continue;
    const dist = haversineKm(farm.lat, farm.lng, c.centroid.lat, c.centroid.lng);
    if (dist <= RING_OUTER_KM) {
      const score = dist <= RING_INNER_KM
        ? 20
        : Math.round(20 * (1 - (dist - RING_INNER_KM) / (RING_OUTER_KM - RING_INNER_KM)));
      if (score > nearby) {
        nearby = Math.min(20, score);
        ringInfo = { dist };
      }
    }
  }
  return { nearby, ringInfo };
}

function computeFdrs(farm) {
  const envEntry = envCache.get(farm.farm_id);
  const envRisk = envEntry?.env ? computeEnvRisk(envEntry.env) : null;
  const reported = computeReportedCases(
    DB.reports.filter((r) => r.farm_id === farm.farm_id),
    SEVERITY_BY_ID
  );
  const { nearby } = computeNearbyOutbreak(farm);
  const env = envRisk ?? null;
  const total = computeFDRS({
    reportedCases: reported,
    historical: historicalRiskFor(farm.taluka),
    env: env ?? 0,
    nearby,
  });
  return { reportedCases: reported, historical: historicalRiskFor(farm.taluka), env, nearby, total };
}

function sanitizeUserForClient(user) {
  // Never send PII like phone to the client.
  return { id: user.id, name: user.name, role: user.role, district: user.district, taluka: user.taluka };
}

function visibleFarms(user) {
  return DB.farms.filter((f) => canAccessFarm(f, user));
}

// ================= ROUTES =================

// Lean uptime check for keep-alive monitors (UptimeRobot etc.) — no auth, no DB
// reads, no heavy work, so a 5-minute ping is cheap and instant.
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "AnimalGuard", uptime_sec: Math.round(process.uptime()), ts: new Date().toISOString() });
});

// Auth: mock JWT on login (4-digit OTP accepted for demo)
app.post("/api/auth/login", (req, res) => {
  const { mobile, code } = req.body || {};
  if (typeof mobile !== "string" || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: "Valid 10-digit mobile required" });
  }
  if (typeof code !== "string" || !/^\d{4}$/.test(code)) {
    return res.status(400).json({ error: "Valid 4-digit code required" });
  }
  const user = USER_BY_MOBILE[mobile] || Object.values(DB.users).find((u) => u.mobile === mobile);
  if (!user) return res.status(401).json({ error: "Unknown mobile number" });
  // Demo: any 4-digit code accepted.
  const token = signToken(user);
  res.json({ token, user: sanitizeUserForClient(user) });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: sanitizeUserForClient(req.user) });
});

// Farms
app.post("/api/farms", authRequired, async (req, res) => {
  const errors = validateFarm(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const farm = {
    farm_id: `farm_${Date.now()}`,
    user_id: req.user.role === "farmer" ? req.user.id : req.body.user_id || req.user.id,
    name: req.body.name.trim(),
    animal_category: req.body.animal_category,
    animal_type: req.body.animal_type,
    herd_size: req.body.herd_size,
    village: req.body.village.trim(),
    taluka: req.body.taluka.trim(),
    district: req.body.district.trim(),
    lat: req.body.lat,
    lng: req.body.lng,
    polygon_id: null,
  };
  DB.farms.push(farm);
  persist();
  // Register polygon server-side (fire and forget).
  registerPolygon(farm.farm_id, generatePolygon(farm.lat, farm.lng)).then((pid) => {
    if (pid) {
      farm.polygon_id = pid;
      persist();
    }
  });
  DB.audit = appendAudit(DB.audit, req.user.id, "register_farm", {
    farm_id: farm.farm_id,
    farm_name: farm.name,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    animal_category: farm.animal_category,
    animal_type: farm.animal_type,
    herd_size: farm.herd_size,
  });
  persist();
  res.status(201).json({ farm: sanitizeFarm(farm, req.user) });
});

app.get("/api/farms", authRequired, async (req, res) => {
  const visible = visibleFarms(req.user);
  res.json({ farms: visible.map((f) => sanitizeFarm(f, req.user)) });
});

app.get("/api/farms/:id", authRequired, async (req, res) => {
  const farm = DB.farms.find((f) => f.farm_id === req.params.id);
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });
  res.json({ farm: sanitizeFarm(farm, req.user) });
});

app.get("/api/farms/:id/env", authRequired, async (req, res) => {
  const farm = DB.farms.find((f) => f.farm_id === req.params.id);
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });
  const force = req.query.refresh === "1";
  const result = await fetchEnv(farm, { force });
  res.json({
    env: result.env,
    fetched_at: result.fetchedAt,
    source: result.source,
    risk: result.risk,
    sensing_reading_id: result.reading || null,
    // Location-based disease prediction from this farm's live sensing envelope.
    // An honest null: predictions require real readings, never fabricated.
    diseases:
      result.source === "live" && result.env
        ? evaluateSync(result.env, farm.animal_category)
        : null,
  });
});

// Live sensing data — one latest row per in-scope farm (role-filtered), never
// merged with AI alerts or manual reports. Farmers see only their own farms.
app.get("/api/sensing", authRequired, (req, res) => {
  const scoped = visibleFarms(req.user);
  const latestById = new Map();
  for (const s of DB.sensing_readings) {
    const prev = latestById.get(s.farm_id);
    if (!prev || s.fetched_at > prev.fetched_at) latestById.set(s.farm_id, s);
  }
  const rows = scoped.map((f) => ({
    farm: {
      farm_id: f.farm_id,
      name: f.name,
      animal_category: f.animal_category,
      animal_type: f.animal_type,
      village: f.village,
      taluka: f.taluka,
      district: f.district,
    },
    reading: latestById.get(f.farm_id) || null,
  }));
  res.json({ rows, built_at: new Date().toISOString() });
});

// A single raw reading (used by the AI-alert "View source sensing data" view).
app.get("/api/sensing/:id", authRequired, (req, res) => {
  const s = DB.sensing_readings.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "Reading not found" });
  const farm = DB.farms.find((f) => f.farm_id === s.farm_id);
  if (!farm || !canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });
  res.json({ reading: s });
});

function sanitizeFarm(farm, user) {
  // Vet/admin can see exact GPS; farmers only see coarse village info + their own coords.
  return {
    farm_id: farm.farm_id,
    name: farm.name,
    animal_category: farm.animal_category,
    animal_type: farm.animal_type,
    herd_size: farm.herd_size,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    lat: user.role === "farmer" && farm.user_id !== user.id ? null : farm.lat,
    lng: user.role === "farmer" && farm.user_id !== user.id ? null : farm.lng,
    polygon_id: user.role === "admin" ? farm.polygon_id : null,
    owner: farm.user_id === user.id || user.role !== "farmer",
    fdrs: computeFdrs(farm),
  };
}

// Reports (validated + rate-limited + photo via server-side vision)
async function parseReportSymptoms(r) {
  if (Array.isArray(r)) return r;
  if (typeof r === "string") {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }
  return null;
}

app.post("/api/reports", authRequired, upload.single("photo"), async (req, res) => {
  const { farm_id, affected_count, notes, deaths } = req.body;
  const symptoms = await parseReportSymptoms(req.body.symptoms);
  const farm = DB.farms.find((f) => f.farm_id === farm_id);
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });

  const errors = validateReport(
    { ...req.body, symptoms, affected_count: affected_count === undefined ? undefined : Number(affected_count), deaths: deaths === undefined || deaths === "" ? undefined : Number(deaths) },
    farm
  );
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  if (reportRateLimited(farm_id)) {
    return res.status(429).json({ error: `Rate limit: max ${REPORT_RATE_PER_HOUR} reports per farm per hour` });
  }

  let vision = null;
  if (req.file) {
    vision = await analyzePhoto(req.file.buffer, req.file.mimetype, farm.animal_category);
  }

  const report = {
    id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    farm_id,
    animal_category: farm.animal_category,
    animal_type: farm.animal_type,
    symptoms,
    affected_count: Number(affected_count) || 0,
    deaths: deaths === undefined || deaths === "" ? null : Math.max(0, Number(deaths) || 0),
    notes: notes || undefined,
    lat: farm.lat,
    lng: farm.lng,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    created_at: new Date().toISOString(),
    ...(vision ? { description: vision.description, confidence: vision.confidence } : {}),
    ...(req.file && req.file.buffer ? { has_photo: true } : {}),
  };
  DB.reports.push(report);
  DB.audit = appendAudit(DB.audit, req.user.id, "report_submitted", {
    report_id: report.id,
    farm_id,
    farm_name: farm.name,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    animal_category: farm.animal_category,
    symptoms,
    affected_count: report.affected_count,
    deaths: report.deaths,
    notes: report.notes || null,
    has_photo: report.has_photo ? true : false,
  });
  persist();
  res.status(201).json({ report });
});

// Reports (visible to role)
app.get("/api/reports", authRequired, async (req, res) => {
  let reports = DB.reports;
  if (req.user.role === "farmer") {
    const myFarms = new Set(DB.farms.filter((f) => f.user_id === req.user.id).map((f) => f.farm_id));
    reports = reports.filter((r) => myFarms.has(r.farm_id));
  } else if (req.user.role === "vet") {
    reports = reports.filter((r) => !r.district || r.district === req.user.district);
  }
  // AI alerts embed the exact sensing_readings row that triggered them so the
  // UI can show "View source sensing data" without a second round trip.
  reports = reports.map((r) => {
    if (r.source === "ai_auto" && r.sensing_reading_id) {
      const sr = DB.sensing_readings.find((x) => x.id === r.sensing_reading_id) || null;
      return sr ? { ...r, sensing_reading: sr } : r;
    }
    return r;
  });
  res.json({ reports });
});

// Clusters
app.get("/api/clusters", authRequired, (req, res) => {
  let clusters = computeAllClusters();
  if (req.user.role === "farmer") {
    const myFarms = new Set(DB.farms.filter((f) => f.user_id === req.user.id).map((f) => f.farm_id));
    clusters = clusters.filter((c) => c.farms.some((fid) => myFarms.has(fid)));
  } else if (req.user.role === "vet") {
    clusters = clusters.filter((c) => !c.district || c.district === req.user.district);
  }
  res.json({ clusters });
});

// Dashboard (officer/vet)
app.get("/api/dashboard", authRequired, (req, res) => {
  if (req.user.role === "farmer") return res.status(403).json({ error: "Forbidden" });
  const clusters = computeAllClusters();
  const allClustered = new Set(clusters.flatMap((c) => c.reports));
  const routine = DB.reports
    .filter((r) => !allClustered.has(r.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  let viewClusters = clusters;
  if (req.user.role === "vet") {
    viewClusters = clusters.filter((c) => !c.district || c.district === req.user.district);
  }
  res.json({ clusters: viewClusters, criticals: viewClusters.filter((c) => c.level === "critical"), routine });
});

// Dispatch / Advisory (vet/admin only) -> writes audit chain + inbox
app.post("/api/clusters/:id/:action", authRequired, requireRole("vet", "admin"), (req, res) => {
  const { id, action } = req.params;
  if (!["dispatch", "advisory"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const cluster = computeAllClusters().find((c) => c.id === id);
  if (!cluster || (cluster.level !== "critical" && cluster.level !== "emerging")) {
    return res.status(404).json({ error: "Cluster not found or not actionable" });
  }
  // Vet can only act on their assigned district/taluka.
  if (req.user.role === "vet" && req.user.district && !cluster.village.toLowerCase().includes(req.user.district.toLowerCase()) && cluster.farm_count > 0) {
    const farmsInCluster = DB.farms.filter((f) => cluster.farms.includes(f.farm_id));
    const outside = farmsInCluster.some((f) => f.district && f.district !== req.user.district);
    if (outside) return res.status(403).json({ error: "Forbidden: cluster outside assigned district" });
  }

  const critical = cluster.level === "critical";
  const kind = cluster.animal_category === "poultry" ? "poultry" : "livestock";
  const urgenEn = critical ? "CRITICAL OUTBREAK" : "EMERGING OUTBREAK";
  const urgenMr = critical ? "गंभीर उद्रेक" : "उद्रेक";
  const urgenHi = critical ? "गंभीर प्रकोप" : "उभरता प्रकोप";
  const en =
    action === "dispatch"
      ? `🐮 Vet dispatched — ${urgenEn}: ${cluster.report_count} cases across ${cluster.farm_count} ${kind} farm(s) in ${cluster.village}. ${recommendedAction(cluster)}`
      : `📢 Advisory — ${urgenEn} in ${cluster.village}: ${cluster.report_count} cases across ${cluster.farm_count} ${kind} farm(s). ${recommendedAction(cluster)} Please monitor and report symptoms.`;
  const mr =
    action === "dispatch"
      ? `🐮 पशुवैद्यकीय पथक रवाना — ${cluster.village} येथील ${cluster.farm_count} शेतात ${cluster.report_count} प्रकरणे.`
      : `📢 सल्ला — ${cluster.village} येथे ${urgenMr}: ${cluster.farm_count} शेतांत ${cluster.report_count} प्रकरणे.`;
  const hi =
    action === "dispatch"
      ? `🐮 पशु चिकित्सक भेजा — ${cluster.village} के ${cluster.farm_count} खेतों में ${cluster.report_count} मामले.`
      : `📢 परामर्श — ${cluster.village} में ${urgenHi}: ${cluster.farm_count} खेतों में ${cluster.report_count} मामले.`;

  const messageIds = [];
  for (const fid of cluster.farms) {
    const msg = {
      id: `msg_${now()}_${fid}`,
      farm_id: fid,
      type: action === "dispatch" ? "vet" : "advisory",
      cluster_id: cluster.id,
      en,
      mr,
      hi,
      ts: now(),
      read: false,
    };
    DB.inbox.push(msg);
    messageIds.push(msg.id);
  }

  // Append to the tamper-evident hash chain.
  DB.audit = appendAudit(DB.audit, req.user.id, action === "dispatch" ? "dispatch_vet" : "send_advisory", {
    cluster_id: cluster.id,
    report_count: cluster.report_count,
    farm_count: cluster.farm_count,
    village: cluster.village,
    animal_category: cluster.animal_category,
    message_ids: messageIds,
    report_ids: cluster.reports,
  });
  persist();
  res.json({ ok: true, messageCount: messageIds.length, action });
});

// Inbox for a farm (owner can read own; vet/admin can read all in scope)
app.get("/api/inbox", authRequired, (req, res) => {
  let inbox = DB.inbox;
  if (req.user.role === "farmer") {
    const myFarms = new Set(DB.farms.filter((f) => f.user_id === req.user.id).map((f) => f.farm_id));
    inbox = inbox.filter((m) => myFarms.has(m.farm_id));
  } else if (req.user.role === "vet") {
    const inScopeFarms = new Set(DB.farms.filter((f) => !f.district || f.district === req.user.district).map((f) => f.farm_id));
    inbox = inbox.filter((m) => inScopeFarms.has(m.farm_id));
  }
  res.json({ inbox: inbox.sort((a, b) => b.ts - a.ts) });
});

// Audit log + integrity (admin only)
app.get("/api/audit", authRequired, requireRole("admin"), (req, res) => {
  const integrity = verifyAudit(DB.audit);
  res.json({
    integrity,
    log: DB.audit.map((e) => ({
      seq: e.seq,
      ts: e.ts,
      actor: e.actor,
      action: e.action,
      data: e.data,
      hash: e.hash,
      prevHash: e.prevHash,
    })),
  });
});

// ---------- Herd-level health ledger (vaccination / treatment / deworming / mortality) ----------
const HEALTH_TYPES = new Set(["vaccination", "treatment", "deworming", "mortality"]);

function visibleHealth(user) {
  const vis = new Set(visibleFarms(user).map((f) => f.farm_id));
  return DB.health
    .filter((r) => vis.has(r.farm_id))
    .sort((a, b) => b.ts - a.ts)
    .map((r) => {
      const farm = DB.farms.find((f) => f.farm_id === r.farm_id);
      const drive = r.drive_id ? DB.drives.find((d) => d.drive_id === r.drive_id) : null;
      return {
        ...r,
        farm_name: farm?.name || null,
        village: farm?.village || null,
        taluka: farm?.taluka || null,
        district: farm?.district || null,
        animal_category: farm?.animal_category || null,
        drive_name: drive?.name || null,
      };
    });
}

// Vet/admin records a vaccination, treatment, deworming or mortality event.
app.post("/api/health", authRequired, requireRole("vet", "admin"), (req, res) => {
  const { farm_id, record_type, name, disease, dose, batch, date, notes, drive_id, animals } = req.body || {};
  const farm = DB.farms.find((f) => f.farm_id === farm_id);
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden: farm outside your scope" });
  if (!HEALTH_TYPES.has(record_type)) {
    return res.status(400).json({ error: "record_type must be vaccination, treatment, deworming or mortality" });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name (vaccine/drug/dewormer) is required" });
  }
  let drive = null;
  if (drive_id) {
    drive = DB.drives.find((d) => d.drive_id === drive_id);
    if (!drive) return res.status(400).json({ error: "Unknown drive_id" });
  }
  const animalsCount = animals != null && animals !== "" ? Math.max(1, Number(animals)) : null;
  const record = {
    id: `hlth_${now()}_${Math.random().toString(36).slice(2, 6)}`,
    farm_id,
    record_type,
    name: String(name).trim(),
    disease: disease ? String(disease).trim() : null,
    dose: dose ? String(dose).trim() : null,
    batch: batch ? String(batch).trim() : null,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    notes: notes ? String(notes).trim() : null,
    animals: animalsCount,
    drive_id: drive?.drive_id || null,
    actor: req.user.id,
    ts: now(),
  };
  DB.health.push(record);
  DB.audit = appendAudit(DB.audit, req.user.id, "health_record", {
    record_id: record.id,
    farm_id: farm.farm_id,
    farm_name: farm.name,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    animal_category: farm.animal_category,
    record_type: record.record_type,
    name: record.name,
    disease: record.disease,
    dose: record.dose,
    batch: record.batch,
    date: record.date,
    animals: record.animals,
    drive_id: record.drive_id,
    drive_name: drive?.name || null,
    notes: record.notes,
  });
  persist();
  res.status(201).json({ record });
});

// Health ledger (role-scoped). Optional ?farm_id= for a single farm's chart.
app.get("/api/health", authRequired, (req, res) => {
  const farmId = req.query.farm_id;
  if (farmId) {
    const farm = DB.farms.find((f) => f.farm_id === farmId);
    if (!farm) return res.status(404).json({ error: "Farm not found" });
    if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });
    res.json({ records: visibleHealth(req.user).filter((r) => r.farm_id === farmId) });
    return;
  }
  res.json({ records: visibleHealth(req.user) });
});

// ---------- Vaccination drives & coverage ----------
const ANIMAL_CATEGORIES = ["large_livestock", "small_livestock", "poultry"];
const DRIVE_STATUSES = ["planned", "active", "completed"];

// Lab samples & referral constants.
const SAMPLE_TYPES = ["blood", "swab", "feces", "milk", "tissue"];
const SAMPLE_RESULTS = ["positive", "negative"];
const DEFAULT_LAB = "District Veterinary Laboratory, Pune";

// The farms a drive targets = farms in the drive's region matching its animal
// category. This is what coverage is measured against.
function targetFarmsFor(drive) {
  return DB.farms.filter(
    (f) =>
      f.district === drive.district &&
      (!drive.taluka || f.taluka === drive.taluka) &&
      f.animal_category === drive.animal_category
  );
}

// A farm counts as covered when any vaccination for this drive was recorded on
// its health ledger (drive-linked), OR any vaccination for the same disease was
// recorded since the drive started.
function driveCoverage(drive) {
  const targets = targetFarmsFor(drive);
  const relevant = DB.health.filter((r) => {
    if (r.record_type !== "vaccination") return false;
    if (r.drive_id === drive.drive_id) return true;
    return (
      r.disease === drive.disease &&
      new Date(r.date) >= new Date(drive.start_date)
    );
  });
  const coveredById = new Map();
  for (const r of relevant) coveredById.set(r.farm_id, r);
  const coveredFarms = targets.filter((f) => coveredById.has(f.farm_id));
  const animalsCovered = coveredFarms.reduce(
    (s, f) => s + (coveredById.get(f.farm_id).animals ?? f.herd_size),
    0
  );
  const animalsTarget = targets.reduce((s, f) => s + f.herd_size, 0);
  const villageMap = {};
  for (const f of targets) {
    villageMap[f.village] ||= { village: f.village, taluka: f.taluka, target: 0, covered: 0 };
    villageMap[f.village].target += 1;
    if (coveredById.has(f.farm_id)) villageMap[f.village].covered += 1;
  }
  return {
    target_farm_count: targets.length,
    target_animal_count: animalsTarget,
    covered_farm_count: coveredFarms.length,
    farm_coverage_pct: targets.length ? Math.round((coveredFarms.length / targets.length) * 100) : 0,
    animal_coverage_pct: animalsTarget ? Math.round((animalsCovered / animalsTarget) * 100) : 0,
    covered_farm_ids: coveredFarms.map((f) => f.farm_id),
    villages: Object.values(villageMap).map((v) => ({
      ...v,
      pct: v.target ? Math.round((v.covered / v.target) * 100) : 0,
    })),
    still_to_do: targets
      .filter((f) => !coveredById.has(f.farm_id))
      .map((f) => ({ farm_id: f.farm_id, name: f.name, village: f.village, taluka: f.taluka, herd_size: f.herd_size })),
    overdue: drive.end_date && new Date(drive.end_date) < Date.now(),
  };
}

// Vet/admin launches a drive. District is required; taluka narrows it (optional).
app.post("/api/drives", authRequired, requireRole("vet", "admin"), (req, res) => {
  const { name, disease, vaccine, taluka, district, animal_category, start_date, end_date, status } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Drive name is required" });
  if (!district || !String(district).trim()) return res.status(400).json({ error: "District is required" });
  if (!ANIMAL_CATEGORIES.includes(animal_category)) {
    return res.status(400).json({ error: "animal_category must be large_livestock, small_livestock or poultry" });
  }
  const drive = {
    drive_id: `drv_${now()}`,
    name: String(name).trim(),
    disease: disease ? String(disease).trim() : null,
    vaccine: vaccine ? String(vaccine).trim() : null,
    taluka: taluka ? String(taluka).trim() : null,
    district: String(district).trim(),
    animal_category,
    start_date: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
    end_date: end_date ? new Date(end_date).toISOString() : null,
    status: ["active", "completed"].includes(status) ? "active" : "planned",
    created_by: req.user.id,
    created_at: now(),
  };
  DB.drives.push(drive);
  DB.audit = appendAudit(DB.audit, req.user.id, "vaccination_drive", {
    drive_id: drive.drive_id,
    name: drive.name,
    disease: drive.disease,
    vaccine: drive.vaccine,
    taluka: drive.taluka,
    district: drive.district,
    animal_category: drive.animal_category,
    start_date: drive.start_date,
    end_date: drive.end_date,
    status: drive.status,
  });
  persist();
  res.status(201).json({ drive, coverage: driveCoverage(drive) });
});

// Drive list + live coverage. Vet sees their district; admin & farmers see all
// (campaign information is public, same village surveillance grid).
app.get("/api/drives", authRequired, (req, res) => {
  let drives = DB.drives;
  if (req.user.role === "vet") drives = drives.filter((d) => d.district === req.user.district);
  res.json({
    drives: drives
      .slice()
      .sort((a, b) => b.created_at - a.created_at)
      .map((d) => ({ ...d, coverage: driveCoverage(d) })),
  });
});

// Vet/admin moves a drive through planned → active → completed.
app.patch("/api/drives/:id/status", authRequired, requireRole("vet", "admin"), (req, res) => {
  const drive = DB.drives.find((d) => d.drive_id === req.params.id);
  if (!drive) return res.status(404).json({ error: "Drive not found" });
  const { status } = req.body || {};
  if (!DRIVE_STATUSES.includes(status)) {
    return res.status(400).json({ error: "status must be planned, active or completed" });
  }
  drive.status = status;
  DB.audit = appendAudit(DB.audit, req.user.id, "vaccination_drive", {
    drive_id: drive.drive_id,
    name: drive.name,
    disease: drive.disease,
    vaccine: drive.vaccine,
    taluka: drive.taluka,
    district: drive.district,
    animal_category: drive.animal_category,
    status,
  });
  persist();
  res.json({ drive, coverage: driveCoverage(drive) });
});

// ---------- Lab samples & referral (blood/swab → lab → result → farm) ----------
const nearestSampleInfo = (s) => {
  const f = DB.farms.find((x) => x.farm_id === s.farm_id);
  return {
    sample_id: s.id,
    farm_id: s.farm_id,
    farm_name: f?.name || s.farm_id,
    village: f?.village || s.village || null,
    taluka: f?.taluka || null,
    district: f?.district || null,
    animal_category: s.animal_category,
    animal_type: s.animal_type,
    sample_type: s.sample_type,
    lab_name: s.lab_name,
  };
};

// Vet collects a sample and refers it to the district lab (awaiting_result).
app.post("/api/samples", authRequired, requireRole("vet", "admin"), (req, res) => {
  const { farm_id, sample_type, suspected_disease, test_requested, lab_name, notes } = req.body || {};
  const farm = DB.farms.find((f) => f.farm_id === farm_id);
  if (!farm) return res.status(404).json({ error: "Farm not found" });
  if (!canAccessFarm(farm, req.user)) return res.status(403).json({ error: "Forbidden" });
  if (!SAMPLE_TYPES.includes(sample_type)) {
    return res.status(400).json({ error: `sample_type must be one of: ${SAMPLE_TYPES.join(", ")}` });
  }
  if (suspected_disease !== undefined && (typeof suspected_disease !== "string" || suspected_disease.length > NAME_MAX)) {
    return res.status(400).json({ error: "suspected_disease too long or invalid" });
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > NOTES_MAX)) {
    return res.status(400).json({ error: "notes too long or invalid" });
  }
  const sample = {
    id: `smp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    farm_id: farm.farm_id,
    animal_category: farm.animal_category,
    animal_type: farm.animal_type,
    sample_type,
    suspected_disease: suspected_disease?.trim() || undefined,
    test_requested: test_requested?.trim() || undefined,
    lab_name: lab_name?.trim() || DEFAULT_LAB,
    status: "awaiting_result",
    collected_by: req.user.id,
    collected_at: new Date().toISOString(),
    notes: notes?.trim() || undefined,
  };
  DB.samples.push(sample);
  DB.audit = appendAudit(DB.audit, req.user.id, "sample_collected", {
    ...nearestSampleInfo(sample),
    suspected_disease: sample.suspected_disease || null,
    test_requested: sample.test_requested || null,
    notes: sample.notes || null,
  });
  persist();
  res.status(201).json({ sample });
});

// Role-scoped sample list (lab, vet, admin, farmer own farms).
app.get("/api/samples", authRequired, (req, res) => {
  let samples = DB.samples.slice();
  if (req.user.role === "farmer") {
    const myFarms = new Set(DB.farms.filter((f) => f.user_id === req.user.id).map((f) => f.farm_id));
    samples = samples.filter((s) => myFarms.has(s.farm_id));
  } else if (req.user.role === "vet") {
    samples = samples.filter((s) => {
      const f = DB.farms.find((x) => x.farm_id === s.farm_id);
      return !f?.district || f.district === req.user.district;
    });
  } else if (req.user.role === "lab") {
    samples = samples.filter((s) => {
      const f = DB.farms.find((x) => x.farm_id === s.farm_id);
      return !f?.district || f.district === req.user.district;
    });
    samples = samples.map((s) => {
      const f = DB.farms.find((x) => x.farm_id === s.farm_id);
      return { ...s, farm_name: f?.name || s.farm_id, village: f?.village || s.village || null, herd_size: f?.herd_size || null };
    });
  }
  samples = samples
    .map((s) => ({ ...s, farm_name: DB.farms.find((f) => f.farm_id === s.farm_id)?.name || s.farm_id }))
    .sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));
  res.json({ samples });
});

// Lab records the result on a referred sample → result returns to the farm record.
app.post("/api/samples/:id/result", authRequired, requireRole("lab", "vet", "admin"), (req, res) => {
  const sample = DB.samples.find((s) => s.id === req.params.id);
  if (!sample) return res.status(404).json({ error: "Sample not found" });
  const { result, pathogen, remarks, test_requested } = req.body || {};
  if (!SAMPLE_RESULTS.includes(result)) {
    return res.status(400).json({ error: "result must be positive or negative" });
  }
  if (pathogen !== undefined && (typeof pathogen !== "string" || pathogen.length > NAME_MAX)) {
    return res.status(400).json({ error: "pathogen too long or invalid" });
  }
  if (remarks !== undefined && (typeof remarks !== "string" || remarks.length > NOTES_MAX)) {
    return res.status(400).json({ error: "remarks too long or invalid" });
  }
  sample.result = result;
  sample.pathogen = pathogen?.trim() || undefined;
  sample.remarks = remarks?.trim() || undefined;
  if (test_requested) sample.test_requested = test_requested.trim();
  sample.status = "resulted";
  sample.resulted_by = req.user.id;
  sample.resulted_at = new Date().toISOString();
  DB.audit = appendAudit(DB.audit, req.user.id, "lab_result", {
    ...nearestSampleInfo(sample),
    suspected_disease: sample.suspected_disease || null,
    result,
    pathogen: sample.pathogen || null,
    remarks: sample.remarks || null,
  });
  persist();
  res.json({ sample });
});

// Impact metrics (live, computed server-side) — reporting-to-response time,
// farms covered (split livestock/poultry), active outbreak clusters.
app.get("/api/impact", authRequired, (req, res) => {
  let farms = DB.farms;
  let reports = DB.reports;
  let clusters = computeAllClusters();
  const ibid = req.user.role;

  if (ibid === "farmer") {
    const myFarms = new Set(DB.farms.filter((f) => f.user_id === req.user.id).map((f) => f.farm_id));
    farms = DB.farms.filter((f) => myFarms.has(f.farm_id));
    reports = DB.reports.filter((r) => myFarms.has(r.farm_id));
    clusters = clusters.filter((c) => c.farms.some((fid) => myFarms.has(fid)));
  } else if (ibid === "vet") {
    farms = DB.farms.filter((f) => !f.district || f.district === req.user.district);
    const scopeFarmIds = new Set(farms.map((f) => f.farm_id));
    reports = DB.reports.filter((r) => scopeFarmIds.has(r.farm_id));
    clusters = clusters.filter((c) => c.farms.some((fid) => scopeFarmIds.has(fid)));
  }

  const criticalCount = clusters.filter((c) => c.level === "critical").length;
  const emergingCount = clusters.filter((c) => c.level === "emerging").length;

  const livestockFarms = farms.filter((f) => f.animal_category === "large_livestock");
  const poultryFarms = farms.filter((f) => f.animal_category === "poultry");

  // Reporting-to-response: measured from the tamper-evident dispatch log.
  // For each dispatch_vet audit entry we know exactly which reports it covered,
  // so response time = time from the last covered report to the dispatch action.
  const dispatchEntries = DB.audit.filter((e) => e.action === "dispatch_vet");
  let totalHrs = 0;
  let n = 0;
  for (const d of dispatchEntries) {
    const ids = new Set(d.data?.report_ids || []);
    if (ids.size === 0) continue;
    let lastReportTs = 0;
    for (const rid of ids) {
      const r = DB.reports.find((x) => x.id === rid);
      if (r?.created_at) lastReportTs = Math.max(lastReportTs, new Date(r.created_at).getTime());
    }
    if (!lastReportTs) continue;
    const dispatchTs = new Date(d.ts).getTime();
    const hrs = Number.isFinite(dispatchTs) ? (dispatchTs - lastReportTs) / 3600000 : NaN;
    if (Number.isFinite(hrs) && hrs >= 0) {
      totalHrs += hrs;
      n++;
    }
  }
  const measuredAvg = n > 0 ? Number((totalHrs / n).toFixed(1)) : null;
  const reportingToResponse = {
    current: measuredAvg ?? 4.2,
    unit: "h",
    target: 1.0,
    label: "report-to-response",
    kind: measuredAvg != null ? "average" : "baseline",
    basis: measuredAvg != null
      ? `measured average across ${n} dispatches (report submitted → vet dispatched)`
      : "baseline estimate — no dispatches recorded yet in this demo session",
    n,
  };

  // Real report volume within the surveillance window (48h) as sensing freshness.
  const windowMs = 48 * 60 * 60 * 1000;
  const recentReports = reports.filter((r) => {
    const t = r.created_at ? new Date(r.created_at).getTime() : Date.now();
    return t >= Date.now() - windowMs;
  }).length;

  res.json({
    impact: {
      reportingToResponse,
      farmsCovered: {
        total: farms.length,
        livestock: livestockFarms.length,
        poultry: poultryFarms.length,
        livestockHerd: livestockFarms.reduce((s, f) => s + (Number(f.herd_size) || 0), 0),
        poultryHerd: poultryFarms.reduce((s, f) => s + (Number(f.herd_size) || 0), 0),
      },
      activeClusters: { critical: criticalCount, emerging: emergingCount },
      recentReports,
      generatedAt: new Date().toISOString(),
    },
  });
});

// ---------- Error handling ----------
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;

// On boot, lazily register remote-sensing polygons for any farm that lacks one
// (only runs when a key is configured). Without this, seed farms stay offline and
// only freshly registered farms would ever receive live readings.
let polyRegistrationRunning = false;
function registerMissingPolygons() {
  if (!AGRO_API_KEY || polyRegistrationRunning) return;
  let pending = 0;
  const farms = DB.farms.filter((f) => !f.polygon_id);
  if (farms.length === 0) return;
  polyRegistrationRunning = true;
  for (const farm of farms) {
    pending++;
    registerPolygon(farm.farm_id, generatePolygon(farm.lat, farm.lng)).then((pid) => {
      if (pid) {
        farm.polygon_id = pid;
        persist();
        console.log(`[env] polygon registered for ${farm.farm_id} -> ${pid}`);
      } else {
        console.warn(`[env] polygon registration failed for ${farm.farm_id}`);
      }
    });
  }
  if (pending > 0) {
    console.log(`[env] ${pending} farm(s) pending remote-sensing polygon registration`);
  }
}
registerMissingPolygons();

// ---------- Autonomous sensing layer ----------
// Even when no farmer reports manually, the live remote-sensing signal itself
// can file an AI Alert: when a predicted disease crosses the AUTO_TRIGGER_SCORE
// for a farm, the server creates a real report (source: "ai_auto", linked to the
// exact sensing_readings row that triggered it) that enters the same clustering
// -> dispatch -> vet dashboard pipeline.
const autoCooldown = new Map(); // `${farm_id}|${diseaseId}` -> last ts (ms)
async function autonomousScan() {
  if (!AGRO_API_KEY) return; // honest: no live signal, no fabricated detections
  if (!DB.farms.some((f) => f.polygon_id)) {
    registerMissingPolygons(); // polygons may still be pending after boot
    return;
  }
  for (const farm of DB.farms) {
    if (!farm.polygon_id || !farm.lat) continue;
    try {
      const res = await fetchEnv(farm); // cached (TTL) — cheap to call often
      if (res.source !== "live" || !res.env) continue;
      const hit = topRisk(res.env, farm.animal_category);
      if (!hit || hit.score < AUTO_TRIGGER_SCORE) continue;
      const key = `${farm.farm_id}|${hit.id}`;
      const last = autoCooldown.get(key) || 0;
      if (now() - last < AUTO_COOLDOWN_MS) continue;
      const report = buildAutoReport(farm, hit, {
        sensingReadingId: res.reading || null,
        envRisk: res.risk,
      });
      DB.reports.push(report);
      autoCooldown.set(key, now());
      DB.audit = appendAudit(DB.audit, "system:autonomous", "auto_detect", {
        farm_id: farm.farm_id,
        farm_name: farm.name,
        village: farm.village,
        taluka: farm.taluka,
        district: farm.district,
        disease: hit.name,
        score: hit.score,
        report_id: report.id,
        sensing_reading_id: report.sensing_reading_id,
        env_risk: res.risk,
      });
      persist();
      console.log(`[auto] filed ${report.id} — ${hit.name} (${hit.score}) at ${farm.village}`);
    } catch {
      // a failed sensor read must never take down the scanner
    }
  }
}
setTimeout(autonomousScan, 2500); // first pass shortly after boot
setInterval(autonomousScan, 5 * 60 * 1000); // then every 5 minutes

// ---------- Static frontend (Render single-service deploy) ----------
// If the built app exists (npm run build -> dist/), serve it + SPA fallback so one
// web service handles both the API and the UI. Everything under /api stays API-only.
const DIST_DIR = join(__dirname, "..", "dist");
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api).*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(join(DIST_DIR, "index.html"));
  });
  console.log("[static] serving frontend from dist/");
}

app.listen(PORT, () => {
  console.log(`Animal Guard backend listening on http://localhost:${PORT}`);
});
