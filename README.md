# DB設計 練習用 Next.js プロジェクト

DB設計ドリル（`../DB設計_実践ドリル.md`）を**実際に動かす**ための最小構成。
Next.js (App Router) + Prisma + PostgreSQL(Neon)。

## セットアップ（初回のみ）

```bash
# 1. このフォルダで依存をインストール
npm install

# 2. Neon の接続URLを設定
cp .env.example .env
#   → .env を開き、DATABASE_URL に Neon のダッシュボードからコピーした接続文字列を貼る

# 3. スキーマをDBに反映（テーブルが作られる）
npm run db:migrate
#   → 初回はマイグレーション名を聞かれるので "init" などと入力

# 4. 起動
npm run dev
#   → http://localhost:3000 を開く。タスクを追加してリロードし、消えなければ接続成功。
```

## DB設計の練習ループ（これを繰り返す）

1. `prisma/schema.prisma` を編集する（ドリルの模範解答を写したり、自分の設計を書いたり）。
2. `npm run db:migrate` で実際のテーブルに反映。
3. `npm run db:studio` でブラウザからデータを見る／入れる（`http://localhost:5555`）。
4. うまくいかなければスキーマを直して再度 migrate。

> Prisma Studio は、フロントでいう React DevTools のような「DBの中身を目で見るツール」。設計したテーブルが意図通りか確認するのに便利。

## ファイルの役割

- `prisma/schema.prisma` — **設計の本体**。ここを書き換えるのが練習。今はドリル1のTODOスキーマが入っている。
- `src/lib/prisma.ts` — Prismaクライアントの共有インスタンス（定番パターン）。
- `src/app/page.tsx` — DBの読み書きを試す動作確認ページ（Server Actionでタスク追加・完了切替）。
- `.env` — 接続情報。**Gitにコミットしない**（.gitignore済み）。

## 次のドリルに進むとき

別ドリル（ブログ・EC など）を試すときは、`schema.prisma` をそのドリルの模範解答に書き換えて
`npm run db:migrate` するだけ。テーブル構成が大きく変わって migrate が詰まったら、
`npx prisma migrate reset`（DBを初期化）で作り直せる。練習用DBなので気軽にリセットしてOK。

## トラブル時

- `Environment variable not found: DATABASE_URL` → `.env` 未作成。手順2を確認。
- 接続できない → Neonの接続文字列の末尾に `?sslmode=require` が付いているか確認。
- `@prisma/client did not initialize yet` → `npm run db:generate` を実行。
