# DB設計 実践ドリル — 初学者から「単独で設計できる」レベルへ

対象: フロントエンド（Next.js）出身で、DB設計はほぼ初学者。SQLは少し書けるが、ゼロからのテーブル設計は未経験。
ゴール: 要件を渡されたら、自分でER図とスキーマを設計し、自分でレビューして「これで本番に出せる」と判断できる状態。
進め方: **手を動かす**ことを最優先。各ドリルは「自分で設計 → 模範解答と突き合わせ → 差分から学ぶ」のループで進める。

---

## 0. 環境準備（最初の30分）

未定とのことなので、Next.js と相性が良く、初学者がつまずきにくい構成を推奨します。

推奨スタック: **PostgreSQL + Prisma**

理由を簡単に。PostgreSQL は無料・高機能で、Next.js界隈（Supabase / Neon / Vercel Postgres）の事実上の標準。Prisma はスキーマをコードで宣言でき、`schema.prisma` を書くこと自体が設計の練習になる。型もTypeScriptで効くのでフロント出身者には入りやすい。

最短セットアップ（ローカル不要のクラウドDB）:

1. [Neon](https://neon.tech) か [Supabase](https://supabase.com) で無料DBを作成（5分）。接続URLをコピー。
2. 練習用のNext.jsプロジェクトに Prisma を入れる。

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

3. `.env` の `DATABASE_URL` に接続URLを貼る。
4. `schema.prisma` を編集 → `npx prisma migrate dev --name init` で実際のテーブルが作られる。
5. `npx prisma studio` でブラウザからデータを見られる（フロントのDevTools感覚で使える）。

補助ツール: ER図を描くなら [dbdiagram.io](https://dbdiagram.io)（テキストでER図が描ける）。GUIでデータを触るなら [TablePlus](https://tableplus.com) か [DBeaver](https://dbeaver.io)。

> ポイント: 「設計 → migrate → studioで確認」を1ループ回すと、設計が現実のテーブルになる感覚がつかめる。各ドリルで実際にmigrateまでやると定着が段違いです。

---

## 1. 最小限の土台（ここだけ先に読む）

設計に必要な概念は意外と少ない。まずこれだけ押さえる。

### エンティティ・属性・リレーション
- **エンティティ** = 管理したい「モノ・コト」。だいたいテーブル1つになる（ユーザー、投稿、注文など）。
- **属性** = エンティティが持つ情報。テーブルの列になる（名前、作成日時など）。
- **リレーション** = エンティティ同士の関係（ユーザーは投稿を複数持つ、など）。

### キー
- **主キー（PK）**: 行を一意に識別する列。原則すべてのテーブルに付ける。迷ったら `id`（自動採番 or UUID）。
- **外部キー（FK）**: 別テーブルのPKを指す列。リレーションはこれで表現する。

### リレーションの3種類（これが設計の核心）
- **1対多（最頻出）**: 「多」側に「1」側のFKを置く。例: `Post.userId` → `User.id`。1人のユーザーが複数の投稿を持つ。
- **1対1**: どちらかにFKを置き、その列に UNIQUE 制約をかける。例: ユーザーとプロフィール詳細を分けたいとき。
- **多対多**: **中間テーブル**を作る。例: 投稿とタグ → `PostTag(postId, tagId)`。これを直接1テーブルで表そうとすると破綻する。多対多が出たら中間テーブル、と反射で出るようにする。

### 正規化（重複をなくす考え方）
ざっくり「同じ情報を2か所に書かない」。
- **第1正規形**: 1つのセルに複数の値を詰めない（カンマ区切りの `tags: "a,b,c"` はNG → 別テーブルへ）。
- **第2正規形**: 主キーの一部にしか依存しない列を分離する（複合キーのとき問題になる）。
- **第3正規形**: 「他の列から決まる列」を分離する。例: `Order` に `userName` を持たせると、ユーザー名変更時に整合性が崩れる → `userId` だけ持ち、名前は `User` を見る。

実務では**第3正規形まで満たす**のを基本に、パフォーマンス上必要なときだけ意図的に崩す（非正規化）。

### 制約（データの正しさをDBで守る）
- `NOT NULL`: 必須項目。
- `UNIQUE`: 重複禁止（メールアドレスなど）。
- `CHECK`: 値の範囲（`price >= 0` など）。
- 外部キー制約: 存在しないユーザーIDの投稿を防ぐ。

> 重要な発想: バリデーションはアプリ（フロント/API）だけでなく**DB側にも置く**。アプリのバグやバッチ処理から最後にデータを守るのはDB制約。フロント出身だと「validationはZodで」と考えがちだが、DB制約はその下の安全網。

### インデックス（速さの基礎）
- よく**検索条件・JOIN・並び替え**に使う列にインデックスを張ると速くなる。
- FK列、`email` のような検索キー、`createdAt` での並び替えなどが候補。
- ただし張りすぎると書き込みが遅く・容量増。「検索する列に張る」が基本。
- 設計初期は完璧を狙わず、「明らかに検索する列」だけ張っておけば十分。

### データ型の選び方（最初の指針）
- 文字列: 短い→ `varchar`、長文→ `text`。Postgresでは `text` で困ることは少ない。
- 数値: 整数→ `int`/`bigint`、**お金→ `decimal`（floatは誤差が出るので絶対に使わない）**。
- 真偽→ `boolean`、日時→ `timestamptz`（タイムゾーン付きを基本に）。
- 状態（下書き/公開など）→ `enum` で固定値を表現。

---

## 2. 設計の進め方（毎回これに沿ってやる手順テンプレ）

ドリルでも実務でも、この7ステップを毎回なぞる。慣れると無意識でできるようになる。

1. **名詞を拾う**: 要件文から名詞を抜き出す → エンティティ候補。（「ユーザーが商品を注文する」→ ユーザー・商品・注文）
2. **動詞・関係を拾う**: 「〜が〜を持つ/参照する」→ リレーション候補。種類（1対多/多対多）も判定。
3. **属性を割り当てる**: 各エンティティに列を並べる。型・必須かどうかもこの段階でメモ。
4. **正規化チェック**: 重複している情報・カンマ区切り・他列から決まる列がないか点検。
5. **キーと制約**: PK、FK、UNIQUE / NOT NULL / CHECK を付ける。
6. **ER図 or スキーマに落とす**: dbdiagram.io か `schema.prisma` で形にする。
7. **セルフレビュー**: §4のチェックリストで自分の設計を叩く。

---

## 3. 実践ドリル（難易度順・全6題）

各ドリルの使い方:
1. まず**模範解答を見ずに**自分で設計する（紙・dbdiagram.io・schema.prismaのどれでも）。
2. §2の手順をなぞる。15〜30分を目安に。
3. その後に模範解答と解説を読み、**差分**を確認する。差分こそが学び。
4. 余裕があれば実際に `migrate` して `prisma studio` でデータを入れてみる。

> 模範解答は「唯一の正解」ではなく「一例」。要件次第で別解もある。なぜそう設計したかの**理由**を読むことを重視してください。

---

### ドリル1 — TODOアプリ（1対多の基礎）★☆☆☆☆

**要件**
- ユーザーは登録できる（メール、名前）。
- ユーザーは複数のタスクを持つ。
- タスクはタイトル、完了フラグ、期限（任意）、作成日時を持つ。

**着目ポイント**: 1対多の表現（FKをどちらに置く？）、必須/任意の区別、作成日時の自動化。

<details>
<summary>模範解答（自分で設計してから開く）</summary>

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  tasks     Task[]
  createdAt DateTime @default(now())
}

model Task {
  id        String    @id @default(cuid())
  title     String
  done      Boolean   @default(false)
  dueDate   DateTime?            // 任意なので「?」（NULL許容）
  user      User      @relation(fields: [userId], references: [id])
  userId    String               // FKは「多」側のTaskに置く
  createdAt DateTime  @default(now())

  @@index([userId])              // FK列に検索用インデックス
}
```

**解説**
- 1対多は「多」側（Task）にFK（`userId`）を置くのが鉄則。User側に `taskIds` を配列で持たせたくなるが、それはやらない（正規化違反・検索しづらい）。
- `dueDate` は任意なので `DateTime?`（NULL許容）。`title` は必須なので `?` なし。「この項目は空でいいか？」を1列ずつ自問する癖をつける。
- `email` に `@unique`。同じメールで二重登録を防ぐのはDBの仕事。
- `createdAt @default(now())` でDBが自動で時刻を入れる。アプリ側で入れない。
- `userId` にインデックス。「このユーザーのタスク一覧」を頻繁に引くため。

</details>

---

### ドリル2 — ブログ（多対多とコメント）★★☆☆☆

**要件**
- ユーザーは記事を複数書く。
- 記事は複数のタグを持ち、1つのタグは複数の記事に付く。
- 記事にはコメントが付く。コメントもユーザーが書く。
- 記事は「下書き / 公開」の状態を持つ。

**着目ポイント**: 多対多（タグ）の中間テーブル、状態のenum、複数のリレーションが1テーブルから伸びるケース。

<details>
<summary>模範解答</summary>

```prisma
enum PostStatus {
  DRAFT
  PUBLISHED
}

model User {
  id       String    @id @default(cuid())
  email    String    @unique
  name     String
  posts    Post[]
  comments Comment[]
}

model Post {
  id        String     @id @default(cuid())
  title     String
  body      String     @db.Text
  status    PostStatus @default(DRAFT)
  author    User       @relation(fields: [authorId], references: [id])
  authorId  String
  tags      PostTag[]
  comments  Comment[]
  createdAt DateTime   @default(now())
  publishedAt DateTime?            // 公開時のみ入る

  @@index([authorId])
  @@index([status, publishedAt])   // 「公開記事を新着順に」用
}

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique
  posts PostTag[]
}

