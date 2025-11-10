// src/modules/auth/auth.service.ts
import { Unauthorized } from "@/libs/errors";
import { signAccessToken, signRefreshToken } from "@/libs/jwt";
import { prisma } from "@/libs/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { LoginInput } from "./auth.schema";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export const AuthService = {
  async login(input: LoginInput, userAgent?: string, ip?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) throw Unauthorized("Email atau password salah");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw Unauthorized("Email atau password salah");

    const payload = { id: user.id, role: "admin" as const };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    const refreshHash = sha256(refresh);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        userAgent,
        ipAddress: ip,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 hari
      },
    });
    return {
      user: { id: user.id, email: user.email },
      access,
      refresh,
    };
  },

  async refresh(oldRefreshToken?: string, userAgent?: string, ip?: string) {
    if (!oldRefreshToken) throw Unauthorized("No refresh token");
    const oldHash = sha256(oldRefreshToken);

    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: oldHash },
    });
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw Unauthorized("Invalid session");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) throw Unauthorized("User not found");

    const payload = { id: user.id, role: "admin" as const };
    const newAccess = signAccessToken(payload);
    const newRefresh = signRefreshToken(payload);
    const newHash = sha256(newRefresh);

    await prisma.$transaction([
      prisma.session.update({
        where: { refreshTokenHash: oldHash },
        data: { isRevoked: true },
      }),
      prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: newHash,
          userAgent,
          ipAddress: ip,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      }),
    ]);

    return {
      user: { id: user.id, email: user.email },
      access: newAccess,
      refresh: newRefresh,
    };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const hash = sha256(refreshToken);
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash, isRevoked: false },
      data: { isRevoked: true },
    });
  },
};
