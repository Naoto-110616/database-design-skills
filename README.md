# DB設計 練習用 Next.js プロジェクト

DB設計ドリル（`./DB設計_実践ドリル.md`）を**実際に動かす**ための構成。
Next.js (App Router) + **Prisma 7** + PostgreSQL(Neon)。**本番想定で接続を2本立て**にしている。

## 接続は2本立て（本番想定）

Vercel等のサーバーレス本番と同じ構成。

- `DATABASE_URL` … **プール接続**（ホストに `-pooler`）。アプリが `@prisma/adapter-pg`（node-postgres / TCP）経由で使用。サーバーレスでの接続爆発を防ぐ。
- `DIRECT_URL` … **直接接続**（`-pooler` なし）。`prisma.config.ts` 経由で `prisma migrate` が使用。マイグレーションはセッション機能・アドバイザリロックを使うため、プール接続（トランザクションモード）では動かない。

Prisma 7では、アプリのクエリは driver adapter（`DATABASE_URL`）、CLIのmigrateは `prisma.config.ts` の `DIRECT_URL` を使う。

## Prisma 7 の構成メモ

このプロジェクトは Prisma 7（Rust不要の新クライアント）に対応済み。v6から変わった点：

- `generator` は `prisma-client`（旧 `prisma-client-js`）で、生成先 `output = "../src/generated/prisma"` を指定。クライアントは `node_modules` ではなく `src/generated/prisma` に生成される（`.gitignore` 済み）。
- 接続は **driver adapter 必須**。`src/lib/prisma.ts` で `@prisma/adapter-pg`（node-postgres / TCP）を使用。ローカルdevやVercelのNodeランタイムはこれが安定。（Cloudflare等の edge ランタイムに載せる場合のみ `@prisma/adapter-neon`(WebSocket)に差し替える）
- CLI設定は `prisma.config.ts` に集約（`DIRECT_URL` を指定）。
- `migrate` は自動で `generate` しなくなったため、`npm run db:migrate` は migrate 後に generate も実行する。`npm install` 後は `postinstall` で自動 generate。

## セットアップ（初回のみ）

```bash
# 1. このフォルダで依存をインストール（postinstall で prisma generate も走る）
npm install

# 2. Neon の接続URLを設定（2本）
cp .env.example .env
#   → .env を開き、DATABASE_URL（pooled）と DIRECT_URL（direct）の両方を貼る
#   → Neon ダッシュボードで Connection pooling のオン/オフを切り替えると両方の文字列が手に入る

# 3. スキーマをDBに反映（テーブルが作られる）
npm run db:migrate
#   → 初回はマイグレーション名を聞かれるので "init" などと入力
#   → 内部では DIRECT_URL が使われる

# 4. 起動
npm run dev
#   → http://localhost:3000 を開く。タスクを追加してリロードし、消えなければ接続成功。
#   → アプリのクエリは DATABASE_URL(pooled) 経由
```

## DB設計の練習ループ（これを繰り返す）

1. `prisma/schema.prisma` を編集する（ドリルの模範解答を写したり、自分の設計を書いたり）。
2. `npm run db:migrate` で実際のテーブルに反映。
3. `npm run db:studio` でブラウザからデータを見る／入れる（`http://localhost:5555`）。
4. うまくいかなければスキーマを直して再度 migrate。

> Prisma Studio は、フロントでいう React DevTools のような「DBの中身を目で見るツール」。設計したテーブルが意図通りか確認するのに便利。

## ファイルの役割

- `prisma/schema.prisma` — **設計の本体**。ここを書き換えるのが練習。今はドリル1のTODOスキーマが入っている。
- `prisma.config.ts` — Prisma CLI（migrate等）の設定。migrate用の DIRECT_URL をここで指定。
- `src/lib/prisma.ts` — Prismaクライアントの共有インスタンス（Neon driver adapter方式）。
- `src/generated/prisma/` — `prisma generate` の生成物（自動生成・コミット不要）。
- `src/app/page.tsx` — DBの読み書きを試す動作確認ページ（Server Actionでタスク追加・完了切替）。
- `.env` — 接続情報（DATABASE_URL と DIRECT_URL の2本）。**Gitにコミットしない**（.gitignore済み）。

## 次のドリルに進むとき

別ドリル（ブログ・EC など）を試すときは、`schema.prisma` をそのドリルの模範解答に書き換えて
`npm run db:migrate` するだけ。テーブル構成が大きく変わって migrate が詰まったら、
`npx prisma migrate reset`（DBを初期化）で作り直せる。練習用DBなので気軽にリセットしてOK。

## トラブル時

- `Environment variable not found: DATABASE_URL` / `DIRECT_URL` → `.env` に2本とも書いたか確認。
- 接続できない → 各接続文字列の末尾に `?sslmode=require` が付いているか確認。
- `migrate` が固まる/失敗する → `DIRECT_URL` が直接接続（`-pooler` なし）になっているか確認。プール接続だと migrate は動かない。
- `Cannot find module '@/generated/prisma/client'` → まだ generate していない。`npm run db:generate` を実行。
- `P1010` / SSL 関連エラー → Prisma 7 は node-postgres 経由でSSL検証が厳格化。基本は `sslmode=require` でOK。どうしても出る場合は `src/lib/prisma.ts` の `PrismaPg` に `ssl: { rejectUnauthorized: false }` を足す。
- `bufferUtil.mask is not a function` → WebSocket(ws)由来。本プロジェクトは TCP の `@prisma/adapter-pg` に切替済みなので発生しないはず。出る場合は `@prisma/adapter-neon` を import していないか確認。
- Neon が `P1001 Can't reach database` → 無料プランは無操作5分でスリープ。一度アクセスすれば起きる。`?connect_timeout=10` を付けると安定。