// 多対多の中間テーブル
model PostTag {
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  String

  @@id([postId, tagId])            // 複合主キー（同じ組合せは1回だけ）
}

model Comment {
  id        String   @id @default(cuid())
  body      String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())

  @@index([postId])
}
```

**解説**
- タグは多対多 → 中間テーブル `PostTag`。`@@id([postId, tagId])` の複合主キーで「同じ記事に同じタグを二重に付ける」を防ぐ。これが多対多の定石。
- `status` は `enum`。文字列で `"draft"` などを直接持つと打ち間違いが入る。取りうる値が固定なら enum。
- 記事削除時、`PostTag` と `Comment` は一緒に消えてほしい → `onDelete: Cascade`。ただしCascadeは「消えてよいもの」だけに使う（後述のアンチパターン参照）。
- `Comment` と `Post` の両方が `User` を参照している。1つのテーブルから複数のリレーションが伸びるのは普通のこと。
- `@@index([status, publishedAt])` は複合インデックス。「公開済みを新着順」という頻出クエリを速くする。

</details>

---

### ドリル3 — ECサイトの注文（スナップショット問題）★★★☆☆

**要件**
- 商品（名前、価格、在庫数）を扱う。
- ユーザーは注文する。1回の注文に複数の商品が含まれ、各商品に数量がある。
- 注文には合計金額と状態（未払い/支払い済み/発送済み/キャンセル）がある。
- **後から商品の価格が変わっても、過去の注文金額は当時のままであるべき。**

**着目ポイント**: ここが初学者の一番の山。「注文時点の価格を保存する」設計ができるか。多対多に見えて中間テーブルが**情報を持つ**ケース。

<details>
<summary>模範解答</summary>

```prisma
enum OrderStatus {
  PENDING
  PAID
  SHIPPED
  CANCELLED
}

