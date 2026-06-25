"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// userId はページ側で1回だけ取得して渡す。
// → アクション毎のデモユーザー upsert（往復1回）を省略でき、クエリ数を削減。
export async function addTask(userId: string, title: string) {
  const t = title.trim();
  if (!t) return;
  await prisma.task.create({ data: { title: t, userId } });
  revalidatePath("/");
}

export async function toggleTask(id: string, done: boolean) {
  await prisma.task.update({ where: { id }, data: { done: !done } });
  revalidatePath("/");
}
