"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { addTask, toggleTask } from "./actions";

type Task = { id: string; title: string; done: boolean };

type OptimisticAction =
  | { type: "add"; task: Task }
  | { type: "toggle"; id: string };

export function TaskList({
  userId,
  initialTasks,
}: {
  userId: string;
  initialTasks: Task[];
}) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // サーバー応答を待たず、UIだけ先に更新するための楽観的ステート。
  // 裏で revalidate が完了すると initialTasks（実データ）に置き換わる。
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    initialTasks,
    (state, action: OptimisticAction) => {
      if (action.type === "add") return [action.task, ...state];
      return state.map((t) =>
        t.id === action.id ? { ...t, done: !t.done } : t,
      );
    },
  );

  // form の action はトランザクションとして実行されるので、その中で楽観更新できる。
  async function handleAdd(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    formRef.current?.reset();
    applyOptimistic({
      type: "add",
      task: { id: `temp-${Date.now()}`, title, done: false },
    });
    await addTask(userId, title);
  }

  function handleToggle(id: string, done: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "toggle", id });
      await toggleTask(id, done);
    });
  }

  return (
    <>
      <form
        ref={formRef}
        action={handleAdd}
        style={{ display: "flex", gap: 8, margin: "16px 0" }}
      >
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
        {optimisticTasks.length === 0 && (
          <li style={{ color: "#999" }}>
            まだタスクがありません。上のフォームから追加してください。
          </li>
        )}
        {optimisticTasks.map((t) => (
          <li
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}
          >
            <button
              type="button"
              onClick={() => handleToggle(t.id, t.done)}
              style={{ width: 28 }}
            >
              {t.done ? "✓" : "○"}
            </button>
            <span style={{ textDecoration: t.done ? "line-through" : "none" }}>
              {t.title}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
