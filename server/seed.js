// Server-side seed data. PII (phone, exact GPS) lives ONLY here, never on the client.

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export const SEED_USERS = [
  // Demo farmer — owns the 4 seed farms
  { id: "u_farmer1", mobile: "9876543210", name: "Farmer 3210", role: "farmer", district: null, taluka: null },
  // Demo vet/officer — assigned to Pune district
  { id: "u_vet1", mobile: "9123456780", name: "Dr. Anil Veterinary", role: "vet", district: "Pune", taluka: "Haveli" },
  // Demo admin — full access
  { id: "u_admin1", mobile: "9988776655", name: "Admin Officer", role: "admin", district: null, taluka: null },
  // Demo district laboratory — receives referred samples and returns results
  { id: "u_lab1", mobile: "9000000001", name: "District Vet Lab · Pune", role: "lab", district: "Pune", taluka: null },
];

// All demo accounts accept any 4-digit code; we match on mobile.
// Map mobile -> user (PII kept server-side).
export const USER_BY_MOBILE = Object.fromEntries(SEED_USERS.map((u) => [u.mobile, u]));

// Farm PII (exact GPS) stored only server-side.
export const SEED_FARMS = [
  {
    farm_id: "farm_1001",
    name: "Sharma Dairy Farm",
    user_id: "u_farmer1",
    animal_category: "large_livestock",
    animal_type: "cattle",
    herd_size: 45,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    lat: 18.452,
    lng: 73.878,
    polygon_id: null,
  },
  {
    farm_id: "farm_1002",
    name: "Patil Buffalo Herd",
    user_id: "u_farmer1",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    herd_size: 30,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    lat: 18.4621,
    lng: 73.8874,
    polygon_id: null,
  },
  {
    farm_id: "farm_1003",
    name: "Wanwadi Layer Farm",
    user_id: "u_farmer1",
    animal_category: "poultry",
    animal_type: "chicken",
    herd_size: 200,
    village: "Wanwadi",
    taluka: "Haveli",
    district: "Pune",
    lat: 18.471,
    lng: 73.898,
    polygon_id: null,
  },
  {
    farm_id: "farm_1004",
    name: "Kalmeshwar Duck Farm",
    user_id: "u_farmer1",
    animal_category: "poultry",
    animal_type: "duck",
    herd_size: 150,
    village: "Kalmeshwar",
    taluka: "Nagpur Rural",
    district: "Nagpur",
    lat: 21.233,
    lng: 79.017,
    polygon_id: null,
  },
];

export const SEED_REPORTS = [
  {
    id: "seed_ls_1",
    farm_id: "farm_1001",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["fever", "mouth_foot_lesions"],
    affected_count: 6,
    deaths: 1,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(30),
  },
  {
    id: "seed_ls_2",
    farm_id: "farm_1001",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["mouth_foot_lesions", "reduced_milk", "lameness"],
    affected_count: 9,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(24),
  },
  {
    id: "seed_ls_3",
    farm_id: "farm_1001",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["mouth_foot_lesions", "nasal_discharge"],
    affected_count: 4,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(16),
  },
  {
    id: "seed_ls_4",
    farm_id: "farm_1002",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["fever", "lameness", "sudden_death"],
    affected_count: 3,
    deaths: 2,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(20),
  },
  {
    id: "seed_ls_5",
    farm_id: "farm_1002",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["mouth_foot_lesions", "fever"],
    affected_count: 5,
    deaths: 1,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(12),
  },
  {
    id: "seed_ls_6",
    farm_id: "farm_1002",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["lameness", "reduced_milk"],
    affected_count: 2,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(6),
  },
  {
    id: "seed_po_1",
    farm_id: "farm_1003",
    animal_category: "poultry",
    animal_type: "chicken",
    symptoms: ["egg_drop"],
    affected_count: 40,
    deaths: 8,
    lat: 18.471,
    lng: 73.898,
    village: "Wanwadi",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(10),
  },
  {
    id: "seed_po_2",
    farm_id: "farm_1004",
    animal_category: "poultry",
    animal_type: "duck",
    symptoms: ["ruffled_feathers"],
    affected_count: 3,
    deaths: 1,
    lat: 21.233,
    lng: 79.017,
    village: "Kalmeshwar",
    taluka: "Nagpur Rural",
    district: "Nagpur",
    created_at: hoursAgo(3),
  },
];

function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function daysIn(d) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

