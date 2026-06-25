import { prisma } from "@/lib/prisma";
import { TaskList } from "./task-list";

// 動作確認用にデモユーザーを1人用意する（なければ作る）。ここで1回だけ実行。
async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: { email: "demo@example.com", name: "Demo" },
  });
}

export default async function Home() {
  const user = await getDemoUser();
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, done: true },
  });

  return (
    <main>
      <h1>タスク一覧（DB練習）</h1>
      <p style={{ color: "#666" }}>
        Neon の PostgreSQL に保存されます。楽観的更新でクリック直後にUIへ反映されます。
      </p>
      <TaskList userId={user.id} initialTasks={tasks} />
    </main>
  );
}
