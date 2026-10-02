const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleUnauthorized(res: Response, path: string, method: string): Promise<void> {
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }
  if (!res.ok) {
    const detail = await res
      .clone()
      .json()
      .then((body) => body?.detail)
      .catch(() => undefined);
    throw new Error(detail || `${method} ${path} failed: ${res.status}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  await handleUnauthorized(res, path, "GET");
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  await handleUnauthorized(res, path, "POST");
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  await handleUnauthorized(res, path, "PUT");
  return res.json();
}

export async function apiPatch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "PATCH", headers: authHeaders() });
  await handleUnauthorized(res, path, "PATCH");
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: authHeaders() });
  await handleUnauthorized(res, path, "DELETE");
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  localStorage.setItem("access_token", data.access_token);
  return data.access_token;
}
