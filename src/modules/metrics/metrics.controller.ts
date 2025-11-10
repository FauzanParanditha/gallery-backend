import { getUserDailyPresign } from "@/libs/metrics";
import { z } from "@/libs/z";
import type { Request, Response } from "express";

export const MetricsController = {
  async presignUserToday(req: Request, res: Response) {
    const q = z
      .object({
        userId: z.string().optional(),
        ip: z.string().optional(),
      })
      .parse(req.query);

    const key = q.userId || q.ip;
    if (!key)
      return res
        .status(400)
        .json({ error: "BadRequest", message: "userId atau ip wajib" });

    const result = await getUserDailyPresign(key);
    res.json({ data: result });
  },
};
