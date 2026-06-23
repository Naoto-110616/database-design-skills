import { PrismaClient } from "@prisma/client";

// 開発中のホットリロードで PrismaClient が量産されるのを防ぐシングルトン。
// Next.js + Prisma の定番パターン。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
