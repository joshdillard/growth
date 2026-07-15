/*
 * whisper.js — optional auto-transcription via the OpenAI Whisper API.
 *
 * This is the one non-Anthropic call in the panel: Claude models don't take
 * raw audio, so speech-to-text needs a dedicated service. If you'd rather not
 * use it, Premiere's built-in Speech-to-Text (Text panel -> export SRT) works
 * great and is free — this exists purely as a one-click convenience.
 */
const AUBWhisper = {

  MAX_BYTES: 25 * 1024 * 1024, // Whisper API upload limit

  async transcribeFile(file) {
    const key = AUBStore.get("openaiKey");
    if (!key) {
      throw new Error("No OpenAI key set (needed only for auto-transcription). " +
        "Either add one in Settings, or use Premiere's Speech-to-Text and import the SRT.");
    }
    if (file.size > this.MAX_BYTES) {
      throw new Error("File is " + (file.size / 1048576).toFixed(0) + " MB — the Whisper API caps uploads at 25 MB. " +
        "Export a compressed audio-only file (e.g. 64 kbps MP3), or use Premiere's Speech-to-Text + SRT import.");
    }

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: form,
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error.message; } catch (e) {}
      throw new Error("Whisper API error " + res.status + (detail ? ": " + detail : ""));
    }

    const data = await res.json();
    return AUBTranscript.build(AUBTranscript.parseWhisperJSON(data));
  },
};
