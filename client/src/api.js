const BASE = import.meta.env.VITE_API_BASE_URL || "";

export function getAdminToken() {
  return localStorage.getItem("ohk_admin_token") || "";
}

export function setAdminToken(token) {
  localStorage.setItem("ohk_admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("ohk_admin_token");
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    throw err;
  }

  return data;
}

export function apiGet(path, { admin = false } = {}) {
  const headers = {};
  if (admin) {
    headers["x-admin-token"] = getAdminToken();
  }
  return request(path, { headers });
}

export function apiPost(path, body, { admin = false } = {}) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (admin) {
    headers["x-admin-token"] = getAdminToken();
  }

  return request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}