# Kuro VTuber Bot

Kuro adalah agen AI Discord yang dirancang untuk berjalan terus-menerus di Railway.

## Jalur AI

Kuro mencoba jalur secara berurutan:

1. Max Router
2. Gemini API resmi
3. OpenAI API resmi
4. Anthropic API resmi

Jika Max Router mendapat 401/403/429/5xx, timeout, atau tidak mengembalikan teks, Kuro otomatis mencoba jalur berikutnya. Jadi bot tidak bergantung pada satu penyedia.

SDK Gemini menggunakan paket resmi Google `@google/genai`. Untuk OpenAI dan Anthropic, Kuro memanggil API resmi langsung dari server sehingga kunci tidak pernah dikirim ke Discord.

## Kemampuan

- Percakapan alami di Discord.
- Konteks pesan terbaru di kanal.
- Memori sesi sederhana.
- Menjawab pertanyaan project.
- Membaca statistik project GitHub publik.
- Menganalisis sinyal minat project dari bintang, fork, pengamat, topik, dan aktivitas publik.
- Pemeriksaan status jalur AI.
- Endpoint `/health` untuk Railway.
- Tidak melakukan DM massal atau spam calon pengguna.

### Contoh

- Mention bot: `@Kuro jelaskan project ini`
- `!kuro status`
- `!kuro project`
- `!kuro minat`

## Deploy 24/7 ke Railway

1. Hubungkan repository ini ke Railway.
2. Pilih layanan sebagai worker/web service berbasis Docker.
3. Isi variabel dari `.env.example`.
4. Wajib isi `DISCORD_TOKEN`.
5. Isi `MAX_ROUTER_BASE_URL` dan `MAX_ROUTER_API_KEY` jika ingin Max Router menjadi jalur pertama.
6. Isi minimal satu AI cadangan: `GEMINI_API_KEY`, `OPENAI_API_KEY`, atau `ANTHROPIC_API_KEY`.
7. Deploy.

Railway menjalankan ulang proses ketika proses berhenti sesuai kebijakan restart. Endpoint health tersedia di `/health`.

## Catatan penting

"Kecerdasan asli" di sini berarti Kuro benar-benar memanggil model AI eksternal, mempertahankan konteks percakapan, dan dapat menggunakan data project nyata. Ia bukan bot berbasis kumpulan jawaban teks statis.

Memori saat ini berada di RAM proses. Untuk memori lintas restart, tahap berikutnya sebaiknya memakai Supabase/PostgreSQL agar konteks tidak hilang saat Railway melakukan redeploy/restart.

## Keamanan

- Jangan commit `.env`.
- Simpan semua token sebagai Railway Variables.
- Jangan memberikan akses GitHub tulis jika Kuro hanya perlu membaca project.
- Jangan gunakan Kuro untuk spam, DM massal, atau manipulasi pengguna.
