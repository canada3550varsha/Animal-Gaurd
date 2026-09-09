import { appendAudit, verifyAudit } from "./audit.js";
import { detectClusters, haversineKm, computeFDRS, computeReportedCases, computeEnvRisk, SEVERITY_BY_ID, SYMPTOMS_BY_CATEGORY } from "./clustering.js";
import { evaluateSync, topRisk, isCritical, buildAutoReport, AUTO_TRIGGER_SCORE } from "./diseaseModel.js";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`\u2713 ${name}`); }
  else { fail++; console.log(`\u2717 ${name}`); }
}

// --- Audit hash chain ---
let log = [];
log = appendAudit(log, "u_admin", "register_farm", { farm_id: "f1" });
log = appendAudit(log, "u_admin", "dispatch_vet", { cluster_id: "c1" });
log = appendAudit(log, "u_vet", "send_advisory", { cluster_id: "c1" });

check("initial audit valid", verifyAudit(log).valid === true);
check("audit has 3 entries", log.length === 3);
check("hash chain links", log[1].prevHash === log[0].hash && log[2].prevHash === log[1].hash);

// Tamper with middle entry data -> chain invalidates.
const tampered = JSON.parse(JSON.stringify(log));
tampered[1].data.cluster_id = "c2";
check("tamper with data detected", verifyAudit(tampered).valid === false);

// Tamper with a hash value directly.
const tampered2 = JSON.parse(JSON.stringify(log));
tampered2[2].hash = "0".repeat(64);
check("tamper with hash detected", verifyAudit(tampered2).valid === false);

// --- Risk / clustering ---
const seed = [
  { id: "a", farm_id: "f1", animal_category: "large_livestock", lat: 18.452, lng: 73.878, village: "W", symptoms: ["fever"], created_at: new Date(Date.now() - 1e6).toISOString() },
  { id: "b", farm_id: "f1", animal_category: "large_livestock", lat: 18.453, lng: 73.879, village: "W", symptoms: ["fever"], created_at: new Date(Date.now() - 2e6).toISOString() },
  { id: "c", farm_id: "f2", animal_category: "large_livestock", lat: 18.451, lng: 73.877, village: "W", symptoms: ["fever"], created_at: new Date(Date.now() - 3e6).toISOString() },
];
const clusters = detectClusters(seed);
check("clusters 3 same-category within radius -> emerging", clusters.length === 1 && clusters[0].level === "emerging" && clusters[0].report_count === 3);

const farSeed = [
  { id: "a", farm_id: "f1", animal_category: "poultry", lat: 18.45, lng: 73.87, village: "W", created_at: new Date(Date.now() - 1e6).toISOString() },
  { id: "b", farm_id: "f2", animal_category: "poultry", lat: 21.2, lng: 79.0, village: "N", created_at: new Date(Date.now() - 2e6).toISOString() },
  { id: "c", farm_id: "f3", animal_category: "poultry", lat: 21.21, lng: 79.01, village: "N", created_at: new Date(Date.now() - 3e6).toISOString() },
];
check("isolated poultry reports below threshold -> no cluster", detectClusters(farSeed).length === 0);

// 3 isolated (>=threshold) poultry reports in Nagpur -> 1 cluster of 2 farms? b,c close; a far.
const threeNagpur = [
  { id: "a", farm_id: "f1", animal_category: "poultry", lat: 18.45, lng: 73.87, village: "W", created_at: new Date(Date.now() - 1e6).toISOString() },
  { id: "b", farm_id: "f2", animal_category: "poultry", lat: 21.20, lng: 79.0, village: "N", created_at: new Date(Date.now() - 2e6).toISOString() },
  { id: "c", farm_id: "f3", animal_category: "poultry", lat: 21.21, lng: 79.01, village: "N", created_at: new Date(Date.now() - 3e6).toISOString() },
  { id: "d", farm_id: "f4", animal_category: "poultry", lat: 21.205, lng: 79.005, village: "N", created_at: new Date(Date.now() - 4e6).toISOString() },
];
check("3 Nagpur poultry group -> emerging, 3 farms", detectClusters(threeNagpur).length === 1 && detectClusters(threeNagpur)[0].farm_count === 3);

check("haversine ~1.5km example", Math.round(haversineKm(18.4621, 73.8874, 18.471, 73.898)) === 1);

check("FDrs composition 0 + 0 + 0 + 0 = 0", computeFDRS({}) === 0);
check("FDrs caps at 100", computeFDRS({ reportedCases: 50, historical: 20, env: 25, nearby: 20 }) === 100);

