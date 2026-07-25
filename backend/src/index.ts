// IMPORTANT: dotenv must be loaded via require() BEFORE any other imports.
// TypeScript `import` statements are hoisted and resolved before any inline
// code runs, so `import dotenv … dotenv.config()` is always too late —
// supabaseClient.ts (imported transitively through registerRoutes) would read
// process.env before .env has been applied.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";


const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

registerRoutes(app);

// Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error Handler] ${req.method} ${req.path}:`, err);
  const isUpstream =
    err?.config?.url?.includes("googleapis.com") ||
    err?.domain === "global" ||
    (err?.message &&
      (err.message.includes("Google") ||
        err.message.includes("Sheets") ||
        err.message.includes("Gaxios") ||
        err.message.includes("invalid_grant") ||
        err.message.includes("JWT")));

  if (isUpstream) {
    return res.status(502).json({
      error: `Upstream Google Sheets API failure: ${err.message || "Failed to fetch data from Sheets API"}`,
    });
  }
  return res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
