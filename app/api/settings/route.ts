import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: NextRequest) {
  const current = await getSettings();
  const updated = { ...current, ...(await req.json()) };
  await saveSettings(updated);
  return NextResponse.json(updated);
}
