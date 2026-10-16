# PRD dan versioning produk

`manifest.json` adalah satu-satunya penunjuk revisi aktif. Semua PDF disimpan di `versions/<id>/source.pdf`. **Label versi yang tercetak di PDF bukan identitas unik**: dua PDF saat ini sama-sama menyebut v1.1. Identitas repo memakai `id` unik, status, sumber, dan rantai `supersedes`.

PRD aktif adalah `sa7tein-mvp-2026-10-11` (marketplace Yordania, JOD, Regular/Quick, DANA, kuota langganan; backend tetap Supabase sebagai deviasi disetujui). Kode saat ini masih banyak mengikuti `radius-mvp-legacy`/`irbid-mvp-v2-2026-09-21`; jangan menyebut fitur lama sebagai requirement aktif hanya karena sudah ada di UI. Keputusan ini didokumentasikan di `decision-sa7tein-mvp.md`.

## Menambah PRD atau BRS

1. Simpan PDF, Markdown, atau teks di `docs/product/prd/inbox/`.
2. Jalankan `npm run prd:intake -- docs/product/prd/inbox/NamaDokumen.pdf revisi-unik`.
3. Perintah memindahkan sumber ke `versions/revisi-unik/`, mencatat SHA-256, dan membuat formulir analisis serta milestone. Ia **tidak** mengaktifkan revisi atau menebak isi dokumen.
4. Agen membaca sumber **seluruhnya**, mengisi formulir dengan ID requirement, kutipan lokasi halaman/section, perubahan dari revisi aktif, dampak UI, state mock, kontrak BE, keputusan, dan ketidakpastian. Setiap fakta wajib punya sumber. Konflik atau angka yang tidak konsisten ditandai `UNRESOLVED`; jangan diselesaikan dengan tebakan.
5. Baru setelah keputusan produk tertulis, ubah `activeRevision`, status revisi lama/baru, dan `supersedes` di manifest. Perbarui AGENTS.md, `.rules.json`, `/documentation`, dan atlas agar tidak meninggalkan kebenaran ganda.
6. Pecah milestone berdasarkan dependensi: model domain dan kontrak → UI pembeli → merchant → kurir → admin → verifikasi lintas role. Setiap milestone punya acceptance criteria yang dapat diuji di front-end mock, owner, dan dependensi. Jalankan `npm run governance:check`, `npm run lint`, `npm run build`.

**Intake otomatis berarti scaffolding dan integritas versi otomatis, bukan penilaian semantik PDF tanpa agen.** Generator tidak boleh mengklaim requirement atau milestone sudah dianalisis sebelum manusia/agen mengisi dan memverifikasi sumbernya.

Status: `proposed` → `active` → `superseded`. Hanya satu `active`. PRD baru tidak otomatis mengalahkan PRD aktif berdasarkan nama file atau tanggal. BRS adalah sumber pelengkap: jika bertentangan dengan PRD aktif, catat konflik dan keputusan; jangan diam-diam mengganti aturan.

Kontrak backend masa depan dicatat per requirement: field/tipe, aktor, event, state, error, waktu/SLA, data sensitif, dan pemilik validasi. Repo ini tetap showcase front-end; catatan kontrak tidak berarti API, database, atau pembayaran sudah diimplementasikan.
