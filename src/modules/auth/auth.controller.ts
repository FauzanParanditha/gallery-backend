import { clearAuthCookies, cookieNames, setAuthCookies } from "@/libs/cookies";
import { Request, Response } from "express";
import { LoginDto } from "./auth.schema";
import { AuthService } from "./auth.service";

export const AuthController = {
  async login(req: Request, res: Response) {
    const { email, password } = LoginDto.parse(req.body);
    const ua = req.headers["user-agent"]?.toString();
    const ip = (
      req.headers["x-forwarded-for"] || req.socket.remoteAddress
    )?.toString();

    const { user, access, refresh } = await AuthService.login(
      { email, password },
      ua,
      ip
    );
    setAuthCookies(res, access, refresh);
    res.json({ user });
  },

  async refresh(req: Request, res: Response) {
    const refresh = req.cookies?.[cookieNames.REFRESH_COOKIE] as
      | string
      | undefined;
    const ua = req.headers["user-agent"]?.toString();
    const ip = (
      req.headers["x-forwarded-for"] || req.socket.remoteAddress
    )?.toString();

    const {
      user,
      access,
      refresh: newRefresh,
    } = await AuthService.refresh(refresh, ua, ip);
    setAuthCookies(res, access, newRefresh);
    res.json({ user });
  },

  async logout(req: Request, res: Response) {
    const refresh = req.cookies?.[cookieNames.REFRESH_COOKIE] as
      | string
      | undefined;
    await AuthService.logout(refresh);
    clearAuthCookies(res);
    res.status(204).send();
  },
};