model Product {
  id        String      @id @default(cuid())
  name      String
  price     Decimal     @db.Decimal(10, 2)   // お金はDecimal。floatは禁止
  stock     Int         @default(0)
  orderItems OrderItem[]
  createdAt DateTime    @default(now())
}

model Order {
  id          String      @id @default(cuid())
  user        User        @relation(fields: [userId], references: [id])
  userId      String
  status      OrderStatus @default(PENDING)
  totalAmount Decimal     @db.Decimal(10, 2)  // 確定した合計を保存
  items       OrderItem[]
  createdAt   DateTime    @default(now())

  @@index([userId])
  @@index([status])
}

model OrderItem {
  id         String  @id @default(cuid())
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId    String
  product    Product @relation(fields: [productId], references: [id])
  productId  String
  quantity   Int
  unitPrice  Decimal @db.Decimal(10, 2)   // ★注文時点の価格をコピーして保存

  @@index([orderId])
}

model User {
  id     String  @id @default(cuid())
  email  String  @unique
  orders Order[]
}
```

**解説**
- **最重要ポイント: `OrderItem.unitPrice`**。注文した瞬間の `Product.price` を**コピーして保存**する。`Product` を参照して都度価格を引くと、後で値上げしたときに過去の注文金額が変わってしまう。「注文・請求・契約など、確定した事実は当時の値をスナップショットする」——これは実務で必ず出る重要原則。
- `Order.totalAmount` も同様に確定値を保存する。毎回 `OrderItem` を合計して算出する設計もあり得るが、確定済みの注文は値を持っておくほうが安全で速い。
- `Order` と `Product` の関係は多対多に見えるが、間に「数量」「単価」という**情報**があるので、ただの中間テーブルではなく `OrderItem` という独立したエンティティになる。「中間テーブルが属性を持ち始めたら、それは一人前のエンティティ」と覚える。
- お金は `Decimal(10,2)`。`Float` は 0.1+0.2≠0.3 の世界なので金額に使うと事故る。
- 在庫の引き当て（注文時に `stock` を減らす）は、複数人が同時に買うと競合する。ここは**トランザクション**で扱うテーマ（設計の次のステップ。今は「在庫更新はトランザクションが要る」と認識できればOK）。

</details>

---

### ドリル4 — SNS（自己参照とフォロー）★★★☆☆

**要件**
- ユーザーは他のユーザーをフォローできる（フォローは一方向。AがBをフォローしてもBはAをフォローしているとは限らない）。
- ユーザーは投稿に「いいね」できる。同じ投稿に二重いいねはできない。
- 投稿への返信（リプライ）ができる。返信も投稿の一種。

**着目ポイント**: 自己参照の多対多（ユーザー↔ユーザー）、二重いいね防止のUNIQUE、テーブル自身を参照するツリー構造。

<details>
<summary>模範解答</summary>

```prisma
model User {
  id         String   @id @default(cuid())
  handle     String   @unique
  posts      Post[]
  likes      Like[]
  // フォロー関係（自己参照の多対多を中間テーブルFollowで表現）
  following  Follow[] @relation("follower")  // 自分がフォローしている
  followers  Follow[] @relation("following") // 自分をフォローしている
}

