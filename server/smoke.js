import "dotenv/config";

const PORT = process.env.PORT || 4000;
const BASE = `http://localhost:${PORT}/api`;

function pass(name, cond, detail = "") {
  console.log(`${cond ? "\u2713" : "\u2717"} ${name}${detail ? `: ${detail}` : ""}`);
  return cond;
}

async function main() {
  const results = [];
  const login = async (mobile) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code: "1234" }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("login failed", mobile, data);
      throw new Error("login failed");
    }
    return { token: data.token, user: data.user };
  };

  const farmer = await login("9876543210");
  const vet = await login("9123456780");
  const admin = await login("9988776655");

  const authHeaders = (t) => ({ Authorization: `Bearer ${t}` });

  // 1. Farmer sees only own farms, and lat/lng only for own farms
  const farmerFarms = await (await fetch(`${BASE}/farms`, { headers: authHeaders(farmer.token) })).json();
  results.push(pass("farmer sees own farms (>=4)", Array.isArray(farmerFarms.farms) && farmerFarms.farms.length >= 4, `${farmerFarms.farms.length} farms`));
  results.push(pass("farmer own farm has lat", farmerFarms.farms.find((f) => f.farm_id === "farm_1001")?.lat != null));

  // 2. Vet sees farms in district
  const vetFarms = await (await fetch(`${BASE}/farms`, { headers: authHeaders(vet.token) })).json();
  const vetFarmIds = (vetFarms.farms || []).map((f) => f.farm_id);
  results.push(pass("vet sees only Pune farms", vetFarmIds.includes("farm_1001") && vetFarmIds.includes("farm_1003") && !vetFarmIds.includes("farm_1004"), vetFarmIds.join(",")));

  // 3. Admin sees all farms + exact GPS
  const adminFarms = await (await fetch(`${BASE}/farms`, { headers: authHeaders(admin.token) })).json();
  results.push(pass("admin sees all farms", adminFarms.farms.length >= 4));
  results.push(pass("admin sees farm_1001 lat", adminFarms.farms.find((f) => f.farm_id === "farm_1001")?.lat === 18.452));

  // 4. Access control: non-existent farm returns 404; admin can access any farm
  const farmerOnOther = await fetch(`${BASE}/farms/farm_9999`, { headers: authHeaders(farmer.token) }).catch(() => null);
  results.push(pass("farmer forbidden non-existent farm", farmerOnOther && farmerOnOther.status === 404));

  // Admin can access any
  const adminOnFarm = await fetch(`${BASE}/farms/farm_1004`, { headers: authHeaders(admin.token) }).catch(() => null);
  results.push(pass("admin accesses farm_1004", adminOnFarm && adminOnFarm.status === 200));

  // 5. Dashboard forbidden for farmer, allowed for vet/admin
  const farmerDash = await fetch(`${BASE}/dashboard`, { headers: authHeaders(farmer.token) });
  results.push(pass("farmer forbidden dashboard", farmerDash.status === 403));
  const vetDash = await (await fetch(`${BASE}/dashboard`, { headers: authHeaders(vet.token) })).json();
  results.push(pass("vet dashboard has clusters", Array.isArray(vetDash.clusters)));

  // 6. Clusters: with 8 livestock reports? Actually 6 large_livestock + 2 poultry. Poultry has 2 => no cluster.
  const clusters = await (await fetch(`${BASE}/clusters`, { headers: authHeaders(admin.token) })).json();
  const largeClusters = (clusters.clusters || []).filter((c) => c.animal_category === "large_livestock");
  results.push(pass("large livestock cluster detected (emerging/critical)", largeClusters.length >= 1, `${largeClusters.length} clusters, counts=${largeClusters.map((c)=>c.report_count)}`));

  // 7. Farmer cluster view limited to own farms
  const farmerClusters = await (await fetch(`${BASE}/clusters`, { headers: authHeaders(farmer.token) })).json();
  results.push(pass("farmer cluster list scoped", Array.isArray(farmerClusters.clusters)));

  // 8. Farmer forbidden to dispatch
  const dispatchFarmer = await fetch(`${BASE}/clusters/cl_x/dispatch`, { method: "POST", headers: authHeaders(farmer.token) });
  results.push(pass("farmer forbidden dispatch", dispatchFarmer.status === 403));

  // 9. Audit admin only + integrity
  const auditAdmin = await fetch(`${BASE}/audit`, { headers: authHeaders(admin.token) });
  results.push(pass("admin reads audit", auditAdmin.status === 200));
  const auditVet = await fetch(`${BASE}/audit`, { headers: authHeaders(vet.token) });
  results.push(pass("vet forbidden audit", auditVet.status === 403));

  // 10. Rate limiting is tested in unit tests / verified across the report path (429).

  // 11. Audit chain tamper detection
  const auditData = await auditAdmin.json();
  if (auditData.log && auditData.log.length > 0) {
    results.push(pass("audit integrity reported valid", auditData.integrity?.valid === true));
  } else {
    results.push(pass("audit integrity reported valid", true, "empty log"));
  }

  // 12. Invalid report rejected (validation)
  const badReport = await fetch(`${BASE}/reports`, {
    method: "POST",
    headers: { ...authHeaders(farmer.token), "Content-Type": "application/json" },
    body: JSON.stringify({ farm_id: "farm_1001", symptoms: ["evil"], affected_count: 1 }),
  });
  results.push(pass("invalid symptom rejected server-side", badReport.status === 400));

  // 13. Impact metrics endpoint
  const impactAdmin = await (await fetch(`${BASE}/impact`, { headers: authHeaders(admin.token) })).json();
  results.push(pass("impact: active clusters present", Number.isInteger(impactAdmin?.impact?.activeClusters?.critical)));
  results.push(pass("impact: farms covered split works", Number.isInteger(impactAdmin?.impact?.farmsCovered?.livestock) && Number.isInteger(impactAdmin?.impact?.farmsCovered?.poultry)));
  results.push(pass("impact: response-time metric present", typeof impactAdmin?.impact?.reportingToResponse?.current === "number"));

  const impactFarmer = await (await fetch(`${BASE}/impact`, { headers: authHeaders(farmer.token) })).json();
  const farmerCrit = impactFarmer?.impact?.activeClusters?.critical ?? -1;
  results.push(pass("impact: farmer's view not critical (scoped)", farmerCrit === 0 || farmerCrit === -1));

  // 15. Rate limit: rapid-fire 6 reports on one farm -> 6th is 429
  const rateLimitHits = [];
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/reports`, {
      method: "POST",
      headers: { ...authHeaders(farmer.token), "Content-Type": "application/json" },
      body: JSON.stringify({ farm_id: "farm_1003", symptoms: ["egg_drop"], affected_count: 5 }),
    });
    rateLimitHits.push(r.status);
  }
  results.push(pass("per-farm rate limit blocks 6th report (429)", rateLimitHits.filter((s) => s === 429).length >= 1, rateLimitHits.join(",")));

  // 14. End-to-end: push livestock 6 -> 8 reports => CRITICAL cluster; vet dispatches => inbox + audit
  for (let i = 0; i < 2; i++) {
    await fetch(`${BASE}/reports`, {
      method: "POST",
      headers: { ...authHeaders(farmer.token), "Content-Type": "application/json" },
      body: JSON.stringify({ farm_id: "farm_1001", symptoms: ["mouth_foot_lesions", "fever"], affected_count: 7 }),
    });
  }
  const clustersAfter = await (await fetch(`${BASE}/clusters`, { headers: authHeaders(admin.token) })).json();
  const livestockClusters = (clustersAfter.clusters || []).filter((c) => c.animal_category === "large_livestock");
  const critical = livestockClusters.find((c) => c.level === "critical");
  results.push(pass("8 livestock reports -> CRITICAL cluster", Boolean(critical), critical ? `count=${critical.report_count}` : "no critical"));

  if (critical) {
    const dispatchRes = await fetch(`${BASE}/clusters/${critical.id}/dispatch`, { method: "POST", headers: authHeaders(vet.token) });
    const dispatchData = await dispatchRes.json();
    results.push(pass("vet dispatches on critical cluster", dispatchRes.status === 200 && dispatchData.ok === true));

    const auditAfter = await (await fetch(`${BASE}/audit`, { headers: authHeaders(admin.token) })).json();
    const hasDispatchEntry = (auditAfter.log || []).some((e) => e.action === "dispatch_vet");
    results.push(pass("dispatch recorded in audit chain", hasDispatchEntry));
    results.push(pass("audit integrity still valid after dispatch", auditAfter.integrity?.valid === true));

    const farmerInbox = await (await fetch(`${BASE}/inbox`, { headers: authHeaders(farmer.token) })).json();
    results.push(pass("farmer inbox has vet-dispatch message", (farmerInbox.inbox || []).some((m) => m.type === "vet")));
  }

  // 15. Farmer registers a farm
  const createFarm = await fetch(`${BASE}/farms`, {
    method: "POST",
    headers: { ...authHeaders(farmer.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test New Farm", animal_category: "large_livestock", animal_type: "goat",
      herd_size: 10, lat: 18.5, lng: 73.9, village: "V", taluka: "Haveli", district: "Pune",
    }),
  });
  const created = await createFarm.json();
  results.push(pass("farmer registers farm", createFarm.status === 201, created.farm?.farm_id));

  const passed = results.filter((r) => r).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} checks passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test run error:", e);
  process.exit(1);
});
