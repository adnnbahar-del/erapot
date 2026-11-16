# Aplikasi E-Rapor SD (Kurikulum Merdeka)

Aplikasi web modern **E-Rapor SD** untuk Kurikulum Merdeka yang dirancang untuk menggantikan file Excel rapor `app_RAPOR TAHUN 2025_Fase C.6_PWS.xlsm` (Tim Kurikulum Pengawas Disdikbud Kab. Tanggamus). Aplikasi ini digunakan oleh wali kelas I–VI di Sekolah Dasar untuk mengelola data siswa, mengisi asesmen formatif & sumatif, serta **mengunduh rapor PDF per anak, massal dalam arsip ZIP, maupun satu PDF gabungan**.

---

## 🌟 Fitur Utama

1. **Autentikasi Aman Berbasis Sesi**:
   - Login bergaya portal resmi Kemdikbudristek (latar gradasi biru tua `#0b1f6b` ke `#123092`, tombol hijau `#0f9d58`).
   - Pilihan kelas I–VI (Fase A, B, C otomatis ditentukan).
   - Password admin terenkripsi SHA-256 + salt unik di `PropertiesService` Google Apps Script.
   - Pembatasan proteksi login gagal maks. 5 kali dalam 15 menit.
2. **Database Cloud Google Spreadsheet**:
   - Satu file spreadsheet `DB E-Rapor SD` bertindak sebagai database multi-tabel (20 tab terstruktur).
   - Penulisan batch `upsertMany` dengan `LockService` (mencegah tumpang tindih data antarkelas).
   - Format teks `@` otomatis menjaga nomor identitas seperti NIS/NISN berawalan angka `0` tetap utuh.
   - Dukungan mode offline / uji coba lokal otomatis saat spreadsheet belum terhubung.
3. **Manajemen Siswa & Kuota Kelas**:
   - Batas ketat **50 siswa per kelas** (divalidasi di frontend & Google Apps Script).
   - Impor data siswa dari Excel (`.xlsx`/`.xlsm`) secara dinamis berdasarkan nama kolom header.
4. **Kurikulum Merdeka Fleksibel**:
   - Pengaturan mata pelajaran intrakurikuler dan muatan lokal (tanpa batas 15 seperti di Excel).
   - Tujuan Pembelajaran (TP) dan Lingkup Materi (LM) tanpa batasan kuota.
5. **Penilaian Akurat Sesuai Formula Excel**:
   - **Asesmen Formatif**: Pengaturan ketercapaian KKTP dan pemilihan TP tampil di rapor untuk menghasilkan deskripsi capaian otomatis yang rapi dan alami.
   - **Asesmen Sumatif**: Input nilai LM (Sumatif 1, 2, ...), PTS, PAS dengan navigasi Tab/Enter dan dukungan **paste 1 kolom langsung dari Excel**.
   - **Rekap Nilai Akhir (NA)**: Perhitungan rata-rata berformat koma (contoh `"85,22"`), jumlah, dan peringkat seri standar kompetisi.
   - **P5 (Kokurikuler)**: Integrasi 8 Dimensi Profil Lulusan (DPL) dan deskripsi projek otomatis.
   - **7 KAIH**: Rekapitulasi 7 Kebiasaan Anak Hebat Indonesia periode semester aktif.
   - **Rekap Kehadiran**: Sakit, Izin, dan Tanpa Keterangan otomatis terakumulasi.
6. **Cetak PDF Berkualitas Tinggi (`@react-pdf/renderer`)**:
   - Pilihan ukuran kertas resmi **F4 / Folio (8.5 × 13 inci → `[612, 936]` pt)** (default) dan **A4**.
   - Unduh PDF per anak.
   - Unduh Semua Siswa dalam format **ZIP** (`Rapor_{noUrut}_{NAMA}.pdf`).
   - Unduh **Satu PDF Gabungan** seluruh siswa kelas untuk cetak langsung.
   - Unduh **Bundel Lengkap** per anak (Sampul + Identitas + Rapor + 7 KAIH).
   - Tanda tangan digital & stempel sekolah (PNG transparan).

---

## 🚀 Panduan Instalasi & Menghubungkan ke Google Spreadsheet

Ikuti langkah-langkah berikut untuk mengaktifkan database Google Spreadsheet dan Google Apps Script:

### Langkah 1: Buat Google Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet: **DB E-Rapor SD**.

