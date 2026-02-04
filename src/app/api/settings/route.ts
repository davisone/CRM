import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  for (const item of body) {
    if (!item.key || item.value === undefined) continue;
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: String(item.value) },
      create: { key: item.key, value: String(item.value), type: item.type || "string" },
    });
  }

  const updated = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(updated);
}
