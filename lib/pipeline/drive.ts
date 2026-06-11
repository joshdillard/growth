// Google Docs/Drive funnel:
//  - One CTA doc per reel: the free deep-dive on the topic + links to book a 1:1.
//  - A master doc indexing every day's reels, keywords, and doc links.
// Auth: a Google service account (GOOGLE_SERVICE_ACCOUNT_JSON env var, the full
// JSON key). Docs are created in a shared folder so Josh's account can see them.

import { askClaude } from "../anthropic";
import { Reel } from "../types";

const SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents";

async function googleToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const sa = JSON.parse(raw);

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = await signRS256(`${header}.${claims}`, sa.private_key);
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

async function signRS256(input: string, pem: string): Promise<string> {
  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(input);
  return sign.sign(pem).toString("base64url");
}

export async function createCtaDoc(reel: Reel): Promise<string> {
  const bookingLink = process.env.BOOKING_LINK || "[ADD YOUR 1:1 BOOKING LINK]";

  const content = await askClaude(
    `Write the content for a free value document that viewers of this reel receive when
they comment "${reel.cta.keyword}".

Reel topic: ${reel.topic.title}
Reel script: ${reel.script}

The doc should: deliver REAL value (tools, steps, links, exact workflows mentioned in
the reel), be skimmable with headers and bullets, and end with a soft pitch: "Want this
set up for you? Book a 1:1 AI consulting call with Josh: ${bookingLink}".
Plain text with markdown-style headers.`,
    { maxTokens: 2500 }
  );

  const token = await googleToken();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Create the doc
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ title: reel.cta.docTitle }),
  });
  if (!createRes.ok) throw new Error(`Doc create failed: ${await createRes.text()}`);
  const doc = await createRes.json();

  // Insert content
  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: content } }],
    }),
  });

  // Make link-shareable (anyone with the link can view)
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${doc.documentId}/permissions`,
    {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  const url = `https://docs.google.com/document/d/${doc.documentId}/view`;
  await appendToMasterDoc(token, reel, url);
  return url;
}

// The master doc indexes every reel: date, title, keyword, doc link.
async function appendToMasterDoc(token: string, reel: Reel, docUrl: string) {
  const masterId = process.env.GOOGLE_MASTER_DOC_ID;
  if (!masterId) return; // optional — set it once you create the master doc

  const line = `\n${new Date().toLocaleDateString()} | ${reel.topic.title} | keyword: ${reel.cta.keyword} | ${docUrl}`;
  await fetch(`https://docs.googleapis.com/v1/documents/${masterId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { insertText: { endOfSegmentLocation: { segmentId: "" }, text: line } },
      ],
    }),
  });
}
