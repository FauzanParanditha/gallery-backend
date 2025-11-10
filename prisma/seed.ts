import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { email, passwordHash, role: "admin" },
    });
    console.log(`Seeded admin: ${email} / ${password}`);
  } else {
    console.log("Admin already exists, skipping");
  }
}

main().finally(() => prisma.$disconnect());
