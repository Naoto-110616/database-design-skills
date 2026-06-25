import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 は driver adapter 必須。
// ローカルdev / Vercel(Node) は常駐プロセスなので、TCP接続の node-postgres(PrismaPg) を使う。
// （WebSocketベースの @prisma/adapter-neon は edge 用。Next.js のバンドルで ws が壊れる問題を避ける）
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL が設定されていません（.env を確認）");
}

// 開発中のホットリロードで PrismaClient が量産されるのを防ぐシングルトン。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
