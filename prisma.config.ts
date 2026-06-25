import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 では CLI（migrate / studio など）の設定はここに集約する。
// migrate は datasource.url を直接接続として使うので DIRECT_URL を渡す。
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"), // 直接接続（-pooler なし）
  },
});
