import { NextRequest, NextResponse } from "next/server";
import { getReel, saveReel, deleteReel } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const reel = await getReel((await params).id);
  if (!reel) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(reel);
}

// PATCH: manual edits from the editor (title, script, captions, broll swaps, etc.)
export async function PATCH(req: NextRequest, { params }: Params) {
  const reel = await getReel((await params).id);
  if (!reel) return NextResponse.json({ error: "not found" }, { status: 404 });
  const updates = await req.json();
  const merged = { ...reel, ...updates, id: reel.id, createdAt: reel.createdAt };
  return NextResponse.json(await saveReel(merged));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await deleteReel((await params).id);
  return NextResponse.json({ ok: true });
}
