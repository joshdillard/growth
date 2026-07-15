/*
 * claude.js — Claude API client for the CEP panel.
 *
 * CEP panels are plain Chromium pages with no build step, so we call the
 * Messages API over raw HTTP (fetch) with the direct-browser-access header.
 * Structured outputs (output_config.format json_schema) guarantee every AI
 * feature returns valid, parseable JSON.
 */
const AUBClaude = {

  API_URL: "https://api.anthropic.com/v1/messages",

  async message({ system, user, schema, maxTokens }) {
    const settings = AUBStore.load();
    if (!settings.anthropicKey) {
      throw new Error("No Anthropic API key set. Add one in the Settings tab (console.anthropic.com).");
    }

    const body = {
      model: settings.model || "claude-opus-4-8",
      max_tokens: maxTokens || 16000,
      thinking: { type: "adaptive" },
      system: system,
      messages: [{ role: "user", content: user }],
    };
    if (schema) {
      body.output_config = { format: { type: "json_schema", schema } };
    }

    const res = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error.message; } catch (e) {}
      if (res.status === 401) throw new Error("Anthropic API key was rejected (401). Check it in Settings.");
      if (res.status === 429) throw new Error("Rate limited by the Anthropic API (429). Wait a moment and retry.");
      throw new Error("Anthropic API error " + res.status + (detail ? ": " + detail : ""));
    }

    const data = await res.json();

    if (data.stop_reason === "refusal") {
      throw new Error("The model declined this request" +
        (data.stop_details && data.stop_details.explanation ? ": " + data.stop_details.explanation : "."));
    }
    if (data.stop_reason === "max_tokens") {
      throw new Error("The response was cut off (max_tokens). Try a shorter transcript section.");
    }

    const textBlock = (data.content || []).find(b => b.type === "text");
    if (!textBlock) throw new Error("Empty response from the model.");

    return schema ? JSON.parse(textBlock.text) : textBlock.text;
  },

  channelContextBlock() {
    const ctx = AUBStore.get("channelContext");
    return ctx ? "\n\nChannel context provided by the creator (use it to match tone and audience):\n" + ctx : "";
  },

  // ------------------------------------------------------------------
  // 1) Shorts finder
  // ------------------------------------------------------------------
  async findShorts(transcript, opts) {
    const schema = {
      type: "object",
      properties: {
        shorts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "number", description: "Clip start in seconds, aligned to a natural sentence start" },
              end: { type: "number", description: "Clip end in seconds, aligned to a natural sentence end" },
              hook: { type: "string", description: "The opening line that grabs attention in the first 2 seconds" },
              title: { type: "string", description: "On-screen / caption title for the reel, under 60 chars" },
              caption: { type: "string", description: "Post caption for TikTok/Reels/Shorts" },
              hashtags: { type: "array", items: { type: "string" } },
              virality_score: { type: "integer", description: "1-100 estimate of viral potential" },
              reason: { type: "string", description: "Why this moment works as a short" }
            },
            required: ["start", "end", "hook", "title", "caption", "hashtags", "virality_score", "reason"],
            additionalProperties: false
          }
        }
      },
      required: ["shorts"],
      additionalProperties: false
    };

    const system =
      "You are a short-form video editor who has cut thousands of viral clips from long-form " +
      "podcasts and YouTube videos. You know what stops the scroll: a strong hook in the first " +
      "two seconds, a self-contained idea, emotional peaks, hot takes, surprising facts, " +
      "conflict, humor, and clean endings. You always cut on sentence boundaries so clips " +
      "never start or end mid-word." + this.channelContextBlock();

    const user =
      "Below is a timestamped transcript. Each line is `[start–end] text` in seconds.\n\n" +
      "Find the " + opts.count + " strongest moments to cut into vertical shorts (9:16 reels).\n" +
      "Rules:\n" +
      "- Each short must be between " + opts.minLen + " and " + opts.maxLen + " seconds long.\n" +
      "- start/end must align with segment boundaries from the transcript (never mid-sentence).\n" +
      "- Prefer moments with a hook, a payoff, and no missing context.\n" +
      "- Do not overlap clips.\n" +
      "- Score honestly: reserve 85+ for genuinely exceptional moments.\n\n" +
      "TRANSCRIPT:\n" + AUBTranscript.toModelText(transcript, 350000);

    const result = await this.message({ system, user, schema });
    return (result.shorts || []).sort((a, b) => b.virality_score - a.virality_score);
  },

  // ------------------------------------------------------------------
  // 2) Blunder / retake / stutter detection
  // ------------------------------------------------------------------
  async findBlunders(transcript) {
    const schema = {
      type: "object",
      properties: {
        cuts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "number" },
              end: { type: "number" },
              type: { type: "string", enum: ["retake", "stutter", "filler", "false_start", "meta"] },
              reason: { type: "string", description: "One sentence: what happens here and why it should go" },
              excerpt: { type: "string", description: "The exact words being removed" },
              confidence: { type: "number", description: "0-1" }
            },
            required: ["start", "end", "type", "reason", "excerpt", "confidence"],
            additionalProperties: false
          }
        }
      },
      required: ["cuts"],
      additionalProperties: false
    };

    const system =
      "You are a dialogue editor cleaning up raw recordings. You find the parts of a take that " +
      "a professional editor would remove:\n" +
      "- RETAKES: the speaker restarts a line ('let me start over', 'correct this', 'scratch that', " +
      "'wait, let me say that again') — remove the failed take AND the meta-comment, keep the good take.\n" +
      "- FALSE STARTS: abandoned sentences the speaker rephrases immediately after.\n" +
      "- STUTTERS: heavy repeated words or syllables ('I- I- I think... I think').\n" +
      "- FILLER RUNS: long chains of 'um, uh, like, you know' that carry no meaning (not every single 'um').\n" +
      "- META: talking to the editor/camera crew ('are we rolling?', 'cut that', 'edit this out').\n" +
      "You are conservative: never remove content that changes meaning, and when a line is retaken, " +
      "the LAST take is the keeper unless the speaker says otherwise.";

    const user =
      "Timestamped transcript below (`[start–end] text`, seconds). Identify every range that should be " +
      "cut out of the final edit, using the segment timestamps to set start/end. When a bad take spans " +
      "multiple segments, cover the whole thing with one cut. Report every candidate you find, even " +
      "low-confidence ones — include your confidence and the editor will filter.\n\n" +
      "TRANSCRIPT:\n" + AUBTranscript.toModelText(transcript, 350000);

    const result = await this.message({ system, user, schema });
    return (result.cuts || []).sort((a, b) => a.start - b.start);
  },

  // ------------------------------------------------------------------
  // 3) Episode kit: title, description, timestamps, thumbnail ideas
  // ------------------------------------------------------------------
  async episodeKit(transcript) {
    const schema = {
      type: "object",
      properties: {
        titles: {
          type: "array",
          items: { type: "string" },
          description: "5 YouTube title options, each under 70 characters, ranked best first"
        },
        description: {
          type: "string",
          description: "Full YouTube description: 2-3 sentence hook, what viewers will learn, then a natural keyword-rich summary. No timestamps here — those are separate."
        },
        timestamps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              seconds: { type: "number" },
              label: { type: "string", description: "Chapter title, 2-6 words" }
            },
            required: ["seconds", "label"],
            additionalProperties: false
          },
          description: "YouTube chapters. First one must be at 0. One chapter per real topic shift."
        },
        thumbnail_ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              concept: { type: "string", description: "The visual concept in one sentence" },
              text_overlay: { type: "string", description: "1-4 word thumbnail text" },
              why_it_works: { type: "string" }
            },
            required: ["concept", "text_overlay", "why_it_works"],
            additionalProperties: false
          },
          description: "3 distinct thumbnail concepts"
        },
        tags: { type: "array", items: { type: "string" }, description: "10-15 YouTube tags" }
      },
      required: ["titles", "description", "timestamps", "thumbnail_ideas", "tags"],
      additionalProperties: false
    };

    const system =
      "You are a YouTube strategist who packages long-form podcast episodes. Your titles create " +
      "curiosity without lying, your descriptions are written for humans first and search second, " +
      "your chapters map real topic shifts, and your thumbnail concepts are simple enough to read " +
      "at 120px wide." + this.channelContextBlock();

    const hasTs = transcript.hasTimestamps;
    const user =
      "Package this episode for YouTube.\n" +
      (hasTs
        ? "The transcript is timestamped (`[start–end] text`, seconds); base chapter timestamps on real topic shifts in it.\n"
        : "The transcript has no timestamps, so estimate chapter times proportionally across the runtime.\n") +
      "\nTRANSCRIPT:\n" + AUBTranscript.toModelText(transcript, 350000);

    return this.message({ system, user, schema });
  },
};
