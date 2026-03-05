const BASE = "https://api.dataforseo.com/v3";

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN || "";
  const password = process.env.DATAFORSEO_PASSWORD || "";
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

export async function dfsPost<T = any>(path: string, body: unknown[]): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (data.status_code !== 20000) {
    throw new Error(data.status_message || "DataForSEO request failed");
  }
  return data.tasks?.[0]?.result as T;
}

export async function dfsGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  const data = await res.json() as any;
  if (data.status_code !== 20000) {
    throw new Error(data.status_message || "DataForSEO request failed");
  }
  return data.tasks?.[0]?.result as T;
}
