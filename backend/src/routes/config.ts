import { Router, Request, Response } from "express";
import { BATCHES } from "../config/batches";

const router = Router();

/**
 * GET /api/config/batches
 * Exposes batch options and their configuration status WITHOUT exposing sensitive
 * spreadsheet IDs or credential info.
 */
router.get("/config/batches", (_req: Request, res: Response) => {
  const result = BATCHES.map((b) => ({
    id: b.id,
    label: b.label,
    isConfigured: Boolean(
      b.spreadsheetId &&
        !b.spreadsheetId.startsWith("PLACEHOLDER") &&
        b.spreadsheetId.trim().length > 0
    ),
  }));
  res.json(result);
});

export default router;
