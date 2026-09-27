import { Fragment, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { MapContainer, TileLayer, Marker, Polygon, Circle, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_LABELS, ANIMAL_ICONS, SYMPTOMS } from "../data/constants.js";
import { fdrsBand, historicalRiskFor, hasLiveEnv } from "../api/agro.js";
import { RING_INNER_KM, RING_OUTER_KM } from "../api/clustering.js";
import { api, getToken } from "../api/client.js";
import { healthIcon, healthLabel, SAMPLE_TYPE_LABEL, SAMPLE_RESULT_LABEL, SAMPLE_STATUS_LABEL } from "../data/health.js";
import ZoonoticBadge from "../components/ZoonoticBadge.jsx";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { T } from "../data/i18n.js";

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;text-align:center">📍</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Secondary tab navigation for a single farm — one section per view.
const TABS = [
  { key: "overview", icon: "🏠", label: "Overview" },
  { key: "risk", icon: "🦠", label: "Disease Risk" },
  { key: "sensing", icon: "📡", label: "Live Sensing" },
  { key: "health", icon: "💉", label: "Health Records" },
  { key: "vaccination", icon: "🛡️", label: "Vaccination & Treatment" },
  { key: "reports", icon: "📄", label: "Reports" },
  { key: "lab", icon: "🧪", label: "Lab Results" },
  { key: "location", icon: "🗺️", label: "Location" },
  { key: "alerts", icon: "🔔", label: "Alerts" },
];

export default function FarmDetailScreen() {
  const { farmId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    role,
    farms,
    reports,
    envData,
    envLoading,
    refreshFarmEnv,
    getFDRS,
    criticalClusters,
    getFarmInbox,
    getLatestReading,
    lang,
  } = useApp();

  const activeTab = TABS.some((t) => t.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";
  const setTab = (key) => setSearchParams({ tab: key }, { replace: true });

  const [expandedReportId, setExpandedReportId] = useState(null);
  const [health, setHealth] = useState([]);
  const [drives, setDrives] = useState([]);
  const [samples, setSamples] = useState([]);
  const farm = farms.find((f) => f.farm_id === farmId);

  useEffect(() => {
    if (!farm) return;
    refreshFarmEnv(farm.farm_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  useEffect(() => {
    let active = true;
    api
      .health(getToken(), { farm_id: farmId })
      .then(({ records }) => active && setHealth(records || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [farmId]);

  useEffect(() => {
    let active = true;
    api
      .drives(getToken())
      .then(({ drives }) => active && setDrives(drives || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [farmId]);

  useEffect(() => {
    let active = true;
    api
      .samples(getToken())
      .then(({ samples }) => active && setSamples(samples || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [farmId]);

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Farm not found</p>
      </div>
    );
  }

  const categoryIcon = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";
  const fdrs = getFDRS(farm);
  const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
  const loadingEnv = envLoading[farm.farm_id];
  const symptoms = SYMPTOMS[farm.animal_category] || [];
  const farmInbox = getFarmInbox(farm.farm_id);
  const envEntry = envData[farm.farm_id] || null;
  const env = envEntry?.env || null;
  const envLive = hasLiveEnv(env);
  const envRisk = envEntry?.risk ?? null;
  const envSource = envEntry?.source || "offline";
  const envFetchedAt = envEntry?.fetched_at || null;
  const latestReading = getLatestReading(farm.farm_id);
  const farmReports = reports
    .filter((r) => r.farm_id === farm.farm_id)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const farmSamples = samples
    .filter((s) => s.farm_id === farm.farm_id)
    .slice()
    .sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));

  const farmDrives = drives.filter(
    (d) =>
      d.coverage &&
      d.district === farm.district &&
      (!d.taluka || d.taluka === farm.taluka) &&
      d.animal_category === farm.animal_category
  );

  // Rings disclose nearby outbreak clusters — authorized for officials only.
  const showRings = role !== "farmer";

  const tabNav = (
    <nav
      className="lg:w-52 shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 lg:mx-0 px-1 lg:px-0"
      aria-label="Farm sections"
    >
      {TABS.map((t) => {
        const on = activeTab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              on
                ? "bg-primary/10 text-primary-dark border border-primary/20"
                : "text-ink-muted hover:bg-gray-100 border border-transparent"
            }`}
          >
            <span>{t.icon}</span>
            <span>{T(lang, t.label)}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <AppShell title={farm.name} subtitle={`${farm.animal_type} · ${farm.village}, ${farm.taluka}`}>
      <div className="space-y-5">
        <PrivacyNotice role={role} />

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {tabNav}

          <div className="flex-1 min-w-0 w-full space-y-5">
            {activeTab === "overview" && (
              <OverviewTab
                farm={farm}
                categoryIcon={categoryIcon}
                fdrs={fdrs}
                band={band}
                envRisk={envRisk}
                envFetchedAt={envFetchedAt}
                latestReading={latestReading}
                healthCount={health.length}
                reportCount={farmReports.length}
                farmInbox={farmInbox}
              />
            )}
            {activeTab === "risk" && (
              <RiskTab
                farm={farm}
                fdrs={fdrs}
                band={band}
                envRisk={envRisk}
                envEntry={envEntry}
                envLive={envLive}
                envSource={envSource}
                envFetchedAt={envFetchedAt}
                loadingEnv={loadingEnv}
                lang={lang}
              />
            )}
            {activeTab === "sensing" && (
              <SensingTab
                farm={farm}
                latestReading={latestReading}
                envLive={envLive}
                envEntry={envEntry}
              />
            )}
            {activeTab === "health" && (
              <HealthTab
                farm={farm}
                health={health}
                categories={["vaccination", "treatment", "deworming", "mortality"]}
                lang={lang}
              />
            )}
            {activeTab === "vaccination" && (
              <VaccinationTab farm={farm} health={health} farmDrives={farmDrives} lang={lang} />
            )}
            {activeTab === "reports" && (
              <ReportsTab
                farm={farm}
                farmReports={farmReports}
                symptoms={symptoms}
                expandedReportId={expandedReportId}
                setExpandedReportId={setExpandedReportId}
              />
            )}
            {activeTab === "lab" && <LabTab farm={farm} farmSamples={farmSamples} />}
            {activeTab === "location" && (
              <LocationTab farm={farm} criticalClusters={criticalClusters} showRings={showRings} />
            )}
            {activeTab === "alerts" && (
              <AlertsTab farmInbox={farmInbox} lang={lang} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------ Tab contents ----------------------------- */

function Card({ title, right, children, className = "" }) {
  return (
    <section className={`bg-white rounded-2xl p-4 border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function OverviewTab({ farm, categoryIcon, fdrs, band, envRisk, envFetchedAt, latestReading, healthCount, reportCount, farmInbox }) {
  const { lang } = useApp();
  const unread = farmInbox.filter((m) => !m.read).length;
  return (
    <>
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{categoryIcon}</span>
          <div className="flex-1">
            <h2 className="font-bold text-xl">{farm.name}</h2>
            <p className="text-sm text-gray-500">{T(lang, CATEGORY_LABELS[farm.animal_category])}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${band.bg} ${band.text}`}>
            {T(lang, band.label)} {T(lang, "risk")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-5">
          <InfoItem label={T(lang, "Animal Type")} value={farm.animal_type.charAt(0).toUpperCase() + farm.animal_type.slice(1)} />
          <InfoItem label={T(lang, "Herd Size")} value={`${farm.herd_size}`} />
          <InfoItem label={T(lang, "Village")} value={farm.village} />
          <InfoItem label={T(lang, "District")} value={farm.district} />
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoItem label={T(lang, "FDRS · Current Risk")} value={fdrs ? `${fdrs.total}/100` : "--"} />
          <InfoItem label={T(lang, "Environmental Risk")} value={envRisk != null ? `${envRisk}/25` : "—"} />
          <InfoItem label={T(lang, "Live Sensing")} value={latestReading?.fetch_status === "success" ? `● ${T(lang, "LIVE")}` : T(lang, "offline")} />
          <InfoItem label={T(lang, "Health Records")} value={`${healthCount}`} />
        </div>

        {envFetchedAt && (
          <p className="text-[11px] text-gray-400 mt-3">
            {T(lang, "Risk last updated")} {timeAgo(envFetchedAt)} · {reportCount}{" "}
            {reportCount === 1 ? T(lang, "farm report") : T(lang, "farm reports")} ·{" "}
            {unread > 0 ? `${unread} ${unread === 1 ? T(lang, "unread alert") : T(lang, "unread alerts")}` : T(lang, "no unread alerts")}
          </p>
        )}
      </div>

      {fdrs && (
        <Card title={T(lang, "Current risk — at a glance")}>
          <div className="space-y-3">
            <BarRow label={T(lang, "Reported Cases")} value={fdrs?.reportedCases ?? 0} max={35} note={T(lang, "Phase 3")} />
            <BarRow label={T(lang, "Historical Risk")} value={fdrs?.historical ?? historicalRiskFor(farm.taluka)} max={20} note={farm.taluka} />
            <BarRow label={T(lang, "Environmental Risk")} value={envRisk ?? "--"} max={25} note={envRisk == null ? T(lang, "no live signal") : T(lang, "live soil/remote sensing")} />
            <BarRow label={T(lang, "Nearby Outbreak")} value={fdrs?.nearby ?? 0} max={20} note={fdrs?.ringInfo ? `${fdrs.ringInfo.dist.toFixed(1)}${T(lang, "km from cluster")}` : T(lang, "ring-based")} />
          </div>
        </Card>
      )}
    </>
  );
}

function RiskTab({ farm, fdrs, band, envRisk, envEntry, envLive, envSource, envFetchedAt, loadingEnv, lang }) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className={`px-5 py-3 flex items-center justify-between ${band.bg}`}>
          <div>
            <h3 className="font-bold text-gray-900">{T(lang, "FDRS — Disease Risk Score")}</h3>
            <p className={`text-xs ${band.text}`}>{band.label} {T(lang, "risk level")}</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${band.text}`}>{fdrs ? fdrs.total : "--"}</p>
            <p className={`text-[10px] ${band.text}`}>/ 100</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <BarRow label={T(lang, "Reported Cases")} value={fdrs?.reportedCases ?? 0} max={35} note={T(lang, "Phase 3")} />
          <BarRow label={T(lang, "Historical Risk")} value={fdrs?.historical ?? historicalRiskFor(farm.taluka)} max={20} note={farm.taluka} />
          <BarRow
            label={T(lang, "Environmental Risk")}
            value={envRisk ?? "--"}
            max={25}
            note={
              loadingEnv
                ? T(lang, "fetching…")
                : envSource === "live"
                  ? `${T(lang, envBand(envRisk).label).toLowerCase()} · ${T(lang, "live soil/remote sensing")}`
                  : T(lang, "seeded (no live signal)")
            }
          />
          <BarRow
            label={T(lang, "Nearby Outbreak")}
            value={fdrs?.nearby ?? 0}
            max={20}
            note={fdrs?.ringInfo ? `${fdrs.ringInfo.dist.toFixed(1)}${T(lang, "km from cluster")}` : T(lang, "ring-based")}
          />
        </div>
      </div>

      <Card title={T(lang, "Environmental Data")} className="mt-4">
        {loadingEnv && <p className="text-xs text-gray-400 mb-3">· {T(lang, "loading…")}</p>}
        <p className="text-[11px] text-gray-400 mb-3 leading-snug">
          🛰️ {T(lang, "These values are fetched automatically from live satellite / soil / weather sensors and scored by the disease-prediction AI — they are not typed or reported by anyone.")}
        </p>
        {envFetchedAt && (
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${envBand(envRisk).cls}`}>
              {T(lang, envBand(envRisk).label)} {T(lang, "risk")}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              envSource === "live" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {envSource === "live" ? `● ${T(lang, "LIVE")}` : T(lang, "offline")}
            </span>
            <span className="text-[10px] text-gray-400">{T(lang, "updated")} {timeAgo(envFetchedAt)}</span>
          </div>
        )}
        {envLive ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoItem label={T(lang, "Soil Moisture")} value={env.soil?.moisture != null ? `${(env.soil.moisture * 100).toFixed(0)}%` : "—"} />
            <InfoItem label={T(lang, "Surface Temp")} value={env.soil?.t0 != null ? `${env.soil.t0.toFixed(1)}°C` : env.weather?.temp != null ? `${env.weather.temp.toFixed(1)}°C` : "—"} />
            <InfoItem label={T(lang, "Air Humidity")} value={env.weather?.humidity != null ? `${env.weather.humidity.toFixed(0)}%` : "—"} />
            <InfoItem label={T(lang, "7-day Rain")} value={env.weather?.rain7d != null ? `${env.weather.rain7d.toFixed(1)}mm` : "—"} />
            <InfoItem label={T(lang, "NDVI")} value={env.sat?.ndvi != null ? env.sat.ndvi.toFixed(3) : "—"} />
            <InfoItem label={T(lang, "NDWI")} value={env.sat?.ndwi != null ? env.sat.ndwi.toFixed(3) : "—"} />
            <InfoItem label={T(lang, "Coverage Zone")} value={T(lang, "~150m polygon")} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {loadingEnv
              ? T(lang, "Fetching live soil, humidity & remote sensing data…")
              : T(lang, "No live sensor/remote-sensing signal in this offline demo, so the Environmental Risk component is 0 — this is not real weather data. Add a real remote-sensing API key in server/.env to fetch live soil, humidity & weather per farm.")}
          </p>
        )}
      </Card>

      {envLive && (
        <Card title={T(lang, "Recommended preventive actions")} className="mt-4">
          <p className="text-xs text-gray-400 mb-3">
            {T(lang, "Predicted from this locality's soil, humidity, rainfall & vegetation stress")} — {T(lang, "for")} {farm.village}, {farm.district}.
          </p>
          {Array.isArray(envEntry?.diseases) && envEntry.diseases.length > 0 ? (
            <div className="space-y-3">
              {envEntry.diseases.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      d.status === "critical" ? "bg-red-600 text-white" : d.status === "high" ? "bg-red-100 text-red-700" : d.status === "watch" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>
                      {d.status.toUpperCase()} · {d.score}/100
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{T(lang, "Do:")} {d.actions?.en} {d.actions?.hi} {d.actions?.mr}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{T(lang, "No predicted-disease recommendations right now.")}</p>
          )}
        </Card>
      )}

      {(envLive || envRisk != null) && (
        <Card title={T(lang, "AI explanation")} className="mt-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {T(lang, "The AI blends")} {fdrs?.reportedCases ?? 0}/35 {T(lang, "reported-case pressure")},{" "}
            {fdrs?.historical ?? historicalRiskFor(farm.taluka)}/20 {T(lang, "historical risk for")} {farm.taluka},{" "}
            {envRisk ?? 0}/25 {T(lang, "environmental risk")}{envSource === "live" ? ` ${T(lang, "from live satellite/soil readings")}` : ` ${T(lang, "(no live signal)")}`},{" "}
            {T(lang, "and")} {fdrs?.nearby ?? 0}/20 {T(lang, "nearby-outbreak pressure")} {T(lang, "to produce this farm's FDRS of")} {fdrs?.total ?? "--"}/100.
          </p>
        </Card>
      )}
    </>
  );
}

function SensingTab({ farm, latestReading, envLive, envEntry }) {
  const { lang } = useApp();
  return (
    <>
      <Card
        title={`📡 ${T(lang, "Live Sensing Data")}`}
        right={latestReading?.fetch_status === "success" ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-600 text-white">● {T(lang, "LIVE")}</span>
        ) : latestReading ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{T(lang, "PENDING")}</span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">{T(lang, "OFFLINE")}</span>
        )}
      >
        <p className="text-[11px] text-gray-400 mb-3 leading-snug">
          {T(lang, "The raw readings captured on the last foreign-poll run for this farm — recorded every poll, whether or not an AI alert fired.")}
        </p>
        {latestReading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <InfoItem label={T(lang, "NDVI")} value={fmtNum(latestReading.ndvi)} />
              <InfoItem label={T(lang, "Soil Temp")} value={fmtCel(latestReading.soil_temp)} />
              <InfoItem label={T(lang, "Soil Moisture")} value={fmtMoisture(latestReading.soil_moisture)} />
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              {latestReading.id} · {timeAgo(latestReading.fetched_at)}
              {latestReading.fetch_status === "pending" && ` · ${T(lang, "waiting for the next satellite pass")}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">{T(lang, "No reading yet — waiting for the first Agro poll for this farm.")}</p>
        )}
      </Card>

      {!envLive ? (
        <p className="text-xs text-gray-400 mt-1">
          {T(lang, "No live sensor/remote-sensing signal in this offline demo — readings above are the raw Agro poll rows only.")}
        </p>
      ) : (
        Array.isArray(envEntry?.diseases) &&
        envEntry.diseases.length > 0 && (
          <Card
            title={`🛰️ ${T(lang, "Predicted Disease Risk (Live Sensing)")}`}
            right={<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">● {T(lang, "LIVE")}</span>}
          >
            <p className="text-xs text-gray-400 mb-3">
              {T(lang, "Predicted from this locality's soil, humidity, rainfall & vegetation stress")} — {T(lang, "for")} {farm.village}, {farm.district}.
            </p>
            <div className="space-y-3">
              {envEntry.diseases.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.transmission}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      d.status === "critical" ? "bg-red-600 text-white" : d.status === "high" ? "bg-red-100 text-red-700" : d.status === "watch" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>
                      {d.status.toUpperCase()} · {d.score}/100
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-2">
                    <div className={`h-full ${d.status === "critical" ? "bg-red-600" : d.status === "high" ? "bg-red-400" : d.status === "watch" ? "bg-amber-400" : "bg-green-400"}`} style={{ width: `${d.score}%` }} />
                  </div>
                  {d.reasons.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-2">{T(lang, "Why:")} {d.reasons.join("; ")}.</p>
                  )}
                  <p className="text-[11px] text-gray-500 mt-1">{T(lang, "Do:")} {d.actions?.en} {d.actions?.hi} {d.actions?.mr}</p>
                  {d.status === "critical" && (
                    <p className="text-[11px] text-red-600 font-medium mt-2">
                      ⚠ {T(lang, "Auto-threshold crossed — Animal Guard filed an automatic report to the veterinary dashboard even without a farmer report.")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      )}
    </>
  );
}

function HealthTab({ _farm, health, categories, lang }) {
  const recs = health.filter((r) => categories.includes(r.record_type));
  return (
    <Card title={`💉 ${T(lang, "Health Records")}`} right={<span className="text-[10px] text-gray-400">{recs.length} {recs.length === 1 ? T(lang, "entry") : T(lang, "entries")}</span>}>
      <p className="text-[11px] text-gray-400 mb-3 leading-snug">
        {T(lang, "The herd's health chart — every vaccine, deworming, treatment and mortality event, recorded by the veterinary team and kept in the tamper-evident audit trail.")}
      </p>
      {recs.length === 0 ? (
        <p className="text-sm text-gray-400">{T(lang, "No health records yet. Vaccinations & treatments your veterinary team records appear here.")}</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {recs.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{healthIcon(r.record_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-500 uppercase">{T(lang, healthLabel(r.record_type))}</p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {[r.dose, r.batch && `${T(lang, "Batch")} ${r.batch}`, r.disease && `🎯 ${r.disease}`].filter(Boolean).join(" · ") || "—"}
              </p>
              {r.notes && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{r.notes}</p>}
              {r.drive_name && (
                <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                  📋 {r.drive_name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function VaccinationTab({ farm, health, farmDrives, lang }) {
  const vax = health.filter((r) => r.record_type === "vaccination");
  const care = health.filter((r) => r.record_type === "treatment" || r.record_type === "deworming");
  return (
    <>
      <Card title={`💉 ${T(lang, "Vaccinations")}`} right={<span className="text-[10px] text-gray-400">{vax.length} {vax.length === 1 ? T(lang, "entry") : T(lang, "entries")}</span>}>
        {vax.length === 0 ? (
          <p className="text-sm text-gray-400">{T(lang, "No vaccinations recorded yet.")}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {vax.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {[r.dose, r.batch && `${T(lang, "Batch")} ${r.batch}`, r.disease && `🎯 ${r.disease}`].filter(Boolean).join(" · ") || "—"}
                </p>
                {r.drive_name && (
                  <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                    📋 {r.drive_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`💊 ${T(lang, "Treatments & Deworming")}`} className="mt-4" right={<span className="text-[10px] text-gray-400">{care.length} {care.length === 1 ? T(lang, "entry") : T(lang, "entries")}</span>}>
        {care.length === 0 ? (
          <p className="text-sm text-gray-400">{T(lang, "No treatments or deworming recorded yet.")}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {care.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {[r.dose, r.batch && `${T(lang, "Batch")} ${r.batch}`, r.disease && `🎯 ${r.disease}`].filter(Boolean).join(" · ") || "—"}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {farmDrives.length > 0 && (
        <Card title={`💉 ${T(lang, "Vaccination Drives — coverage for this herd")}`} className="mt-4">
          <div className="grid gap-2 md:grid-cols-2">
            {farmDrives.map((d) => {
              const covered = (d.coverage.covered_farm_ids || []).includes(farm.farm_id);
              return (
                <div key={d.drive_id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">📋 {d.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      covered ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {covered ? `✅ ${T(lang, "Covered")}` : `⚠ ${T(lang, "Not yet covered")}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {d.disease || "—"} · {d.vaccine || "—"} · {T(lang, d.animal_category)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {T(lang, "Drive coverage:")} {d.coverage.farm_coverage_pct}% {T(lang, "farm")} · {d.coverage.animal_coverage_pct}% {T(lang, "animal")}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function ReportsTab({ farm, farmReports, symptoms, expandedReportId, setExpandedReportId }) {
  const navigate = useNavigate();
  const { lang } = useApp();
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate(`/report?farm=${farm.farm_id}`)}
          className="flex-1 min-w-[180px] py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-colors"
        >
          🩺 {T(lang, "Report Symptoms")}
        </button>
        <button
          onClick={() => navigate(`/report?farm=${farm.farm_id}&mode=voice`)}
          className="flex-1 min-w-[180px] py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-colors"
        >
          🎤 {T(lang, "No-Typing Voice Report")}
        </button>
      </div>

      <Card title={`📄 ${T(lang, "Farm Reports")} (${farmReports.length})`} className="mt-4">
        {farmReports.length === 0 ? (
          <p className="text-sm text-gray-400">{T(lang, "No symptom reports submitted yet.")}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {farmReports.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      {r.affected_count || 0} {T(lang, "affected")} {T(lang, r.animal_type)}
                    </span>
                    {(Number(r.deaths) || 0) > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-white font-medium">
                        ⚰️ {r.deaths} {r.deaths !== 1 ? T(lang, "deaths") : T(lang, "death")}
                      </span>
                    )}
                    {r.source === "ai_auto" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        🤖 {T(lang, "AI Alert (auto-sensed)")}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        ✍️ {T(lang, "Manual (farmer)")}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(r.symptoms || []).map((s) => (
                    <span key={s} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                      {T(lang, SYMPTOMS[r.animal_category]?.find((x) => x.id === s)?.label || s)}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5">
                  <ZoonoticBadge item={r} compact />
                </div>
                {r.notes && (
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{r.notes}</p>
                )}
                {r.source === "ai_auto" && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedReportId(expandedReportId === r.id ? null : r.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      {expandedReportId === r.id ? `▾ ${T(lang, "Hide source sensing data")}` : `▸ ${T(lang, "View source sensing data")}`}
                    </button>
                    {expandedReportId === r.id && (
                      <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                        {r.sensing_reading ? (
                          <>
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1.5">
                              {T(lang, "Source sensing reading")} · {new Date(r.sensing_reading.fetched_at).toLocaleString()}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="bg-white rounded-lg px-2 py-1.5 text-center">
                                <span className="block text-[10px] text-gray-400 uppercase">NDVI</span>
                                <span className="text-sm font-semibold text-gray-800">{fmtNum(r.sensing_reading.ndvi)}</span>
                              </span>
                              <span className="bg-white rounded-lg px-2 py-1.5 text-center">
                                <span className="block text-[10px] text-gray-400 uppercase">{T(lang, "Soil temp")}</span>
                                <span className="text-sm font-semibold text-gray-800">{fmtCel(r.sensing_reading.soil_temp)}</span>
                              </span>
                              <span className="bg-white rounded-lg px-2 py-1.5 text-center">
                                <span className="block text-[10px] text-gray-400 uppercase">{T(lang, "Soil moisture")}</span>
                                <span className="text-sm font-semibold text-gray-800">{fmtMoisture(r.sensing_reading.soil_moisture)}</span>
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">row {r.sensing_reading.id} · {r.sensing_reading.fetch_status}</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">{T(lang, "Source sensing data unavailable for this alert.")}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {symptoms.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2">
          {T(lang, "Symptom checklist available for this category:")} {symptoms.map((s) => T(lang, s.label)).join(", ")}.
        </p>
      )}
    </>
  );
}

function LabTab({ _farm, farmSamples }) {
  const { lang } = useApp();
  return (
    <Card title={`🧪 ${T(lang, "Lab Samples & Results")} (${farmSamples.length})`}>
      {farmSamples.length === 0 ? (
        <p className="text-sm text-gray-400">
          {T(lang, "No samples referred yet. The vet sends blood/swab samples to the district lab; the returned result appears here.")}
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {farmSamples.map((s) => {
            const res = SAMPLE_RESULT_LABEL[s.result];
            const st = SAMPLE_STATUS_LABEL[s.status];
            return (
              <div key={s.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900">
                    {SAMPLE_TYPE_LABEL[s.sample_type]?.icon || "🧪"} {T(lang, SAMPLE_TYPE_LABEL[s.sample_type]?.label || s.sample_type)} {T(lang, "sample")}
                  </p>
                  {s.status === "resulted" && res ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${res.cls}`}>
                      {T(lang, res.label)}
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st?.cls}`}>
                      {T(lang, st?.label || s.status)}
                    </span>
                  )}
                </div>
                {(s.suspected_disease || s.test_requested) && (
                  <p className="text-[11px] text-gray-500 mt-1 truncate">
                    {[s.suspected_disease ? `🦠 ${T(lang, "Suspected")} ${s.suspected_disease}` : null, s.test_requested].filter(Boolean).join(" · ")}
                  </p>
                )}
                {s.status === "resulted" && (
                  <p className="text-[11px] text-gray-600 mt-1">
                    {T(lang, "Result:")} {res ? T(lang, res.label) : s.result}
                    {s.pathogen ? ` · 🦠 ${T(lang, "Pathogen:")} ${s.pathogen}` : ""}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  {T(lang, "Collected")} {new Date(s.collected_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {s.resulted_at ? ` · ${T(lang, "Result")} ${new Date(s.resulted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  {" · "}{s.lab_name}
                </p>
                {s.remarks && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{s.remarks}</p>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function LocationTab({ farm, criticalClusters, showRings }) {
  const { lang } = useApp();
  return (
    <Card title={T(lang, "Farm Location & Coverage")}>
      <MapContainer
        center={[farm.lat, farm.lng]}
        zoom={14}
        style={{ height: 300, width: "100%" }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[farm.lat, farm.lng]} icon={markerIcon} />
        {farm.polygon && (
          <Polygon
            positions={farm.polygon}
            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.15, weight: 2 }}
          />
        )}
        {/* Critical outbreak rings (phase 4): 1km inner + 5km outer — officials only */}
        {showRings &&
          criticalClusters.map((cluster) => (
            <Fragment key={cluster.id}>
              <Circle
                center={[cluster.centroid.lat, cluster.centroid.lng]}
                radius={RING_INNER_KM * 1000}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.08, weight: 2 }}
              />
              <Circle
                center={[cluster.centroid.lat, cluster.centroid.lng]}
                radius={RING_OUTER_KM * 1000}
                pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.04, weight: 1.5, dashArray: "6 4" }}
              />
              <CircleMarker
                center={[cluster.centroid.lat, cluster.centroid.lng]}
                radius={6}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1, weight: 1 }}
              />
            </Fragment>
          ))}
      </MapContainer>
      <p className="text-xs text-gray-400 mt-2">
        {T(lang, "Coverage zone:")} ~150m {T(lang, "polygon")} · {farm.polygon_id ? T(lang, "registered server-side") : T(lang, "awaiting registration")}
      </p>
      {!showRings && (
        <p className="text-[11px] text-gray-400 mt-1">
          🔒 {T(lang, "Your farm's location is shown only to you and your authorized veterinary team.")}
        </p>
      )}
    </Card>
  );
}

function AlertsTab({ farmInbox, lang }) {
  return (
    <Card title={`📥 ${T(lang, "Farm Inbox")} — ${T(lang, "Alerts & Advisories")}`}>
      {farmInbox.length === 0 ? (
        <p className="text-sm text-gray-400">{T(lang, "No messages yet.")}</p>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            {farmInbox.map((m) => (
              <div key={m.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    m.type === "vet" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {m.type === "vet" ? `🐮 ${T(lang, "Vet Dispatch")}` : `📢 ${T(lang, "Advisory")}`}
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(m.ts).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{m[lang] || m.en}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------ helpers ------------------------------ */

function InfoItem({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function BarRow({ label, value, max, note }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = pct >= 70 ? "bg-red-400" : pct >= 40 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label} <span className="text-gray-400 text-xs">({note})</span></span>
        <span className="font-medium text-gray-900">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Risk band for the 0-25 Environmental Risk scale (kept neutral when no signal).
function envBand(risk) {
  if (risk == null) return { label: "No signal", cls: "bg-gray-100 text-gray-500" };
  if (risk <= 8) return { label: "Low", cls: "bg-green-100 text-green-700" };
  if (risk <= 16) return { label: "Moderate", cls: "bg-amber-100 text-amber-700" };
  return { label: "High", cls: "bg-red-100 text-red-700" };
}

// ---- Live-sensing formatters (plain numbers; Kelvin surfaces only) ----
function fmtNum(v) {
  return typeof v === "number" ? Number(v).toFixed(3) : "—";
}
function fmtCel(v) {
  if (typeof v !== "number") return "—";
  const c = v > 150 ? v - 273.15 : v; // remote sensors return Kelvin soil/air temps
  return `${c.toFixed(1)}°C`;
}
function fmtMoisture(v) {
  if (typeof v !== "number") return "—";
  // volumetric fraction (0..1) from the soil probe -> readout as %
  const pct = v <= 1 ? v * 100 : v;
  return `${Math.round(pct)}%`;
}

function timeAgo(ts) {
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