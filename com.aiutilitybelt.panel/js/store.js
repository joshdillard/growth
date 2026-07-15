/*
 * store.js — panel settings, persisted in localStorage (CEP persists this
 * per-extension on the user's machine; keys never leave the machine except
 * as auth headers on API calls the user configures).
 */
const AUBStore = {
  KEY: "aub.settings.v1",

  defaults: {
    anthropicKey: "",
    openaiKey: "",           // optional, only for Whisper auto-transcription
    model: "claude-opus-4-8",
    pauseThreshold: 1.0,     // seconds of silence between segments => cut
    pausePadding: 0.15,      // seconds kept on each side of a pause cut
    shortMin: 20,            // seconds
    shortMax: 59,
    shortCount: 5,
    channelContext: "",      // optional: what the channel is about, tone, audience
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return Object.assign({}, this.defaults, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, this.defaults);
    }
  },

  save(settings) {
    localStorage.setItem(this.KEY, JSON.stringify(settings));
  },

  get(key) { return this.load()[key]; },

  set(key, value) {
    const s = this.load();
    s[key] = value;
    this.save(s);
  },
};
