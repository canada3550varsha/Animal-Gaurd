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