import type { NextFunction, Request, Response } from "express";
import { HealthService } from "./health.service";

export const HealthController = {
  async status(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await HealthService.status();
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  async storage(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await HealthService.storage();
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
