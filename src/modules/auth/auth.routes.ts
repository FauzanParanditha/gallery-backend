import { authGuard } from "@/middlewares/authGuard";
import { authLimiter } from "@/middlewares/rateLimiter";
import { Router } from "express";
import { AuthController } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authLimiter, AuthController.login);
authRouter.post("/refresh", AuthController.refresh);
authRouter.post("/logout", AuthController.logout);

authRouter.get("/me", authGuard, (req, res) => {
  res.json({ user: req.user });
});
