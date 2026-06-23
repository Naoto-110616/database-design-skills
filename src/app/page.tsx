import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 動作確認用にデモユーザーを1人用意する（なければ作る）。
async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "Demo" },
  });
}

// Server Action: タスク追加。フォームのsubmitから直接DBに書き込む。
async function addTask(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const user = await getDemoUser();
  await prisma.task.create({ data: { title, userId: user.id } });
  revalidatePath("/");
}

// Server Action: 完了/未完了の切り替え。
async function toggleTask(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const done = formData.get("done") === "true";
  await prisma.task.update({ where: { id }, data: { done: !done } });
  revalidatePath("/");
}

export default async function Home() {
  const user = await getDemoUser();
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <h1>タスク一覧（DB練習）</h1>
      <p style={{ color: "#666" }}>
        Neon の PostgreSQL に保存されます。リロードしても消えなければ接続成功です。
      </p>

      <form action={addTask} style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          name="title"
          placeholder="新しいタスクを入力"
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button type="submit" style={{ padding: "8px 16px", borderRadius: 6 }}>
          追加
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.length === 0 && (
          <li style={{ color: "#999" }}>まだタスクがありません。上のフォームから追加してください。</li>
        )}
        {tasks.map((t) => (
          <li
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}
          >
            <form action={toggleTask}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="done" value={String(t.done)} />
              <button type="submit" style={{ width: 28 }}>
                {t.done ? "✓" : "○"}
              </button>
            </form>
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