// Seed herd-level health ledger: vaccinations, treatments, deworming, mortality.
// Recorded by the demo vet for the Pune demo farms so the health chart, drive
// coverage and audit story start populated.
export const SEED_HEALTH = [
  {
    id: "seed_hlth_1",
    farm_id: "farm_1001",
    record_type: "vaccination",
    name: "FMD Trivalent Vaccine",
    disease: "Foot and Mouth Disease",
    dose: "2 ml/animal SC",
    batch: "FMD-2609-A",
    date: daysAgo(10),
    notes: "45 animals covered; booster due in ~6 months",
    actor: "u_vet1",
    animals: 45,
    drive_id: "drv_fmd_haveli_2026",
    ts: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: "seed_hlth_2",
    farm_id: "farm_1001",
    record_type: "deworming",
    name: "Fenbendazole (Dewormer)",
    dose: "7.5 ml/animal oral",
    batch: "FBZ-2608-B",
    date: daysAgo(60),
    notes: "Routine 2-monthly deworming",
    actor: "u_vet1",
    ts: Date.now() - 60 * 24 * 60 * 60 * 1000,
  },
  {
    id: "seed_hlth_3",
    farm_id: "farm_1002",
    record_type: "vaccination",
    name: "HS + BQ Vaccine",
    disease: "Hemorrhagic Septicemia / Black Quarter",
    dose: "2 ml/animal SC",
    batch: "HSBQ-2601-C",
    date: daysAgo(90),
    notes: "30 buffaloes covered",
    actor: "u_vet1",
    ts: Date.now() - 90 * 24 * 60 * 60 * 1000,
  },
  {
    id: "seed_hlth_4",
    farm_id: "farm_1003",
    record_type: "vaccination",
    name: "Ranikhet (ND) Vaccine",
    disease: "Newcastle Disease",
    dose: "Live LaSota, drinking-water route",
    batch: "ND-2591-D",
    date: daysAgo(45),
    notes: "200 layers covered",
    actor: "u_vet1",
    ts: Date.now() - 45 * 24 * 60 * 60 * 1000,
  },
  {
    id: "seed_hlth_5",
    farm_id: "farm_1001",
    record_type: "treatment",
    name: "Oxytetracycline 10%",
    dose: "1 ml/5 kg IM",
    batch: "OTC-2605-E",
    date: daysAgo(10),
    notes: "Fever + respiratory cases responded well",
    actor: "u_vet1",
    ts: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
];

// Seed vaccination drives. The FMD drive is running now: Sharma Dairy Farm
// (Wadgaon Sheri) is already covered via seed_hlth_1; Patil Buffalo Herd
// (Undri) is still-to-do — so the dashboard opens showing a live 50% farm
// coverage and an explicit Undri gap (the "coverage evidencing" story).
export const SEED_DRIVES = [
  {
    drive_id: "drv_fmd_haveli_2026",
    name: "FMD Drive — Haveli Monsoon 2026",
    disease: "Foot and Mouth Disease",
    vaccine: "FMD Trivalent Vaccine",
    taluka: "Haveli",
    district: "Pune",
    animal_category: "large_livestock",
    start_date: daysAgo(20),
    end_date: daysIn(30),
    status: "active",
    created_by: "u_vet1",
    created_at: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
];

// Seed lab samples. smp_2 already came back POSITIVE (HS) so Farm Detail and
// the audit log open with a real result; smp_1 is "awaiting_result" so the lab
// demo can record a live result during the walkthrough.
export const SEED_SAMPLES = [
  {
    id: "smp_2",
    farm_id: "farm_1001",
    animal_category: "large_livestock",
    animal_type: "cattle",
    sample_type: "swab",
    suspected_disease: "Haemorrhagic Septicaemia",
    test_requested: "HS — bacteriological culture",
    lab_name: "District Veterinary Laboratory, Pune",
    status: "resulted",
    collected_by: "u_vet1",
    result: "positive",
    pathogen: "Pasteurella multocida",
    remarks: "Peripheral blood + nasal swab; culture confirmed HS.",
    collected_at: hoursAgo(30),
    resulted_at: hoursAgo(20),
  },
  {
    id: "smp_1",
    farm_id: "farm_1002",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    sample_type: "blood",
    suspected_disease: "Foot and Mouth Disease",
    test_requested: "ELISA — FMD serotype panel",
    lab_name: "District Veterinary Laboratory, Pune",
    status: "awaiting_result",
    collected_by: "u_vet1",
    collected_at: hoursAgo(6),
  },
];