model Follow {
  follower    User     @relation("follower", fields: [followerId], references: [id])
  followerId  String
  following   User     @relation("following", fields: [followingId], references: [id])
  followingId String
  createdAt   DateTime @default(now())

  @@id([followerId, followingId])   // 同じ相手を二重フォローできない
  @@index([followingId])
}

model Post {
  id        String   @id @default(cuid())
  body      String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  // 自己参照: 返信は親投稿を指す
  parent    Post?    @relation("replies", fields: [parentId], references: [id])
  parentId  String?
  replies   Post[]   @relation("replies")
  likes     Like[]
  createdAt DateTime @default(now())

  @@index([authorId])
  @@index([parentId])
}

model Like {
  user    User   @relation(fields: [userId], references: [id])
  userId  String
  post    Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId  String

  @@id([userId, postId])    // 同じ投稿に二重いいね禁止
}
```

**解説**
- フォローは「ユーザーとユーザーの多対多」だが、**同じテーブル同士**なので自己参照。中間テーブル `Follow` に `followerId`（する側）と `followingId`（される側）を持つ。方向があるので2つの列の意味を明確に分ける。
- Prismaでは自己参照の多対多は名前付きリレーション（`"follower"` / `"following"`）で両方向を区別する。ここはPrismaのAPI的に少し難しいので、まず「中間テーブルに2つのFKを置く」という**概念**を押さえればよい。
- 二重いいね・二重フォローの防止は、`@@id([..])`（複合主キー）か `@@unique([..])` で表現する。「同じ組合せは1回だけ」という制約をDBで保証する典型。
- 返信は `Post` が自分自身を参照（`parentId`）するツリー構造。`parentId` が NULL ならトップレベル投稿、入っていれば誰かへの返信。同じパターンで「カテゴリの親子」「組織の階層」も表現できる。

</details>

---

### ドリル5 — 予約システム（重複防止と状態遷移）★★★★☆

**要件**
- 店舗にスタッフがいる。スタッフは予約枠（開始時刻・終了時刻）を持つ。
- 顧客が予約枠を予約する。
- **同じスタッフの同じ時間帯に2件の予約は入れられない。**
- 予約は「仮予約 / 確定 / 来店済み / キャンセル」と状態が変わる。

**着目ポイント**: 時間の扱い、重複禁止をDBでどう守るか、状態遷移の表現。実務でよく相談される題材。

<details>
<summary>模範解答</summary>

```prisma
enum ReservationStatus {
  TENTATIVE   // 仮予約
  CONFIRMED   // 確定
  COMPLETED   // 来店済み
  CANCELLED   // キャンセル
}

