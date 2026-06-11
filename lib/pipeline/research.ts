// Daily topic discovery. Two sources, merged:
//  1. Claude with web search — finds what's trending TODAY in AI / creator tools /
//     entrepreneur workflows across news sites and social chatter.
//  2. RSS feeds of AI/creator publications as a zero-cost fallback.

import { askClaudeJSON } from "../anthropic";
import { TopicIdea } from "../types";

const RSS_FEEDS = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  "https://venturebeat.com/category/ai/feed/",
  "https://www.bensbites.com/feed",
];

export async function discoverTopics(count: number): Promise<TopicIdea[]> {
  const [searched, fromFeeds] = await Promise.allSettled([
    searchTrendingTopics(count),
    topicsFromFeeds(),
  ]);

  const ideas: TopicIdea[] = [];
  if (searched.status === "fulfilled") ideas.push(...searched.value);
  if (fromFeeds.status === "fulfilled") ideas.push(...fromFeeds.value);

  // Dedupe by title similarity, keep hottest first.
  const seen = new Set<string>();
  return ideas
    .sort((a, b) => b.trendScore - a.trendScore)
    .filter((i) => {
      const key = i.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);
}

async function searchTrendingTopics(count: number): Promise<TopicIdea[]> {
  return askClaudeJSON<TopicIdea[]>(
    `Search the web for what is trending RIGHT NOW (today: ${new Date().toDateString()}) in:
- AI tools and model releases (Anthropic, OpenAI, Google, open source)
- AI filmmaking / video generation (Runway, Kling, Veo, Sora, HeyGen, etc.)
- Creator-economy workflows and tools
- AI workflows for entrepreneurs and solopreneurs

Find ${count + 3} topics that would make killer 30-60 second vertical reels for an
AI-for-creators audience. Prioritize: news from the last 48 hours, contrarian takes,
"nobody is talking about this" angles, and practical how-tos.

Return a JSON array of objects: { "title": string, "angle": string (the specific hook/
take for the reel), "source": string (URL), "trendScore": number 1-10 }`,
    { webSearch: true, maxTokens: 3000 }
  );
}

async function topicsFromFeeds(): Promise<TopicIdea[]> {
  const items: { title: string; link: string }[] = [];
  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed, { signal: AbortSignal.timeout(10_000) });
      const xml = await res.text();
      // Lightweight RSS parse: good enough for title+link extraction.
      const entries = xml.match(/<item>[\s\S]*?<\/item>|<entry>[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries.slice(0, 5)) {
        const title = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
        const link =
          entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ||
          entry.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
        if (title && link) items.push({ title, link });
      }
    })
  );

  return items.map((i) => ({
    title: i.title,
    angle: "",
    source: i.link,
    trendScore: 5,
  }));
}
