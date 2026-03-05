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
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath && existsSync(resolve(keyPath))) {
    const raw = readFileSync(resolve(keyPath), "utf-8");
    const credentials = JSON.parse(raw);
    cachedAuth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    cachedAuth = new google.auth.GoogleAuth({ scopes });
  }
  return cachedAuth;
}

export function getGscSiteUrl(): string {
  return process.env.GSC_SITE_URL || "sc-domain:42advisory.com.au";
}

export function getGa4PropertyId(): string {
  return process.env.GA4_PROPERTY_ID || "properties/492927034";
}