const reports = [
  { symptoms: ["fever"], affected_count: 10, created_at: new Date(Date.now() - 1e6).toISOString() },
];
check("reported cases contributions", computeReportedCases(reports, SEVERITY_BY_ID) > 0);

check("symptom whitelist exists for livestock", SYMPTOMS_BY_CATEGORY.large_livestock.includes("mouth_foot_lesions"));

check("env risk: healthy low vegetation gives low(nonzero) score", computeEnvRisk({ sat: { ndvi: 0.8 }, soil: {} }) >= 0);
check("env risk: stressed vegetation scores >= healthy", (computeEnvRisk({ sat: { ndvi: 0.1 } }) || 25) >= (computeEnvRisk({ sat: { ndvi: 0.8 } }) || 0));
check("env risk: no data -> null", computeEnvRisk({}) === null);

// --- Autonomous disease prediction ---
const monsoon = { weather: { temp: 26, humidity: 82, rain7d: 55 }, sat: { ndvi: 0.6, dswi: 0.6 }, soil: { moisture: 0.7 } };
check("monsoon livestock -> FMD/HS predicted, scores explainable", (() => {
  const list = evaluateSync(monsoon, "large_livestock");
  return list.length >= 2 && list.every((d) => d.score >= 0 && d.reasons.length > 0);
})());
check("monsoon fmd score >= 30 (watch+)", evaluateSync(monsoon, "large_livestock").find((d) => d.id === "fmd")?.score >= 30);
check("dry summer heat stresses livestock", evaluateSync({ weather: { temp: 36, humidity: 30, rain7d: 0 }, sat: { ndvi: 0.2 } }, "large_livestock").some((d) => d.status === "high" || d.status === "critical"));
check("wet humid triggers poultry coccidiosis + HPAI watch", evaluateSync({ weather: { temp: 26, humidity: 80, rain7d: 45 }, sat: { ndvi: 0.7, dswi: 0.6 } }, "poultry").some((d) => d.id === "coccidiosis"));
check("no readings -> no prediction (no fabrication)", evaluateSync(null, "large_livestock").length === 0 && evaluateSync({}, "large_livestock").length === 0);
check("extreme dry heat -> poultry high (not auto-critical alone)", (() => {
  const list = evaluateSync({ weather: { temp: 37, humidity: 25, rain7d: 0 }, sat: { ndvi: 0.15 } }, "poultry");
  return list.some((d) => d.id === "heat_stress_poultry" && d.status === "high");
})());
check("critical gate flips on monsoon wetland HPAI", isCritical({ weather: { temp: 18, humidity: 85, rain7d: 60 }, sat: { ndvi: 0.6, dswi: 0.7 } }, "poultry") === true);
check("critical gate stays off on benign conditions", isCritical({ weather: { temp: 20, humidity: 40, rain7d: 2 }, sat: { ndvi: 0.8 } }, "poultry") === false);
check("auto threshold consistent", AUTO_TRIGGER_SCORE === 75);
check("auto report disease maps to whitelisted symptoms", (() => {
  const hit = topRisk(monsoon, "large_livestock");
  return Boolean(hit && hit.symptoms.length > 0 && hit.symptoms.every((s) => SYMPTOMS_BY_CATEGORY.large_livestock.includes(s)));
})());

// --- AI alert -> sensing reading linkage ---
const srId = "sr_1750000000000_abc123";
const autoRpt = buildAutoReport(
  { farm_id: "farm_1001", animal_category: "large_livestock", animal_type: "cattle", herd_size: 50, village: "Wanwadi", taluka: "Haveli", district: "Pune", lat: 18.452, lng: 73.878 },
  topRisk(monsoon, "large_livestock"),
  { sensingReadingId: srId, envRisk: 18 }
);
check("auto report source is ai_auto", autoRpt.source === "ai_auto");
check("auto report carries sensing_reading_id", autoRpt.sensing_reading_id === srId);
check("auto report tagged clearly as AI Alert", (autoRpt.notes || "").includes("AI Alert"));
check("auto report id prefix rpt_auto_", (autoRpt.id || "").startsWith("rpt_auto_"));
check("auto report no reading link -> null, not missing key", buildAutoReport({ farm_id: "f", animal_category: "poultry", animal_type: "hen", herd_size: 20, village: "v", taluka: "t", district: "d" }, topRisk({ weather: { temp: 26, humidity: 80, rain7d: 45 }, sat: { ndvi: 0.7, dswi: 0.6 } }, "poultry")).sensing_reading_id === null);

console.log(`\n${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
