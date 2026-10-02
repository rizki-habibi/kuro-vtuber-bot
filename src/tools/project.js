const api = "https://api.github.com";

async function github(path) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
  const response = await fetch(`${api}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub ${response.status}`);
  return data;
}

export function createProjectTools() {
  const owner = process.env.GITHUB_REPO_OWNER || "rizki-habibi";
  const repo = process.env.GITHUB_REPO_NAME || "kuro-vtuber-bot";

  return {
    async summary() {
      const data = await github(`/repos/${owner}/${repo}`);
      return [
        `Project: ${data.full_name}`,
        `Deskripsi: ${data.description || "belum ada deskripsi"}`,
        `Bahasa utama: ${data.language || "belum terdeteksi"}`,
        `Bintang: ${data.stargazers_count}`,
        `Fork: ${data.forks_count}`,
        `Pengamat: ${data.subscribers_count ?? "tidak tersedia"}`,
        `Isu terbuka: ${data.open_issues_count}`,
        `Terakhir diperbarui: ${data.pushed_at}`,
        `URL: ${data.html_url}`,
      ].join("\n");
    },

    async interestReport() {
      const data = await github(`/repos/${owner}/${repo}`);
      const topics = await github(`/repos/${owner}/${repo}/topics`);
      const events = await github(`/repos/${owner}/${repo}/events?per_page=20`);
      const activity = Array.isArray(events) ? events.length : 0;
      return [
        "Laporan minat project berdasarkan data publik GitHub:",
        `• Bintang: ${data.stargazers_count}`,
        `• Fork: ${data.forks_count}`,
        `• Pengamat: ${data.subscribers_count ?? "tidak tersedia"}`,
        `• Topik: ${topics.names?.join(", ") || "belum ada"}`,
        `• Aktivitas publik terbaru yang terbaca: ${activity} event`,
        "",
        "Kuro tidak mengirim pesan massal atau menghubungi orang secara otomatis. Data ini dipakai untuk menemukan sinyal ketertarikan dan membantu menyusun strategi tindak lanjut.",
      ].join("\n");
    },
  };
}
