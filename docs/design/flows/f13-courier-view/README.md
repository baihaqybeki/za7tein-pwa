# F13 — Tampilan Kurir (sisi pengantaran)

Workflow sisi kurir: 4 checkpoint + SLA timer + OTP. Milestone **M4/M5** (deps M0); PRD aktif `irbid-mvp-v2-2026-09-21`. **Sudah di-develop** — rencana & keputusan implementasi ada di `docs/plan-courier.md` (K0–K5); spec ini tetap sumber gambaran alur. K5 menambah masuk kurir (nomor WA), ringkasan dashboard, dan notif mock.

| Berkas | Isi |
|---|---|
| `f13-courier-view.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f13-courier-view.sequence.json` | **Sequence orkestrasi sistem** (checkpoint → OTP → settle → push), scoped ke F13 |
| `f13-courier-view.html` | Artefak jadi |
| `f13-courier-view.visual-check.*` | Bukti visual-check |

## Alur

**Lane Ambil:** Order masuk (dari merchant) → Tap "Ambil" (2-way: merchant konfirmasi di app).

**Lane Perjalanan:** Tap "Berangkat" (SLA 15m → auto-alert super admin) → Tap "Tiba" (geolocation + foto → notif customer). Guard: customer lalai → tap "Batal" (total 10 menit).

**Lane Serah terima:** Masuk OTP (4 digit dari customer) → Selesai (`otp_verified` → `reserve_settled`).

## Aturan keras

- **Tanpa live tracking** (C-10) — customer melihat **status + estimasi**, bukan peta posisi kurir. Bukti = checkpoint + 1 snapshot geolokasi + foto; kurir tidak share lokasi berkelanjutan.
- **Tugas datang sebagai batch** dari merchant (assign setelah batch ready, C-06); kurir mengantar order dalam batch.
- **Tanpa OTP tidak bisa settle** — kurir tak dapat komisi (C-09: OTP = satu-satunya trigger settle).
- **OTP ditampilkan customer, diketik kurir** (C-09) — layar customer memakai `otpDisplayCode`, form input hanya di layar kurir.
- **Notif customer = mock tapi tersambung** — kurir tap Tiba → 1 notif masuk kotak masuk customer (`pushNotification`) + kartu OTP customer muncul; Web Push asli tidak diimplementasi (AGENTS.md §1, R-PUSH-01), bukan klaim kirim sungguhan.
- **Masuk kurir pakai nomor WA (E.164)** — dasar flow `f21-account-auth` + `f16`; sesi mock, tanpa guard rute (AGENTS.md §1).
- Timer: 15m Ambil→Berangkat · 30m Berangkat→Tiba · 10m Tiba→OTP auto-complete. 15/30/10 = sementara (PO 2026-09-22).
- Tiba +5m: notif + call customer · +5m lagi: kurir boleh "Batal" · total maks 10m.
- Kurir = karyawan merchant: **tips only** di wallet, platform tak pegang dana kurir (C-06). Tidak ada live GPS (C-10) — checkpoint + snapshot saja.

## Terhubung (lihat `../INDEX.json`)

`f12 → f13:masuk` (tugas dari merchant); `f13:tiba → f5` (checkpoint lifecycle); `f13:otp → f1:otp` + `f2:held->settled` (`reserve_settled`); timer → `f11` (push).

## Sumber (jangan dikarang)

- `R-DELIV-01` (DECIDED), `R-COD-01`, `C-06`..`C-11` — `analysis.md` · Milestone M4/M5/M11 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** OQ-14 — % penalti customer lalai (30%/50%/full ongkir); OQ-13 — SLA 15/30/10 sementara, final = nunggu data rute Irbid
- **UNRESOLVED-by-absence:** detail lantai/unit alamat & label tombol "Mulai Antar" tidak ada di PRD v2 (padanan resmi = "Ambil"/"Berangkat"; sumber lama di baseline `irbid-mvp-v2-2026-09-12`) — jangan diarang, tandai saat develop

## Update

```bash
./scripts/flows-gate.sh f13-courier-view   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
