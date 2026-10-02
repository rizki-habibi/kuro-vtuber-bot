import "dotenv/config";
import http from "node:http";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { createAiRouter } from "./ai/router.js";
import { createMemoryStore } from "./memory.js";
import { createProjectTools } from "./tools/project.js";

const required = ["DISCORD_TOKEN"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Variabel lingkungan ${key} belum diisi.`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const ai = createAiRouter();
const memory = createMemoryStore();
const project = createProjectTools();

const healthPort = Number(process.env.HEALTH_PORT || 8080);
http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: true,
      service: "kuro-vtuber-bot",
      discord: client.isReady(),
      ai: ai.status(),
      uptime: process.uptime(),
      time: new Date().toISOString()
    }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(healthPort);

client.once("ready", () => {
  console.log(`[Kuro] online sebagai ${client.user.tag}`);
  console.log("[Kuro] jalur AI:", ai.status());
});

function shouldReply(message) {
  if (message.author.bot) return false;
  if (!message.guild) return true;
  return message.mentions.has(client.user) || message.content.startsWith("!kuro");
}

function cleanPrompt(content) {
  return content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .replace(/^!kuro\s*/i, "")
    .trim();
}

async function buildContext(message) {
  const history = await message.channel.messages.fetch({
    limit: Number(process.env.HISTORY_MESSAGES || 12),
  });
  return [...history.values()]
    .reverse()
    .filter((item) => !item.author.bot || item.author.id === client.user.id)
    .map((item) => ({
      role: item.author.id === client.user.id ? "assistant" : "user",
      content: item.content,
      author: item.author.username,
    }))
    .slice(-Number(process.env.HISTORY_MESSAGES || 12));
}

client.on("messageCreate", async (message) => {
  if (!shouldReply(message)) return;

  const prompt = cleanPrompt(message.content);
  if (!prompt) {
    await message.reply("Aku siap. Tanyakan apa saja tentang project, kode, ide, atau hal lain yang bisa kubantu.");
    return;
  }

  if (/^!kuro\s+(status|ai)$/i.test(message.content)) {
    await message.reply(`Status AI: ${ai.status()}\\nServer: aktif\\nUptime: ${Math.floor(process.uptime())} detik`);
    return;
  }

  if (/^!kuro\\s+(project|repo|proyek)/i.test(message.content)) {
    await message.channel.sendTyping();
    try {
      const info = await project.summary();
      await message.reply(info.slice(0, Number(process.env.MAX_REPLY_CHARS || 1800)));
    } catch (error) {
      await message.reply(`Aku gagal membaca data project sekarang: ${error.message}`);
    }
    return;
  }

  if (/^!kuro\\s+(minat|peminat|interest)/i.test(message.content)) {
    await message.channel.sendTyping();
    try {
      const report = await project.interestReport();
      await message.reply(report.slice(0, Number(process.env.MAX_REPLY_CHARS || 1800)));
    } catch (error) {
      await message.reply(`Data minat project belum bisa dibaca: ${error.message}`);
    }
    return;
  }

  await message.channel.sendTyping();
  try {
    const history = await buildContext(message);
    const userKey = `${message.guildId || "dm"}:${message.author.id}`;
    const memories = await memory.recent(userKey);

    const system = [
      `Kamu adalah ${process.env.KURO_NAME || "Kuro"}, agen AI yang membantu pemilik project.`,
      `Gunakan ${process.env.KURO_LANGUAGE || "Bahasa Indonesia"} kecuali pengguna meminta bahasa lain.`,
      `Kepribadian: ${process.env.KURO_PERSONALITY || "ramah, cerdas, santai, membantu"}.`,
      "Jangan mengaku memiliki perasaan atau pengalaman manusia.",
      "Jangan mengarang data project. Jika perlu data nyata, gunakan fitur project yang tersedia.",
      "Kamu boleh membantu menjelaskan kode, merancang fitur, membaca ide, menyusun balasan, dan menganalisis project.",
      memories.length ? `Konteks percakapan tersimpan: ${JSON.stringify(memories)}` : "",
    ].filter(Boolean).join("\n");

    const response = await ai.chat({
      system,
      history,
      prompt,
    });

    await memory.add(userKey, { role: "user", content: prompt });
    await memory.add(userKey, { role: "assistant", content: response.text });

    const suffix = response.provider !== "max-router"
      ? `\n\n_[Jalur AI: ${response.provider}]_`
      : "";

    await message.reply((response.text + suffix).slice(0, Number(process.env.MAX_REPLY_CHARS || 1800)));
  } catch (error) {
    console.error("[Kuro] gagal menjawab:", error);
    await message.reply("Aku sedang gagal mengakses semua jalur AI. Coba lagi sebentar.");
  }
});

client.on("error", (error) => console.error("[Kuro] Discord:", error));
process.on("unhandledRejection", (error) => console.error("[Kuro] unhandled:", error));

await client.login(process.env.DISCORD_TOKEN);
