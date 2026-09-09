// Autonomous disease-prediction model.
//
// Takes the farm's LIVE remote-sensing envelope (temp, humidity, 7-day rain,
// NDVI/NDWI vegetation stress, soil moisture) and predicts which livestock /
// poultry diseases are most likely in that locality RIGHT NOW, using the
// established environmental epidemiology of Maharashtra (Kharif/Rabi rainy
// season, deccan plateau heat, monsoon waterlogging, etc.).
//
// Every score is fully explainable: it is the sum of active, named signals.
// When any disease crosses AUTO_TRIGGER_SCORE, the server files an automatic
// report into the same clustering → dispatch pipeline — even if the farmer
// never opened the app.

export const AUTO_TRIGGER_SCORE = 75;
export const AUTO_COOLDOWN_MS = 6 * 60 * 60 * 1000; // one auto-report per farm+disease / 6h

const temp = (env) => env?.weather?.temp; // °C
const humidity = (env) => env?.weather?.humidity; // %
const rain7d = (env) => env?.weather?.rain7d; // mm / 7d
const ndvi = (env) => env?.sat?.ndvi; // vegetation stress
const water = (env) => (typeof env?.sat?.dswi === "number" ? env.sat.dswi : env?.sat?.ndwi);
const soilM = (env) => env?.soil?.moisture; // 0..1

const between = (v, lo, hi) => typeof v === "number" && v >= lo && v <= hi;
const above = (v, t) => typeof v === "number" && v > t;
const below = (v, t) => typeof v === "number" && v < t;

// A weighable, human-readable condition. `when` returns true/false/null and
// the label is shown as proof of why the score is what it is.
function sig(label, points, when) {
  return { label, points, when };
}

