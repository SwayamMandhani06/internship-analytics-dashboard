import { Express } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import analyticsRouter from "./analytics";
import configRouter from "./config";

export function registerRoutes(app: Express): void {
  app.use("/api", healthRouter);
  app.use("/api", studentsRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", configRouter);
}
