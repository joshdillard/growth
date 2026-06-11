# ⚡ Dillard AI Short Content Engine

A personal short-form content machine: every day it researches what's hot in **AI, creator tools, and entrepreneur workflows**, writes 30–60s reel scripts in Josh's voice, generates a talking **HeyGen clone** video + **AI B-roll**, composites everything into a professional vertical reel, and publishes to **Instagram, Facebook, YouTube Shorts, and TikTok** — with a comment-keyword → Google Doc → 1:1 consulting funnel baked into every post.

## The reel format

```
┌──────────────────┐
│                  │  TOP HALF: AI B-roll (Runway / fal.ai) —
│     B-ROLL       │  matched per script segment (logos, scenes, concepts)
│                  │
├──────────────────┤
│  ANIMATED WORDS  │  CENTER BAND: animated captions (word-pop style)
├──────────────────┤
│                  │  BOTTOM HALF: your HeyGen clone speaking the script
│      CLONE       │
│                  │  ENDING: zoom transition → clone goes FULL SCREEN
└──────────────────┘  for the CTA: “comment [KEYWORD] for the breakdown”
```

Plus: animated viral hook title in the first 2 seconds, pulsing CTA keyword badge at the end, AI-generated branded thumbnail per reel.

## How it works

1. **Research** — Claude with web search scans AI news, creator-economy chatter, and RSS feeds (TechCrunch AI, The Verge AI, VentureBeat, Ben's Bites) for what's trending *today*.
2. **Script** — one structured Claude call produces: hook title, script in your voice profile, timed segments each with a tailored B-roll generation prompt, CTA keyword + spoken line, post description, hashtags, and a thumbnail prompt.
3. **Assets** — in parallel: HeyGen renders your clone speaking the script; Runway/fal.ai generate each B-roll shot; fal.ai Flux generates the branded thumbnail; a Google Doc is created with the free deep-dive content + your 1:1 booking link, and indexed in the master doc.
4. **QC** — the web editor shows a **live Remotion preview** (left), manual edit controls for everything (center), and pipeline status + publish controls (right). Or flip on **Autopilot** in Settings and skip QC entirely.
5. **Render** — Remotion composites the final 1080×1920 MP4 (same code as the preview, so what you see is exactly what renders).
6. **Publish** — Instagram Reels + Facebook Reels (Graph API), YouTube Shorts (with custom thumbnail), TikTok (Content Posting API).
7. **Funnel** — a Meta webhook watches comments; anyone who comments the keyword gets an automatic private reply with the Google Doc link → doc contains the 1:1 consulting pitch.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev                  # editor at http://localhost:3000
```

No keys yet? The editor and Remotion Studio (`npm run remotion:studio`) work with a built-in demo reel so you can tune the look first.

**Daily automation** (cron on any always-on box, or a GitHub Action):

```cron
0 6 * * * cd /path/to/engine && npm run daily
```

To hit "a reel every hour" later, just run it hourly with `dailyReelTarget: 1`.

## API keys & setup checklist

| Service | Used for | Notes |
|---|---|---|
| **Anthropic** | research, scripts, doc content | required first — everything flows from this |
| **HeyGen** | clone video | create your avatar + voice clone at app.heygen.com, then set `HEYGEN_AVATAR_ID` / `HEYGEN_VOICE_ID` |
| **Runway** | premium B-roll video | you have this |
| **fal.ai** | cheap B-roll video/images + thumbnails | ~10–50× cheaper than Runway per shot; sign up at fal.ai |
| **Google service account** | CTA docs + master doc | enable Drive + Docs APIs, share master doc with the service-account email |
| **Meta** | IG/FB publish + comment webhook | Business account, app with `instagram_content_publish`, `pages_manage_posts`, `instagram_manage_comments`, `pages_messaging` |
| **YouTube** | Shorts upload + thumbnail | OAuth with `youtube.upload` scope |
| **TikTok** | video publish | needs an approved app for the Content Posting API (takes a few days) |

## Cost notes (keeping this cheap)

- **Remotion** replaces a paid editor/renderer entirely — free for individuals, and it's why captions/transitions/titles are perfectly consistent.
- **fal.ai Flux (schnell)** images are fractions of a cent; use `ai-image` + Ken Burns motion for most B-roll and save **Runway** for 1–2 hero shots per reel.
- **HeyGen is the biggest line item.** Cheaper paths if volume grows: Hedra (cheaper per minute), or self-hosting an open-source lipsync stack (e.g. SadTalker / MuseTalk on a rented GPU) driven by an ElevenLabs voice clone — same `lib/pipeline/avatar.ts` interface, swap the implementation.
- Canva integration was considered; Flux + Remotion covers graphics/thumbnails without another subscription.

## Project layout

```
app/                  Next.js app (queue, editor, settings, API routes, Meta webhook)
components/           Editor panels (EditPanel, ActionsPanel)
lib/types.ts          Domain model (Reel, segments, B-roll, CTA, …)
lib/store.ts          JSON-file persistence (data/)
lib/anthropic.ts      Claude client (with web search)
lib/pipeline/         research → script → assets (avatar / broll / drive)
lib/publish.ts        Instagram, Facebook, YouTube, TikTok
remotion/             The reel composition (preview AND final render)
scripts/daily.ts      Cron entrypoint for full automation
```

## Status / roadmap

- [x] Research → script → assets → QC editor → render → publish pipeline
- [x] Comment-keyword → DM funnel (Meta webhook)
- [ ] Word-accurate caption timing from avatar audio (currently estimated; align with Whisper for frame-perfect karaoke)
- [ ] YouTube OAuth refresh-token flow (currently expects a fresh access token)
- [ ] Analytics loop: pull post performance back in to steer topic selection