### Langkah 2: Pasang Kode Google Apps Script
1. Pada menu Google Sheets, klik **Extensions (Ekstensi)** → **Apps Script**.
2. Hapus isi file default `Code.gs`, lalu salin dan tempel seluruh isi file [apps-script/Code.gs](apps-script/Code.gs).
3. Buat file script baru di Apps Script dengan nama `Setup` (klik tanda `+` di samping Files → Script), lalu salin seluruh isi [apps-script/Setup.gs](apps-script/Setup.gs).
4. Klik ikon roda gigi ⚙️ **Project Settings (Setelan Proyek)** di bilah kiri Apps Script, centang kotak **"Show 'appsscript.json' manifest file in editor"**.
5. Buka tab `appsscript.json` di editor Apps Script, ganti isinya dengan isi file [apps-script/appsscript.json](apps-script/appsscript.json), lalu simpan (Ctrl+S).

### Langkah 3: Inisialisasi Database & Data Master
1. Di bilah atas Apps Script, pilih fungsi **`setupDatabase`** pada dropdown fungsi, lalu klik tombol **Run (Jalankan)**.
2. Google akan meminta izin otorisasi akses (Review permissions → pilih akun Google Anda → Advanced → Go to Untitled project (unsafe) → Allow).
3. Setelah `setupDatabase` selesai, pilih fungsi **`seedData`** lalu klik **Run (Jalankan)**.
   > **Catatan Penting**: `seedData` hanya mengisi data master sekolah (SDN 1 Sukaraja), 6 kelas, mata pelajaran kelas VI, contoh TP/LM Matematika, ekskul Pramuka, dan tema kokurikuler. **Data siswa tetap kosong (0 siswa)** sesuai spesifikasi, siap diisi oleh wali kelas.

### Langkah 4: Deploy sebagai Web App
1. Klik tombol biru **Deploy** di pojok kanan atas editor Apps Script → pilih **New deployment**.
2. Klik ikon gerigi di samping *Select type* → pilih **Web app**.
3. Isi konfigurasi deployment:
   - **Description**: `API E-Rapor SD v1`
   - **Execute as**: `Me (email-anda@gmail.com)`
   - **Who has access**: `Anyone` *(Siapa saja, termasuk anonim)*
4. Klik **Deploy**.
5. Salin **Web app URL** yang dihasilkan (format: `https://script.google.com/macros/s/AKfycbx.../exec`).

### Langkah 5: Hubungkan ke Aplikasi Frontend
1. Buka file `.env` di folder proyek ini.
2. Tempel URL Web App ke variabel `VITE_GAS_URL`:
   ```env
   VITE_GAS_URL=https://script.google.com/macros/s/AKfycbx.../exec
   ```
3. Simpan file `.env`.

> 💡 **PENTING**: Setiap kali Anda mengubah kode script di Apps Script, Anda **wajib membuat versi deployment baru** agar perubahan berlaku: klik **Deploy** → **Manage deployments** → klik ikon pensil Edit → pilih Version: **New version** → klik **Deploy**.

---

## 💻 Menjalankan Aplikasi di Komputer Lokal

Pastikan Node.js (v18+) sudah terpasang.

1. Install dependensi:
   ```bash
   npm install
   ```
2. Jalankan unit test:
   ```bash
   npm test
   ```
3. Jalankan server lokal:
   ```bash
   npm run dev
   ```
4. Buka tautan di browser: `http://localhost:5173/`

### Informasi Login Awal
- **Wali Kelas**: Pilih kelas (misal *Wali Kelas VI (enam)*)
- **Nama Wali Kelas**: *ADNAN BAHAR, S.Pd*
- **Password Admin Bawaan**: `admin123`
- Segera ganti password admin setelah login di menu **Data User** demi keamanan sekolah Anda.

---

## 🌐 Deploy Frontend ke Cloud (Gratis)

Aplikasi frontend React ini siap di-deploy secara instan ke layanan hosting mana pun:

### Deploy ke Vercel:
1. Hubungkan repository GitHub ini ke [Vercel](https://vercel.com).
2. Tambahkan Environment Variable di Vercel:
   - Key: `VITE_GAS_URL`
   - Value: URL Web App Apps Script Anda.
3. Klik **Deploy**.

### Deploy ke Netlify:
1. Drag and drop folder `dist` (setelah menjalankan `npm run build`) ke dashboard [Netlify Drop](https://app.netlify.com/drop).
2. Atau hubungkan repositori Git dengan build command `npm run build` dan publish directory `dist`.

---

## 🧪 Pengujian Unit Test

Formula dan logika perhitungan nilai, rata-rata berformat koma, peringkat seri, dan perakitan deskripsi kompetensi telah diuji secara komprehensif menggunakan **Vitest**:

```bash
npx vitest run
```

Seluruh 7 uji validasi logika rapor dinyatakan **100% LULUS (Passed)**.
