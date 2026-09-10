// Voice-first conversational reporting for farmers who don't type.
// Each question is asked out loud (TTS) and the farmer answers by voice (STT)
// in their own language. Recognition + free text are mapped to structured data
// with keyword dictionaries, with tappable chips as a correction fallback.

export const VOICE_LANGS = [
  { code: "en", label: "English", stt: "en-IN", tts: "en-IN" },
  { code: "hi", label: "हिन्दी", stt: "hi-IN", tts: "hi-IN" },
  { code: "mr", label: "मराठी", stt: "mr-IN", tts: "mr-IN" },
];

export const TEXT = (lang) => ({
  hello:
    lang === "hi"
      ? "नमस्ते! मैं आपकी मदद के लिए हूँ। अपने जानवरों के बारे में थोड़े प्रश्न पूछूँगा।"
      : lang === "mr"
        ? "नमस्कार! मी तुम्हाला मदत करतो. तुमच्या जनावरांबद्दल काही प्रश्न विचारतो."
        : "Hello! I will ask a few short questions about your animals. Answer by voice, in your own words.",
  pickFarm:
    lang === "hi"
      ? "पहले बताइए, किस फार्म / खेत के जानवरों की बात है? फार्म का नाम बोलिए या नीचे चुनिए।"
      : lang === "mr"
        ? "आधी सांगा, कोणत्या शेतातील जनावरांचा प्रश्न आहे? शेताचे नाव बोला किंवा खाली निवडा."
        : "First, which farm are these animals on? Say the farm name or tap one below.",
  farmList:
    lang === "hi"
      ? "आपके पंजीकृत फार्म (टैप करें):"
      : lang === "mr"
        ? "तुमची नोंदणीकृत शेते (टॅप करा):"
        : "Your registered farms (tap):",
  farmNewHint:
    lang === "hi"
      ? "नया फार्म है? सिर्फ़ उसका नाम बोलिए — जैसे “मेरा बकरी फार्म” — मैं उसे अपने आप पंजीकृत कर दूँगा।"
      : lang === "mr"
        ? "नवीन शेत आहे? फक्त त्याचे नाव बोला — उदा. “माझं बकरी फार्म” — मी ते आपोआप नोंदवतो."
        : "New farm? Just say its name — e.g. “my goat farm” — I'll register it automatically.",
  pickLang:
    lang === "hi"
      ? "आप भाषा चुनें — हिंदी, मराठी या अंग्रेज़ी।"
      : lang === "mr"
        ? "आपली भाषा निवडा — मराठी, हिंदी किंवा इंग्रजी."
        : "Choose your language — Hindi, Marathi or English.",
  qCount:
    lang === "hi"
      ? "कितने जानवर बीमार या प्रभावित हैं? संख्या बोलिए।"
      : lang === "mr"
        ? "किती जनावरे आजारी किंवा प्रभावित आहेत? संख्या सांगा."
        : "How many animals are sick or affected? Say a number.",
  qCountRetry:
    lang === "hi"
      ? "सिर्फ़ संख्या बोलिए, जैसे पाँच या दस।"
      : lang === "mr"
        ? "फक्त संख्या सांगा, उदाहरणार्थ पाच किंवा दहा."
        : "Just say a number, like five or ten.",
  qSymptoms:
    lang === "hi"
      ? "जानवरों में क्या लक्षण दिख रहे हैं? जैसे बुखार, मुंह में घाव, लंगड़ाना, दूध कम।"
      : lang === "mr"
        ? "जनावरांमध्ये कोणती लक्षणे दिसत आहेत? जसे ताप, तोंडात जखम, लंगडणे, दूध कमी."
        : "What symptoms do you see? For example fever, mouth lesions, lameness, less milk.",
  qNotes:
    lang === "hi"
      ? "कुछ और जानकारी? जैसे कब से शुरू है। नहीं तो छोड़ सकते हैं।"
      : lang === "mr"
        ? "आणखी काही माहिती? जसे केव्हापासून सुरू आहे. नसेल तर सोडू शकता."
        : "Any other information, like since when? You can skip this.",
  done:
    lang === "hi"
      ? "धन्यवाद! आपकी रिपोर्ट भेज दी गई है। पशु चिकित्सक को सूचना मिल गई है।"
      : lang === "mr"
        ? "धन्यवाद! तुमचा अहवाल पाठवला गेला आहे. पशुवैद्याला सूचना मिळाली आहे."
        : "Thank you! Your report was sent and the veterinary team has been notified.",
});

// Keyword dictionaries: symptom id -> { en[], hi[], mr[] } (lowercase infinitive forms).

