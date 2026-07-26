import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";

dotenv.config();

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
