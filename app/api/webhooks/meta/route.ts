// Meta webhook: when someone comments the CTA keyword on a published reel,
// auto-reply with a private message containing the Google Doc link.
// Configure in Meta App Dashboard -> Webhooks -> instagram (comments field)
// and page (feed field). Requires instagram_manage_comments + pages_messaging.
import { NextRequest, NextResponse } from "next/server";
import { listReels } from "@/lib/store";

// Webhook verification handshake
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(url.searchParams.get("hub.challenge"));
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  try {
    await handleEvents(payload);
  } catch (e) {
    console.error("webhook handling error:", e);
  }
  // Always 200 fast so Meta doesn't retry-storm.
  return NextResponse.json({ ok: true });
}

async function handleEvents(payload: {
  entry?: { changes?: { field: string; value: Record<string, unknown> }[] }[];
}) {
  const reels = await listReels();
  const published = reels.filter((r) => r.status === "published" && r.cta.docUrl);

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "feed") continue;
      const v = change.value as {
        text?: string;
        message?: string;
        id?: string;
        comment_id?: string;
        media?: { id?: string };
      };
      const text = (v.text || v.message || "").toUpperCase();
      const commentId = v.id || v.comment_id;
      if (!text || !commentId) continue;

      // Match the comment against any live CTA keyword.
      const reel = published.find((r) => text.includes(r.cta.keyword.toUpperCase()));
      if (!reel) continue;

      await sendPrivateReply(commentId, reel.cta.docUrl!, reel.cta.keyword);
    }
  }
}

async function sendPrivateReply(commentId: string, docUrl: string, keyword: string) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return;

  const message =
    `Hey! Thanks for commenting ${keyword} 🙌 Here's the full breakdown: ${docUrl}\n\n` +
    `Want it set up for you? There's a link inside to book a 1:1 with me.`;

  // Private reply to the comment (works for both IG and FB page comments).
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${commentId}/private_replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message, access_token: token }).toString(),
    }
  );
  if (!res.ok) console.error("private reply failed:", await res.text());
}