const DISEASES = {
  large_livestock: [
    {
      id: "fmd",
      name: "Foot-and-Mouth Disease (FMD)",
      transmission: "Contagious; thrives in wet, warm conditions.",
      symptoms: ["fever", "mouth_foot_lesions", "reduced_milk"],
      signals: [
        sig("High humidity (≥70%)", 30, (e) => above(humidity(e), 70)),
        sig("Substantial rain last 7 days (≥30mm)", 25, (e) => above(rain7d(e), 30)),
        sig("Warm season range 20–30°C", 20, (e) => between(temp(e), 20, 30)),
        sig("Waterlogging detected (high water index)", 15, (e) => above(water(e), 0.55)),
        sig("Elevated soil moisture", 10, (e) => above(soilM(e), 0.55)),
      ],
      actions: {
        en: "Quarantine sick animals, disinfect feet/mouth, vaccinate FMD (trivalent), report immediately.",
        hi: "बीमार जानवरों को अलग करें, मुँह-खुर की सफ़ाई करें, FMD टीका लगवाएँ, तुरंत रिपोर्ट करें।",
        mr: "आजारी जनावरे वेगळी ठेवा, तोंड-खूर स्वच्छ करा, FMD लस द्या, लगेच तक्रार करा.",
      },
    },
    {
      id: "lsd",
      name: "Lumpy Skin Disease (LSD)",
      transmission: "Vectored by flies/tick-biting midges; peaks in hot, humid spells.",
      symptoms: ["fever", "reduced_milk", "nasal_discharge"],
      signals: [
        sig("Hot: ≥30°C", 30, (e) => above(temp(e), 30)),
        sig("Moderately humid 50–80%", 22, (e) => between(humidity(e), 50, 80)),
        sig("Vegetation stress (low NDVI < 0.35)", 18, (e) => below(ndvi(e), 0.35)),
        sig("Recent rain enabling vectors (≥15mm/7d)", 15, (e) => above(rain7d(e), 15)),
      ],
      actions: {
        en: "Control flies/midges, isolate lumps, get Goatpox/LSD vaccine, call vet for supportive care.",
        hi: "मक्खी-मच्छर नियंत्रण करें, लंप अलग करें, LSD टीका लगवाएँ, पशु चिकित्सक को बुलाएँ।",
        mr: "माशी-डास नियंत्रित करा, गाठी वेगळ्या करा, LSD लस घ्या, पशुवैद्याला बोलावा.",
      },
    },
    {
      id: "bluetongue",
      name: "Bluetongue (BT)",
      transmission: "Midge-borne; surges after monsoon rains in the deccan belt.",
      symptoms: ["fever", "nasal_discharge", "lameness"],
      signals: [
        sig("Heavy rain ≥40mm/7d", 30, (e) => above(rain7d(e), 40)),
        sig("High humidity ≥75%", 25, (e) => above(humidity(e), 75)),
        sig("Warm 20–32°C", 20, (e) => between(temp(e), 20, 32)),
        sig("Waterlogging (high water index)", 12, (e) => above(water(e), 0.5)),
      ],
      actions: {
        en: "Stall animals at dawn/dusk, apply repellents, vaccinate before next season, report sick sheep/goats.",
        hi: "सुबह-शाम जानवरों को घर में रखें, प्रतिरोधक लगाएँ, अगले मौसम से पहले टीका लगवाएँ।",
        mr: "सकाळ-संध्याकाळ जनावरे गोठ्यात ठेवा, प्रतिबंधक लावा, पुढील हंगामापूर्वी लस द्या.",
      },
    },
    {
      id: "heat_stress_mastitis",
      name: "Heat-Stress Mastitis Risk",
      transmission: "Peak-summer dehydration & metabolic stress; udder re-infection chance rises.",
      symptoms: ["reduced_milk", "fever"],
      signals: [
        sig("Severe heat ≥33°C", 32, (e) => above(temp(e), 33)),
        sig("Dry spell (rain <8mm/7d)", 20, (e) => typeof rain7d(e) === "number" && rain7d(e) < 8 && rain7d(e) >= 0),
        sig("Low humidity <40%", 18, (e) => below(humidity(e), 40)),
        sig("Drought stress (NDVI < 0.25)", 12, (e) => below(ndvi(e), 0.25)),
      ],
      actions: {
        en: "Provide shade + clean water, increase milking frequency, wash udder, monitor for mastitis.",
        hi: "छाया व साफ़ पानी दें, दुहाई बढ़ाएँ, थन साफ़ रखें, दूध में बदलाव देखें।",
        mr: "सावली व स्वच्छ पाणी द्या, दुधाइ वाढवा, कास स्वच्छ ठेवा, दुधातील बदल पहा.",
      },
    },
    {
      id: "hs",
      name: "Haemorrhagic Septicaemia (HS)",
      transmission: "Bacterial; erupts in cattle/buffalo during the rainy season.",
      symptoms: ["fever", "nasal_discharge", "sudden_death"],
      signals: [
        sig("Monsoon: rain ≥50mm/7d", 30, (e) => above(rain7d(e), 50)),
        sig("Very humid ≥80%", 20, (e) => above(humidity(e), 80)),
        sig("Warm–hot 25–32°C", 15, (e) => between(temp(e), 25, 32)),
        sig("Waterlogged pasture (water index)", 15, (e) => above(water(e), 0.5)),
      ],
      actions: {
        en: "Emergency: antibiotic course from vet, vaccinate herd, move animals to raised dry ground.",
        hi: "आपात: पशु चिकित्सक का एंटीबायोटिक, पूरे झुंड को टीका, जानवरों को सूखी ऊँची जगह ले जाएँ।",
        mr: "आपत्काळ: पशुवैद्याकडून प्रतिजैविक, कळपाला लस, जनावरे कोरड्या जागी न्या.",
      },
    },
  ],
  poultry: [
    {
      id: "hpai_risk",
      name: "Avian Influenza (HPAI) Risk",
      transmission: "Wild waterfowl → backyard poultry via wet areas; monsoon raises exposure.",
      symptoms: ["sudden_death", "respiratory_distress", "egg_drop"],
      signals: [
        sig("Wet: rain ≥40mm/7d", 30, (e) => above(rain7d(e), 40)),
        sig("Very humid ≥75%", 25, (e) => above(humidity(e), 75)),
        sig("Water on land (high water index)", 20, (e) => above(water(e), 0.55)),
        sig("Sudden-cooling swings", 10, (e) => between(temp(e), 15, 22)),
      ],
      actions: {
        en: "Block wild bird contact, keep flocks indoors, report sudden death to vet immediately.",
        hi: "जंगली पक्षियों से संपर्क रोकें, मुर्गियों को घर में रखें, अचानक मृत्यु की सूचना दें।",
        mr: "जंगली पक्ष्यांशी संपर्क थांबवा, कोंबड्या आत ठेवा, अचानक मृत्यूची सूचना द्या.",
      },
    },
    {
      id: "coccidiosis",
      name: "Coccidiosis",
      transmission: "Damp litter protozoa; very common in monsoon humidity.",
      symptoms: ["diarrhea", "ruffled_feathers"],
      signals: [
        sig("Humid ≥70% litter risk", 26, (e) => above(humidity(e), 70)),
        sig("Rain ≥25mm/7d", 20, (e) => above(rain7d(e), 25)),
        sig("Warm 20–30°C", 18, (e) => between(temp(e), 20, 30)),
        sig("Waterlogged floor (soil moisture)", 12, (e) => above(soilM(e), 0.6)),
      ],
      actions: {
        en: "Change litter, dry the shed, add anti-coccidial to water, isolate blood-stained droppings.",
        hi: "बिस्तर बदलें, शेड सुखाएँ, पानी में रोगनिरोधी दें, खूनी मल को अलग करें।",
        mr: "भुईवर बदला, शेड कोरडा करा, पाण्यात प्रतिबंधक द्या, रक्ताने दूषित विष्ठा वेगळी करा.",
      },
    },
    {
      id: "fowl_cholera",
      name: "Fowl Cholera",
      transmission: "Bacteria; cold + damp nights trigger outbreaks.",
      symptoms: ["respiratory_distress", "diarrhea", "sudden_death"],
      signals: [
        sig("Cooler air ≤18°C", 28, (e) => below(temp(e), 18)),
        sig("Humid ≥70%", 22, (e) => above(humidity(e), 70)),
        sig("Rain ≥20mm/7d", 15, (e) => above(rain7d(e), 20)),
      ],
      actions: {
        en: "Ventilate but draft-proof shed, vaccine in endemic areas, remove dead birds promptly.",
        hi: "शेड हवादार पर ठंडी हवा से बचाएँ, टीकाकरण, मरे पक्षी तुरंत हटाएँ।",
        mr: "शेड हवेशीर ठेवा पण थंडीपासून वाचवा, लस द्या, मृत पक्षी लगेच काढा.",
      },
    },
    {
      id: "heat_stress_poultry",
      name: "Heat-Stress Mortality Risk",
      transmission: "Summer heat; mortality spikes in poorly ventilated sheds.",
      symptoms: ["respiratory_distress", "egg_drop", "ruffled_feathers"],
      signals: [
        sig("Extreme heat ≥35°C", 34, (e) => above(temp(e), 35)),
        sig("Very low humidity <35%", 20, (e) => below(humidity(e), 35)),
        sig("Drought vegetation stress", 12, (e) => below(ndvi(e), 0.25)),
      ],
      actions: {
        en: "Increase ventilation, provide cool drinking water, reduce stocking density by 20%.",
        hi: "हवादार बनाएँ, ठंडा पानी दें, भीड़ घटाएँ।",
        mr: "हवेशीर करा, थंड पाणी द्या, गर्दी कमी करा.",
      },
    },
    {
      id: "infectious_bronchitis",
      name: "Infectious Bronchitis (IB)",
      transmission: "Airborne; humidity + cool swings stress respiratory tract.",
      symptoms: ["respiratory_distress", "egg_drop", "ruffled_feathers"],
      signals: [
        sig("Humid ≥75%", 26, (e) => above(humidity(e), 75)),
        sig("Cool night range 15–24°C", 20, (e) => between(temp(e), 15, 24)),
        sig("Rain ≥15mm/7d", 16, (e) => above(rain7d(e), 15)),
      ],
      actions: {
        en: "Warm the shed at night, vaccinate chicks, boost vitamin A/E, watch for gasping.",
        hi: "रात को शेड गर्म रखें, चूज़ों को टीका, विटामिन दें, साँस की जाँच करें।",
        mr: "रात्री शेड उबदार ठेवा, पिलांना लस, व्हिटॅमिन द्या, श्वास तपासा.",
      },
    },
  ],
};