model Staff {
  id           String        @id @default(cuid())
  name         String
  reservations Reservation[]
}

model Customer {
  id           String        @id @default(cuid())
  name         String
  phone        String
  reservations Reservation[]
}

model Reservation {
  id         String            @id @default(cuid())
  staff      Staff             @relation(fields: [staffId], references: [id])
  staffId    String
  customer   Customer          @relation(fields: [customerId], references: [id])
  customerId String
  startAt    DateTime
  endAt      DateTime
  status     ReservationStatus @default(TENTATIVE)
  createdAt  DateTime          @default(now())

  @@index([staffId, startAt])   // 「このスタッフの予定」を時間順で引く
  @@index([customerId])
}
```

**解説**
- 時刻は `startAt` / `endAt` の2列で「枠」を表す。`timestamptz`（タイムゾーン付き）が基本。
- **重複防止が肝**。「同じスタッフの時間帯が重なる予約を禁止」は、実は単純なUNIQUE制約では表現できない（範囲の重なり判定だから）。レベル別に整理すると:
  - **アプリ層**: 予約作成前に「その時間に既存予約がないか」をクエリで確認する。ただし同時アクセスだとすり抜ける。
  - **トランザクション + 排他ロック**: 確認と挿入を1トランザクションにし、対象行をロックする。
  - **DBの機能で守る**: PostgreSQLの **Exclusion制約 + `tstzrange`**（範囲型）を使うと「範囲の重なり」をDBレベルで完全に禁止できる。これが最も堅い。Prismaのスキーマでは直接書けないので、生SQLのmigrationで `EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, end_at) WITH &&)` を足す。
  - 学習段階では「単純UNIQUEでは無理 → トランザクションかExclusion制約が要る」と認識できれば合格点。
- 状態は `enum`。さらに「仮予約→確定→来店済み」のように**許される遷移**が決まっている。遷移ルールは基本アプリ層のロジックで守る（DBは現在の状態を保持するだけ）。状態の履歴を残したいなら別途 `ReservationStatusLog` テーブルを作る設計もある。

</details>

---

### ドリル6 — 権限管理（ロールとパーミッション）★★★★☆

**要件**
- ユーザーには役割（ロール）がある: 管理者・編集者・閲覧者など。将来ロールは増える。
- 各ロールは複数の権限（パーミッション）を持つ: 記事作成・記事削除・ユーザー管理など。
- 1人のユーザーが複数のロールを持つこともある。
- 「このユーザーは記事を削除できるか？」を判定したい。

**着目ポイント**: 多対多が2段（ユーザー↔ロール、ロール↔パーミッション）。「enumで持つ vs テーブルで持つ」の判断。拡張性の設計。

<details>
<summary>模範解答</summary>

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  userRoles UserRole[]
}

model Role {
  id              String           @id @default(cuid())
  name            String           @unique   // "admin", "editor" ...
  userRoles       UserRole[]
  rolePermissions RolePermission[]
}

model Permission {
  id              String           @id @default(cuid())
  key             String           @unique   // "post:create", "post:delete" ...
  rolePermissions RolePermission[]
}

// ユーザー ↔ ロール（多対多）
model UserRole {
  user   User   @relation(fields: [userId], references: [id])
  userId String
  role   Role   @relation(fields: [roleId], references: [id])
  roleId String

  @@id([userId, roleId])
}

// ロール ↔ パーミッション（多対多）
model RolePermission {
  role         Role       @relation(fields: [roleId], references: [id])
  roleId       String
  permission   Permission @relation(fields: [permissionId], references: [id])
  permissionId String

  @@id([roleId, permissionId])
}
```

