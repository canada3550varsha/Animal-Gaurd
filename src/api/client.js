// Frontend API client. Only the JWT (session token) is persisted to browser storage.
// All Agro/OpenWeather/vision calls happen server-side; the client never holds keys or PII.

const BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "animalguard_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (mobile, code) => request("/auth/login", { method: "POST", body: { mobile, code } }),
  me: (token) => request("/auth/me", { token }),

  farms: (token) => request("/farms", { token }),
  getFarm: (token, id) => request(`/farms/${id}`, { token }),
  createFarm: (token, farm) => request("/farms", { method: "POST", body: farm, token }),
  farmEnv: (token, id) => request(`/farms/${id}/env`, { token }),

  reports: (token) => request("/reports", { token }),
  createReport: (token, { farm_id, symptoms, affected_count, deaths, notes, photo }) => {
    if (photo) {
      const fd = new FormData();
      fd.append("farm_id", farm_id);
      fd.append("symptoms", JSON.stringify(symptoms));
      fd.append("affected_count", String(affected_count));
      if (deaths != null && deaths !== "") fd.append("deaths", String(deaths));
      if (notes) fd.append("notes", notes);
      fd.append("photo", photo);
      return request("/reports", { method: "POST", formData: fd, token });
    }
    return request("/reports", {
      method: "POST",
      body: {
        farm_id,
        symptoms,
        affected_count,
        deaths: deaths != null && deaths !== "" ? Number(deaths) : undefined,
        notes,
      },
      token,
    });
  },

  clusters: (token) => request("/clusters", { token }),
  dashboard: (token) => request("/dashboard", { token }),
  clusterAction: (token, id, action) => request(`/clusters/${id}/${action}`, { method: "POST", token }),
  escalateCluster: (token, id, payload) => request(`/clusters/${id}/escalate`, { method: "POST", body: payload, token }),
  escalations: (token) => request("/escalations", { token }),
  escalationStatus: (token, id, payload) => request(`/escalations/${id}/status`, { method: "POST", body: payload, token }),

  // Admin: audit-logged, gated access to identified CRITICAL-case farms.
  criticalAccess: (token, cluster_id, reason) =>
    request("/admin/critical-access", { method: "POST", body: { cluster_id, reason }, token }),

  samples: (token) => request("/samples", { token }),
  createSample: (token, payload) => request("/samples", { method: "POST", body: payload, token }),
  recordSampleResult: (token, id, payload) =>
    request(`/samples/${id}/result`, { method: "POST", body: payload, token }),

  inbox: (token) => request("/inbox", { token }),
  audit: (token) => request("/audit", { token }),
  impact: (token) => request("/impact", { token }),

  sensing: (token) => request("/sensing", { token }),
  sensingById: (token, id) => request(`/sensing/${id}`, { token }),

  health: (token, { farm_id } = {}) =>
    request(farm_id ? `/health?farm_id=${encodeURIComponent(farm_id)}` : "/health", { token }),
  createHealth: (token, record) => request("/health", { method: "POST", body: record, token }),

  drives: (token) => request("/drives", { token }),
  createDrive: (token, drive) => request("/drives", { method: "POST", body: drive, token }),
  updateDriveStatus: (token, id, status) =>
    request(`/drives/${id}/status`, { method: "PATCH", body: { status }, token }),
};

export function reqError(e) {
  return e?.message || "Something went wrong";
}
