import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAuth: any = null;

export function getGoogleAuth(): any {
  if (cachedAuth) return cachedAuth;
  const scopes = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ];

  // Option 1: Service account JSON passed directly as env var (for Railway / cloud)
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const credentials = JSON.parse(saJson);
      cachedAuth = new google.auth.GoogleAuth({ credentials, scopes });
      console.log("Google auth: using GOOGLE_SERVICE_ACCOUNT_JSON env var");
      return cachedAuth;
    } catch (e: any) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  // Option 2: Service account JSON file path
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath && existsSync(resolve(keyPath))) {
    const raw = readFileSync(resolve(keyPath), "utf-8");
    const credentials = JSON.parse(raw);
    cachedAuth = new google.auth.GoogleAuth({ credentials, scopes });
    console.log("Google auth: using service account key file");
    return cachedAuth;
  }

  // Option 3: OAuth2 refresh token (for users without service account keys)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    cachedAuth = oauth2;
    console.log("Google auth: using OAuth2 refresh token");
    return cachedAuth;
  }

  // Option 4: Application Default Credentials (local dev)
  cachedAuth = new google.auth.GoogleAuth({ scopes });
  console.log("Google auth: using Application Default Credentials");
  return cachedAuth;
}

export function getGscSiteUrl(): string {
  return process.env.GSC_SITE_URL || "sc-domain:42advisory.com.au";
}

export function getGa4PropertyId(): string {
  return process.env.GA4_PROPERTY_ID || "properties/492927034";
}