**解説**
- 多対多が2段重なる構造（RBAC = ロールベースアクセス制御の基本形）。`User —< UserRole >— Role —< RolePermission >— Permission`。中間テーブルが2つ出てくる。
- 「このユーザーは記事を削除できるか？」は、ユーザー→ロール→パーミッションをJOINで辿り、`post:delete` があるか調べる。
- **設計判断: ロールをenumにするか、テーブルにするか。** 要件に「将来ロールは増える」とある → **テーブル**が正解。enumは値の追加にmigrationが要るうえ、ロールごとの権限を柔軟に組み替えられない。「値が固定 → enum、運用中に増減・管理画面から編集したい → テーブル」が判断軸。
- パーミッションを `"post:create"` のような文字列キーで持つと、コード側で文字列定数と突き合わせやすい。
- これはやや高度な題材。完璧に組めなくても、「多対多が連鎖する」「固定値か可変かでenum/テーブルを選ぶ」という**判断の型**が身につけば十分です。

</details>

---

## 4. 設計レビュー観点チェックリスト（毎回これで自分の設計を叩く）

設計したら、提出・実装前にこのリストでセルフレビューする。単独で設計できる = 自分でこのレビューができる、ということ。

**構造**
- [ ] すべてのテーブルに主キーがあるか。
- [ ] リレーションのFKは「多」側に置かれているか。
- [ ] 多対多は中間テーブルになっているか。中間テーブルが属性を持つなら独立エンティティとして妥当か。
- [ ] カンマ区切りやJSONに「本来テーブルにすべき構造データ」を詰め込んでいないか。

**正規化と重複**
- [ ] 同じ情報を2か所に持っていないか（名前・価格などのコピー）。
- [ ] ただし「注文時の価格」など**当時の事実を固定すべき箇所**は、あえてコピーしているか（スナップショット）。
- [ ] 他の列から計算で出せる列を不用意に持っていないか（持つなら理由があるか）。

**制約とデータ品質**
- [ ] 各列の NULL 可否を1つずつ意識して決めたか。
- [ ] 一意であるべき列（メール等）に UNIQUE があるか。
- [ ] 「同じ組合せは1回だけ」を複合主キー / UNIQUE で守っているか。
- [ ] お金は Decimal か（Float になっていないか）。
- [ ] 取りうる値が固定の列は enum か。将来増えるなら別テーブルか。
- [ ] 日時はタイムゾーン付き型か。

**パフォーマンス**
- [ ] FK列・検索条件・並び替えに使う列にインデックスがあるか。
- [ ] インデックスを張りすぎていないか。

