import { useNavigate } from "react-router-dom";

// System Architecture — Smart India Hackathon 2026 national finalist (SIH26128).
// Shows the 3-tier disease early-warning pipeline, clearly labeling what is LIVE
// in this prototype vs. what is a future/roadmap integration.

const TIERS = [
  {
    id: 1,
    title: "Remote Sensing Area-Risk",
    icon: "🛰️",
    live: true,
    tag: "LIVE — remote sensing + auto-sensing",
    blurb:
      "Every farm polygon is registered server-side with a remote-sensing provider. Soil moisture, surface temperature, NDVI/NDWI vegetation stress and 7-day rainfall are pulled live per farm to compute the Environmental Risk (0–25) component of FDRS — and to predict which diseases (FMD, LSD, Bluetongue, HS, heat stress, HPAI, coccidiosis…) are likely in that locality right now.",
    highlights: ["NDVI / NDWI vegetation stress", "Soil moisture, humidity & 7-day rainfall", "Location-based disease prediction (watch/high/critical)", "AUTONOMOUS sensing — files reports without the farmer"],
  },
  {
    id: 2,
    title: "Edge-AI Individual Screening",
    icon: "🩺",
    live: true,
    tag: "LIVE — symptom + AI vision",
    blurb:
      "Farmers submit targeted symptom checklists (validated per species) and optional photos. An AI vision endpoint describes visible signs with a confidence score, feeding the Reported-Cases (0–35) component of FDRS.",
    highlights: ["Per-species symptom whitelist", "Photo upload + AI vision analysis", "Reported-Cases risk scoring", "Input validation & rate limiting"],
  },
  {
    id: 3,
    title: "Outbreak Urgency Engine",
    icon: "🧠",
    live: true,
    tag: "LIVE — spatio-temporal clustering",
    blurb:
      "Reports are clustered by animal category within 4 km and 48 h. 3+ reports = Emerging; 8+ = CRITICAL. The 1 km / 5 km containment rings and the FDRS Liver/Historical/Nearby components combine into a single outbreak urgency picture.",
    highlights: ["Per-category clustering (no cross-mixing)", "Emerging (3+) / Critical (8+) thresholds", "1 km & 5 km response rings", "Multi-lingual alert (EN/MR/HI)"],
  },
  {
    id: 4,
    title: "Vet Dispatch & Response",
    icon: "🚓",
    live: true,
    tag: "LIVE — officer dashboard + audit",
    blurb:
      "Officer/vet dashboard surfaces CRITICAL outbreaks with one-tap dispatch and advisory broadcast. Every dispatch is written to a tamper-evident SHA-256 hash-chain audit log; role-based access keeps actions scoped and traceable.",
    highlights: ["One-tap vet dispatch / advisory", "Tamper-evident audit chain", "Role-based access (farmer/vet/admin)", "Farm inbox in 3 languages"],
  },
];

const ROADMAP = [
  {
    icon: "📲",
    title: "Real SMS / broadcast gateway",
    desc: "Replace in-app multilingual inbox with authenticated SMS/voice alerts to farmers in the outbreak ring.",
  },
  {
    icon: "🏛️",
    title: "Government DB integration",
    desc: "Two-way sync with Maharashtra veterinary & DAHDF records, e.g. vaccination registers and sentinel lab results.",
  },
  {
    icon: "🔐",
    title: "Federated farmer identity",
    desc: "Authenticate via UMANG/Tele-MANAS-compatible OTP and map farms to a national livestock census ID.",
  },
  {
    icon: "🌐",
    title: "Broader sensor network",
    desc: "Ingest IoT camera feeds and drone thermal imaging to automate early lesion detection beyond farmer-submitted reports.",
  },
];

export default function ArchitectureScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-gray-900 text-white px-4 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-xl">←</button>
          <div>
            <h1 className="text-lg font-bold">System Architecture</h1>
            <p className="text-xs text-gray-400">Smart India Hackathon 2026 · SIH26128 · Govt of Maharashtra</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Intro */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Animal Guard — Livestock Disease Early Warning</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            A 3-tier early-warning system for <strong className="text-gray-900">smart India Hackathon — SIH26128</strong> (Govt of Maharashtra),
            converting remote sensing and farmer-reported signals into a <strong className="text-gray-900">per-farm FDRS (0–100)</strong> risk score and
            a spatio-temporally clustered outbreak urgency decision for rapid vet dispatch. This build runs end-to-end; future
            integrations are clearly marked as roadmap.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge live>3-tier pipeline — LIVE</Badge>
            <Badge>Secure backend proxying</Badge>
            <Badge>Role-based access</Badge>
            <Badge>Tamper-evident audit</Badge>
          </div>
        </section>

        {/* Tier flow */}
        <section>
          <h3 className="text-lg font-bold text-gray-800 mb-3">Data Flow</h3>
          <div className="space-y-0">
            {TIERS.map((tier, i) => (
              <div key={tier.id}>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl shrink-0">{tier.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-bold text-gray-900">
                          Tier {tier.id} — {tier.title}
                        </h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          tier.live ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {tier.tag}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{tier.blurb}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {tier.highlights.map((h) => (
                          <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                            ✓ {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {i < TIERS.length - 1 && (
                  <div className="flex justify-center py-1 text-gray-300 text-xl select-none">▼</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Live vs roadmap summary */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Live vs. Future Roadmap</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="font-semibold text-green-800 mb-2">🟢 Live in this build</p>
              <ul className="text-sm text-green-900 space-y-1.5">
                <li>· Remote sensing polygon, soil, NDVI/NDWI &amp; rainfall (real API proxy)</li>
                <li>· AI vision photo screening + symptom checklist (real API proxy)</li>
                <li>· Spatio-temporal clustering (Emerging/Critical) per animal category</li>
                <li>· FDRS risk engine with NearbyOutbreak containment rings</li>
                <li>· Officer dispatch + multilingual advisory, session auth & audit log</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="font-semibold text-blue-800 mb-2">🔵 Future roadmap</p>
              <ul className="text-sm text-blue-900 space-y-1.5">
                {ROADMAP.map((r) => (
                  <li key={r.title}>· <strong>{r.title}</strong> — {r.desc}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA for judges */}
        <section className="bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl p-6 text-center">
          <h3 className="text-xl font-bold mb-2">See the full journey live</h3>
          <p className="text-sm text-green-100 mb-4">
            Walk through the complete cycle: register a farm → real remote sensing risk loads → submit reports → outbreak triggers → vet dispatch alert.
          </p>
          <button
            onClick={() => navigate("/walkthrough")}
            className="bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors"
          >
            🎬 Judge Walkthrough
          </button>
        </section>
      </main>
    </div>
  );
}

function Badge({ live = false, children }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
      live ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"
    }`}>
      {children}
    </span>
  );
}
