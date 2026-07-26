import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import configRouter from "../config";

describe("Config Endpoints", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", configRouter);
  });

  it("GET /api/config/batches returns list of batches without spreadsheetId", async () => {
    const res = await request(app).get("/api/config/batches");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const firstBatch = res.body[0];
    expect(firstBatch).toHaveProperty("id");
    expect(firstBatch).toHaveProperty("label");
    expect(firstBatch).toHaveProperty("isConfigured");
    expect(firstBatch).not.toHaveProperty("spreadsheetId");
    expect(firstBatch.id).toBe("2023-2027");
    expect(firstBatch.isConfigured).toBe(true);

    const placeholderBatch = res.body.find((b: any) => b.id === "2024-2028");
    if (placeholderBatch) {
      expect(placeholderBatch.isConfigured).toBe(false);
    }
  });
});