// Chromium's SpeechRecognition engine does not ship a Marathi (mr-IN) model, so a
// Marathi speaker is heard through the Hindi (hi-IN) engine. Marathi TTS always
// stays Marathi; the farmer confirms/corrects with tappable chips.
export function sttLocale(lang) {
  if (lang === "mr") return "hi-IN";
  return VOICE_LANGS.find((l) => l.code === lang)?.stt || "hi-IN";
}

export function sttNote(lang) {
  if (lang === "mr") {
    return "मराठी व्हॉइस ओळख ह्या ब्राउझरमध्ये नाही — मी हिंदीच्या ओळखणीने ऐकतो. चुकल्यास खालील सूचीतून निवडा किंवा टाइप करा.";
  }
  return null;
}
export const SYMPTOM_KEYWORDS = {
  large_livestock: {
    fever: { en: ["fever", "temperature", "hot", "bukhar", "body heat"], hi: ["बुखार", "ताप"], mr: ["ताप", "बुखार", "ज्वर"] },
    mouth_foot_lesions: {
      en: ["mouth", "foot", "hoof", "lesion", "wound", "ulcer", "blister", "sore", "paa"],
      hi: ["मुंह", "मुह", "पैर", "घाव", "छाला", "खुर", "जख्म"],
      mr: ["तोंड", "पाय", "जखम", "फोडा", "खूर", "घसा"],
    },
    lameness: { en: ["lame", "limp", "limping", "walk", "stand", "not moving"], hi: ["लंगड़ा", "लंगडा", "चल"], mr: ["लंगड", "चाल", "चालण"] },
    reduced_milk: { en: ["milk", "doodh", "yield"], hi: ["दूध"], mr: ["दूध", "दुग्ध"] },
    nasal_discharge: { en: ["nose", "nasal", "mucus", "discharge", "running nose", "drooling"], hi: ["नाक", "स्राव", "नाक बह"], mr: ["नाक", "श्लेष्म", "नाक वाहणे"] },
    sudden_death: { en: ["death", "dead", "died", "dying", "fell down"], hi: ["मौत", "मर गया", "मर गई"], mr: ["मृत्यू", "मेला", "मेले", "मरण"] },
  },
  poultry: {
    egg_drop: { en: ["egg", "eggs", "production"], hi: ["अंडा", "अंडे"], mr: ["अंडी", "अंडे"] },
    respiratory_distress: { en: ["breath", "gasp", "gasping", "cough", "coughing", "respiratory", "sneeze", "sneezing", "wheez"], hi: ["सांस", "खांसी", "साँस"], mr: ["श्वास", "खोकला", "घरघर"] },
    diarrhea: { en: ["diarrhea", "diarrhoea", "loose", "stool", "pasting", "vent", "watery"], hi: ["दस्त", "पतला"], mr: ["जुलाब", "सैल", "पातळ"] },
    ruffled_feathers: { en: ["feather", "feathers", "ruffled", "fluff", "fluffed"], hi: ["पंख"], mr: ["पिसे", "पंख"] },
    swollen_head: { en: ["swollen", "swelling", "swoll", "head", "comb", "face", "eyes"], hi: ["सूजन", "सिर", "चेहरा"], mr: ["सूजन", "डोके", "चेहरा"] },
    mass_mortality: { en: ["mass", "many died", "many dead", "all died", "dying", "dropping dead"], hi: ["कई मर", "मर रहे"], mr: ["अनेक मेले", "मरत आहेत"] },
  },
};

// Spoken numbers for extraction (Hindi / Marathi / English).
const NUMBER_WORDS = {
  hi: { एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छ: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, दश: 10 },
  mr: { एक: 1, दोन: 2, तीन: 3, चार: 4, पाच: 5, सहा: 6, सात: 7, आठ: 8, नऊ: 9, दहा: 10 },
  en: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
};

// Extract the first number the farmer said (digits or spoken word).
export function extractCount(text) {
  if (!text) return null;
  const digits = text.match(/\d+/);
  if (digits) {
    const n = parseInt(digits[0], 10);
    if (n >= 1 && n <= 1000) return n;
  }
  const words = text.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
  for (const lang of ["en", "hi", "mr"]) {
    for (const w of words) {
      if (NUMBER_WORDS[lang][w]) return NUMBER_WORDS[lang][w];
    }
  }
  return null;
}

// Match free text (in any of the supported languages) to symptom ids for the farm.
export function mapSymptoms(text, category) {
  if (!text || !SYMPTOM_KEYWORDS[category]) return [];
  const t = text.toLowerCase();
  const found = [];
  for (const [id, dict] of Object.entries(SYMPTOM_KEYWORDS[category])) {
    const hits = Object.values(dict)
      .flat()
      .some((k) => k && t.includes(k.toLowerCase()));
    if (hits) found.push(id);
  }
  return found;
}

// Best guess for "how long / since when" free text stays as notes verbatim.

export function speechSupported() {
  return Boolean(
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}