**削除の挙動**
- [ ] 親を消したとき子をどうするか決めたか（Cascadeで一緒に消す / 制限する / NULLにする）。
- [ ] 消えると困るデータ（注文・ログ）を安易にCascadeにしていないか。

**命名**
- [ ] テーブル名・列名の規則が一貫しているか（単数/複数、camelCase/snake_case）。
- [ ] FK列は `userId` のように「何を指すFKか」が名前で分かるか。

---

## 5. 初学者がよく踏むアンチパターン集

ここを知っておくと、レビューで自分のミスに気づける。

**1. カンマ区切りで多値を持つ** — `tags: "react,nextjs,db"`。検索・集計・整合性すべてが地獄。→ 別テーブル＋中間テーブルに。

**2. 価格や名前をコピーしっぱなし（非正規化の誤用）** — `Order` に `userName` を持ち、ユーザーが改名したら過去注文の名前も勝手に変えたい/変えたくないが曖昧。→ 原則はFKで参照。例外は「当時の事実を固定したいスナップショット」だけ、と意図を持って区別する。

**3. 全部を1つの巨大テーブルに詰める** — ユーザー情報・設定・住所・支払い情報を1テーブルに数十列。NULLだらけになる。→ 関心ごとに分割（1対1リレーション）。

**4. なんでもCascade削除** — ユーザー削除で注文履歴まで消える、など取り返しのつかない事故。→ 売上・ログ・監査対象は消さない。論理削除（`deletedAt` 列）も検討。

**5. enumの乱用 / 誤用** — 運用中に管理画面から増やしたい値をenumにしてしまい、毎回migrationが必要に。→ 「固定ならenum、運用で増減するならテーブル」。

**6. 主キーに意味を持たせる** — メールアドレスや「年度+連番」を主キーにして、後で変更できず詰む。→ 主キーは無意味な代理キー（id）にし、意味のある一意値はUNIQUE制約で別に守る。

**7. インデックスを一切張らない / 全列に張る** — どちらも極端。→ 検索・JOIN・並び替えに使う列に絞って張る。

**8. お金をFloatで持つ** — 計算誤差で1円ズレる。→ Decimal。

**9. タイムゾーンを無視** — ローカル時刻で保存して、ユーザーの地域で表示がずれる。→ `timestamptz` で保存、表示時に変換。

---

## 6. つまずいたときの問い直し（設計に詰まったら）

- 「このデータ、後から変わったとき過去の記録はどうあるべき？」→ スナップショットの要否が決まる。
- 「同じ組合せが2回登録されたら困る？」→ 複合UNIQUE / 複合主キーの要否。
- 「この値、運用が始まってから種類が増える？」→ enum か テーブルか。
- 「親が消えたとき、この子データは消えていい？」→ Cascade / Restrict / SetNull。
- 「この列、空っぽの行はあり得る？」→ NULL可否。
- 「この一覧、何で検索・並び替えする？」→ インデックス対象。

この6つの問いを設計中に自分に投げられるようになれば、単独設計レベルにかなり近づいています。

---

## 7. 次のステップ（ドリルを終えたら）

- **トランザクションと同時実行**: 在庫引き当て・予約重複など「同時アクセス」の世界。設計と並ぶ後半の山。
- **N+1問題**: リレーションをループで引くと大量クエリになる問題。Prismaの `include` / `select` で解決。フロント出身者がAPIを書くとよく踏む。
- **マイグレーション運用**: 本番データを壊さずスキーマを変える手順（列追加・リネーム・分割）。
- **論理削除・監査ログ・履歴テーブル**: 実務で必ず相談される設計パターン。

おすすめ書籍・資料: 『達人に学ぶDB設計徹底指南書』（ミック）、PostgreSQL公式ドキュメント、Prisma公式の Data Model ガイド。

---

## 使い方のおすすめ

ドリル1〜2を今週、3〜4を来週…と1題ずつ。**各題で必ず「先に自分で設計→模範解答と差分確認」**の順を守ってください。設計したスキーマを貼ってもらえれば、§4のチェックリストで私がレビューします。気軽にどうぞ。
