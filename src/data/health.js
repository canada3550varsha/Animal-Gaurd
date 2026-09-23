// Herd-level health ledger metadata: record types, icons and suggested vaccine/drug catalogs.

export const HEALTH_TYPES = [
  { value: "vaccination", icon: "💉", label: "Vaccination" },
  { value: "treatment", icon: "💊", label: "Treatment" },
  { value: "deworming", icon: "🌰", label: "Deworming" },
  { value: "mortality", icon: "⚰️", label: "Mortality" },
];

export const HEALTH_TYPE_LABEL = Object.fromEntries(
  HEALTH_TYPES.map((t) => [t.value, { icon: t.icon, label: t.label }])
);

export function healthIcon(type) {
  return HEALTH_TYPE_LABEL[type]?.icon || "📋";
}

export function healthLabel(type) {
  return HEALTH_TYPE_LABEL[type]?.label || type;
}

export const DRIVE_STATUS_LABEL = {
  planned: { label: "Planned", cls: "bg-gray-100 text-gray-600" },
  active: { label: "Active", cls: "bg-green-700 text-white" },
  completed: { label: "Completed", cls: "bg-blue-700 text-white" },
};

// Lab sample types, statuses and returned results.
export const SAMPLE_TYPE_LABEL = {
  blood: { icon: "🩸", label: "Blood" },
  swab: { icon: "🧻", label: "Swab" },
  feces: { icon: "🟫", label: "Feces" },
  milk: { icon: "🥛", label: "Milk" },
  tissue: { icon: "🔪", label: "Tissue" },
};

export const SAMPLE_STATUS_LABEL = {
  awaiting_result: { label: "In lab — awaiting result", cls: "bg-amber-100 text-amber-700" },
  resulted: { label: "Result returned", cls: "bg-gray-100 text-gray-600" },
};

export const SAMPLE_RESULT_LABEL = {
  positive: { label: "Positive", cls: "bg-red-100 text-red-700" },
  negative: { label: "Negative", cls: "bg-green-100 text-green-700" },
};

export const VACCINE_CATALOG = [
  "FMD Trivalent Vaccine",
  "Goat Pox Vaccine",
  "PPR Vaccine",
  "LSD (Lumpy Skin Disease) Vaccine",
  "Ranikhet (ND) Vaccine",
  "Anthrax Spore Vaccine",
  "Brucellosis (Rev-1) Vaccine",
  "HS Vaccine",
  "BQ Vaccine",
  "Avian Influenza Vaccine",
  "IBD (Gumboro) Vaccine",
  "Marek's Disease Vaccine",
  "Footrot Vaccine",
  "Enterotoxaemia Vaccine",
];

export const DRUG_CATALOG = [
  "Oxytetracycline 10%",
  "Enrofloxacin 10%",
  "Penicillin + Streptomycin",
  "Tylosin",
  "Fenbendazole (Dewormer)",
  "Ivermectin",
  "Albendazole",
  "Meloxicam",
  "Paracetamol",
  "Calcium Borogluconate",
  "ORS + Electrolytes",
  "ORS (Oral Rehydration Salts)",
];

// Veterinary case workflow status language. Derived from live cluster state +
// whether the office has responded (dispatched / sample referred / result in).
export const CASE_FLOW_STATUS = {
  NEW: { label: "NEW", cls: "bg-blue-600 text-white", icon: "🆕" },
  UNDER_REVIEW: { label: "UNDER REVIEW", cls: "bg-indigo-600 text-white", icon: "🔎" },
  VISIT_REQUIRED: { label: "VISIT REQUIRED", cls: "bg-red-600 text-white", icon: "🏥" },
  SAMPLE_COLLECTED: { label: "SAMPLE COLLECTED", cls: "bg-amber-500 text-white", icon: "🧪" },
  LAB_PENDING: { label: "LAB PENDING", cls: "bg-orange-500 text-white", icon: "🔬" },
  RESULT_AVAILABLE: { label: "RESULT AVAILABLE", cls: "bg-purple-600 text-white", icon: "📋" },
  ACTION_REQUIRED: { label: "ACTION REQUIRED", cls: "bg-rose-600 text-white", icon: "🚨" },
  RESOLVED: { label: "RESOLVED", cls: "bg-green-600 text-white", icon: "✅" },
};

// Map a cluster + response context to one of the 8 workflow states.
// ctx: { dispatched: bool, resolved: bool, sample: { status } | null }
export function caseFlowStatus(cluster, ctx = {}) {
  if (ctx.resolved) return CASE_FLOW_STATUS.RESOLVED;
  if (ctx.sample?.status === "resulted") return CASE_FLOW_STATUS.RESULT_AVAILABLE;
  if (ctx.sample?.status === "awaiting_result") return CASE_FLOW_STATUS.LAB_PENDING;
  if (ctx.sample) return CASE_FLOW_STATUS.SAMPLE_COLLECTED;
  if (ctx.dispatched && cluster.level === "critical") return CASE_FLOW_STATUS.VISIT_REQUIRED;
  if (ctx.dispatched) return CASE_FLOW_STATUS.UNDER_REVIEW;
  if (cluster.level === "critical") return CASE_FLOW_STATUS.ACTION_REQUIRED;
  return CASE_FLOW_STATUS.NEW;
}

export const DISEASE_CATALOG = [
  "Foot and Mouth Disease",
  "Lumpy Skin Disease",
  "Peste des Petits Ruminants",
  "Goat Pox",
  "Newcastle Disease",
  "Anthrax",
  "Brucellosis",
  "Hemorrhagic Septicemia",
  "Black Quarter",
  "Avian Influenza",
  "Gumboro (IBD)",
  "Coccidiosis",
  "Parasitic Infestation",
  "Mastitis",
];