const clamp100 = (n) => Math.max(0, Math.min(100, n));

// Evaluate every disease for a category against the live env envelope.
// Returns a descending list of { id, name, transmission, score, status,
// reasons[], symptoms[], actions } with scores that actually fired.
export function evaluateSync(env, category) {
  const list = (DISEASES[category] || []).map((d) => {
    let score = 0;
    const reasons = [];
    for (const s of d.signals) {
      if (s.when(env)) {
        score += s.points;
        reasons.push(s.label);
      }
    }
    score = clamp100(score);
    const status = score >= AUTO_TRIGGER_SCORE ? "critical" : score >= 55 ? "high" : score >= 30 ? "watch" : "low";
    return { id: d.id, name: d.name, transmission: d.transmission, score, status, reasons, symptoms: d.symptoms, actions: d.actions };
  });
  return list.filter((d) => d.score >= 30).sort((a, b) => b.score - a.score);
}

// Does this disease actually look dangerous here? (auto-report gate)
export function isCritical(env, category) {
  return evaluateSync(env, category).some((d) => d.status === "critical");
}

// Build a human (and vet-readable) auto report from the strongest disease hit.
export function topRisk(env, category) {
  return evaluateSync(env, category)[0] || null;
}

// Shape the AI-sensed report that enters the clustering -> dispatch pipeline.
// `sensingReadingId` is the exact sensing_readings row whose values were evaluated —
// the AI alert is always traceable back to the raw reading that triggered it.
export function buildAutoReport(farm, hit, { sensingReadingId = null, envRisk = null, ts = new Date().toISOString() } = {}) {
  const affected = Math.max(1, Math.round((Number(farm.herd_size) || 50) * 0.05));
  return {
    id: `rpt_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    farm_id: farm.farm_id,
    animal_category: farm.animal_category,
    animal_type: farm.animal_type,
    symptoms: hit.symptoms,
    affected_count: affected,
    notes: `🤖 AI Alert (auto-sensed) — ${hit.name} risk ${hit.score}/100 in ${farm.village}, ${farm.district}. ${hit.reasons.join("; ")}. Detected automatically from remote-sensing; no farmer report required.`,
    source: "ai_auto",
    sensing_reading_id: sensingReadingId,
    env_risk: envRisk,
    lat: farm.lat,
    lng: farm.lng,
    village: farm.village,
    taluka: farm.taluka,
    district: farm.district,
    created_at: ts,
  };
}