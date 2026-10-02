import { GoogleGenAI } from "@google/genai";

const timeout = Number(process.env.AI_TIMEOUT_MS || 30000);

function withTimeout(promise, ms = timeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Batas waktu AI terlampaui")), ms)),
  ]);
}

function normalizeMessages(system, history, prompt) {
  const messages = [
    { role: "system", content: system },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: prompt },
  ];
  return messages;
}

async function maxRouter(messages) {
  const base = (process.env.MAX_ROUTER_BASE_URL || "").replace(/\\/$/, "");
  if (!base) throw new Error("MAX_ROUTER_BASE_URL belum diatur");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.MAX_ROUTER_API_KEY ? { authorization: `Bearer ${process.env.MAX_ROUTER_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: process.env.MAX_ROUTER_MODEL || undefined,
      messages,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Max Router ${response.status}: ${data?.error?.message || data?.error || "gagal"}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Max Router tidak mengembalikan teks");
  return text;
}

async function gemini(system, history, prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diatur");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents = [
    { role: "user", parts: [{ text: system }] },
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];
  const result = await withTimeout(ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    contents,
  }));
  if (!result.text) throw new Error("Gemini tidak mengembalikan teks");
  return result.text;
}

async function openai(messages) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY belum diatur");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${data?.error?.message || "gagal"}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI tidak mengembalikan teks");
  return text;
}

async function anthropic(system, history, prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diatur");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
      max_tokens: 1200,
      system,
      messages: [
        ...history.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${data?.error?.message || "gagal"}`);
  const text = data?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Anthropic tidak mengembalikan teks");
  return text;
}

export function createAiRouter() {
  return {
    status() {
      return [
        process.env.MAX_ROUTER_BASE_URL ? "Max Router" : null,
        process.env.GEMINI_API_KEY ? "Gemini" : null,
        process.env.OPENAI_API_KEY ? "OpenAI" : null,
        process.env.ANTHROPIC_API_KEY ? "Anthropic" : null,
      ].filter(Boolean).join(" → ") || "belum ada jalur AI";
    },

    async chat({ system, history, prompt }) {
      const messages = normalizeMessages(system, history, prompt);
      const attempts = [
        ["max-router", () => maxRouter(messages)],
        ["gemini", () => gemini(system, history, prompt)],
        ["openai", () => openai(messages)],
        ["anthropic", () => anthropic(system, history, prompt)],
      ];

      const errors = [];
      for (const [provider, run] of attempts) {
        try {
          if (provider === "max-router" && !process.env.MAX_ROUTER_BASE_URL) continue;
          if (provider === "gemini" && !process.env.GEMINI_API_KEY) continue;
          if (provider === "openai" && !process.env.OPENAI_API_KEY) continue;
          if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) continue;
          const text = await run();
          return { text, provider };
        } catch (error) {
          errors.push(`${provider}: ${error.message}`);
          console.warn(`[Kuro] ${provider} gagal, pindah ke jalur berikutnya:`, error.message);
        }
      }
      throw new Error(errors.join(" | ") || "Tidak ada jalur AI yang tersedia");
    },
  };
}
