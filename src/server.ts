import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

import express from "express";
import session from "express-session";
import overviewRoutes from "./routes/overview.js";
import keywordsRoutes from "./routes/keywords.js";
import competitorsRoutes from "./routes/competitors.js";
import aiVisibilityRoutes from "./routes/ai-visibility.js";
import auditRoutes from "./routes/audit.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Trust proxy (Cloud Run / nginx)
app.set("trust proxy", 1);

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "42-advisory-seo-dashboard-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Body parsers for login form
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Public routes (no auth required) ---

// Login page
app.get("/login", (_req, res) => {
  res.sendFile(resolve(__dirname, "..", "public", "login.html"));
});

// Login action
app.post("/login", (req, res) => {
  const password = process.env.DASHBOARD_PASSWORD || "42advisory";
  const submitted = req.body?.password;
  if (submitted && submitted === password) {
    (req.session as any).authenticated = true;
    res.redirect("/");
  } else {
    res.redirect("/login?error=1");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Health check (for Cloud Run)
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// --- Auth middleware (protects everything below) ---
app.use((req, res, next) => {
  // Skip auth if DASHBOARD_PASSWORD is not set (local dev convenience)
  if (!process.env.DASHBOARD_PASSWORD) {
    return next();
  }
  if ((req.session as any)?.authenticated) {
    return next();
  }
  res.redirect("/login");
});

// Serve static frontend (protected)
app.use(express.static(resolve(__dirname, "..", "public")));

// API routes (protected)
app.use("/api/overview", overviewRoutes);
app.use("/api/keywords", keywordsRoutes);
app.use("/api/competitors", competitorsRoutes);
app.use("/api/ai-visibility", aiVisibilityRoutes);
app.use("/api/audit", auditRoutes);

app.listen(PORT, () => {
  console.log(`42 Advisory SEO Dashboard running at http://localhost:${PORT}`);
  if (process.env.DASHBOARD_PASSWORD) {
    console.log("Password protection: ENABLED");
  } else {
    console.log("Password protection: DISABLED (set DASHBOARD_PASSWORD to enable)");
  }
});
