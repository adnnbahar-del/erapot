import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Save, Image as ImageIcon, Upload } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const DataSekolah: React.FC = () => {
  const { data, session, updateSekolah, updateKelasWali, notify } = useApp();

  const [form, setForm] = useState(() => {
    return {
      nama: data?.sekolah.nama || '',
      npsn: data?.sekolah.npsn || '',
      nss: data?.sekolah.nss || '',
      alamat: data?.sekolah.alamat || '',
      kode_pos: data?.sekolah.kode_pos || '',
      desa: data?.sekolah.desa || '',
      kecamatan: data?.sekolah.kecamatan || '',
      kabupaten: data?.sekolah.kabupaten || '',
      provinsi: data?.sekolah.provinsi || '',
      website: data?.sekolah.website || '',
      email: data?.sekolah.email || '',
      kepala_sekolah: data?.sekolah.kepala_sekolah || '',
      nip_kepala_sekolah: data?.sekolah.nip_kepala_sekolah || '',
      tempat_rapor: data?.sekolah.tempat_rapor || 'Sukaraja, 20 Desember 2025',
      logo_url: data?.sekolah.logo_url || '',
      ttd_kepsek_url: data?.sekolah.ttd_kepsek_url || '',
      stempel_url: data?.sekolah.stempel_url || '',
      format_kelas_rapor: data?.sekolah.format_kelas_rapor || 'romawi',
      // Wali Kelas fields
      nama_wali: session?.namaWali || '',
      nip_wali: data?.kelas.find((k) => k.id === session?.kelasId)?.nip_wali || '',
    };
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  
  const resizeImageViaCanvas = (file: File, maxDim = 300): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, 0.9));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: 'logo_url' | 'ttd_kepsek_url' | 'stempel_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 5) {
      notify('Ukuran berkas maksimal 5MB.', 'error');
      return;
    }

    try {
      // Resize otomatis di sisi klien (maks 300x300 px) via HTML5 Canvas
      const base64 = await resizeImageViaCanvas(file, 300);
      setForm((prev) => ({ ...prev, [fieldName]: base64 }));
      notify(`Gambar ${fieldName === 'logo_url' ? 'Logo Sekolah' : fieldName === 'ttd_kepsek_url' ? 'TTD' : 'Stempel'} berhasil diproses (maks. 300x300px).`, 'success');
    } catch {
      notify('Gagal memproses gambar.', 'error');
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSaving(true);
    try {
      await updateSekolah({
        nama: form.nama,
        npsn: form.npsn,
        nss: form.nss,
        alamat: form.alamat,
        kode_pos: form.kode_pos,
        desa: form.desa,
        kecamatan: form.kecamatan,
        kabupaten: form.kabupaten,
        provinsi: form.provinsi,
        website: form.website,
        email: form.email,
        kepala_sekolah: form.kepala_sekolah,
        nip_kepala_sekolah: form.nip_kepala_sekolah,
        tempat_rapor: form.tempat_rapor,
        logo_url: form.logo_url,
        ttd_kepsek_url: form.ttd_kepsek_url,
        stempel_url: form.stempel_url,
        format_kelas_rapor: form.format_kelas_rapor as any,
      });

      await updateKelasWali(session.kelasId, form.nama_wali, form.nip_wali);

      if (isFirebaseConfigured) {
        try {
          await setDoc(doc(db, 'pengaturan', 'sekolah'), {
            nama: form.nama,
            npsn: form.npsn,
            nss: form.nss,
            alamat: form.alamat,
            kode_pos: form.kode_pos,
            desa: form.desa,
            kecamatan: form.kecamatan,
            kabupaten: form.kabupaten,
            provinsi: form.provinsi,
            website: form.website,
            email: form.email,
            kepala_sekolah: form.kepala_sekolah,
            nip_kepala_sekolah: form.nip_kepala_sekolah,
            tempat_rapor: form.tempat_rapor,
            logo_url: form.logo_url,
            ttd_kepsek_url: form.ttd_kepsek_url,
            stempel_url: form.stempel_url,
            format_kelas_rapor: form.format_kelas_rapor,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('Gagal simpan pengaturan sekolah Firestore:', e);
        }
      }
    } catch (err: any) {
      notify(err.message || 'Gagal menyimpan data sekolah', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs max-w-4xl">
      <div className="flex items-center gap-2 mb-2">
        <Building2 size={22} className="text-kemdikbud-dark" />
        <h3 className="text-lg font-bold text-slate-800">Data Sekolah & Rapor</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Informasi profil satuan pendidikan yang dicetak pada halaman sampul, identitas, dan laporan rapor.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Identitas Sekolah */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
          <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
            A. Satuan Pendidikan
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah</label>
              <input
                type="text"
                name="nama"
                value={form.nama}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                name="npsn"
                value={form.npsn}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NSS</label>
              <input
                type="text"
                name="nss"
                value={form.nss}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Sekolah</label>
              <input
                type="text"
                name="alamat"
                value={form.alamat}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode Pos</label>
              <input
                type="text"
                name="kode_pos"
                value={form.kode_pos}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kelurahan / Desa</label>
              <input
                type="text"
                name="desa"
                value={form.desa}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
              <input
                type="text"
                name="kecamatan"
                value={form.kecamatan}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
              <input
                type="text"
                name="kabupaten"
                value={form.kabupaten}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Provinsi</label>
              <input
                type="text"
                name="provinsi"
                value={form.provinsi}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website</label>
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Pejabat & Pengesahan */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
          <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
            B. Kepala Sekolah, Wali Kelas & Titimangsa
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                name="kepala_sekolah"
                value={form.kepala_sekolah}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                name="nip_kepala_sekolah"
                value={form.nip_kepala_sekolah}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Wali Kelas ({session?.kelas})</label>
              <input
                type="text"
                name="nama_wali"
                value={form.nama_wali}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Wali Kelas</label>
              <input
                type="text"
                name="nip_wali"
                value={form.nip_wali}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Tempat & Tanggal Rapor</label>
              <input
                type="text"
                name="tempat_rapor"
                value={form.tempat_rapor}
                onChange={handleChange}
                placeholder="Contoh: Sukaraja, 20 Desember 2025"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Teks ini akan dicetak persis pada bagian tanda tangan rapor dan sampul.
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Format Penulisan Kelas di Rapor & Dokumen Cetak
              </label>
              <select
                name="format_kelas_rapor"
                value={form.format_kelas_rapor}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none font-semibold text-slate-800"
              >
                <option value="romawi">I A (Satu A) — Standar Kemdikbud (Bawaan)</option>
                <option value="angka">1A — Format Angka Singkat</option>
                <option value="strip">I-A — Format Romawi Strip</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Format penulisan rombel pada dokumen rapor, sampul, identitas, buku induk, dan 7 KAIH.
              </span>
            </div>
          </div>
        </div>

        {/* Tanda Tangan & Stempel */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
          <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
            C. Logo Sekolah, Tanda Tangan & Stempel Digital (Paket Spark)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Logo Sekolah (Client-side Resize Max 300x300 Canvas Base64) */}
            <div className="sm:col-span-2 pb-4 border-b border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1">
                Logo Sekolah (Otomatis Di-resize Maks. 300×300 px Tanpa Cloud Storage)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Logo akan dicetak pada halaman sampul dan kop rapor. Bawaan sistem menggunakan Tut Wuri Handayani (/tutwuri.png).
              </p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 border rounded-xl bg-white p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo Sekolah" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <img src="/tutwuri.png" alt="Tut Wuri Handayani (Default)" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => handleImageUpload(e, 'logo_url')}
                    className="text-xs text-slate-500"
                  />
                  <div className="flex items-center gap-3 mt-1.5">
                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, logo_url: '' }))}
                        className="text-[11px] text-red-600 font-bold hover:underline"
                      >
                        Reset ke Bawaan (Tut Wuri Handayani)
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Disimpan sebagai Base64 di Firestore (Kompensasi Paket Spark)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-2">Tanda Tangan Kepala Sekolah (PNG Transparan)</label>
              <div className="flex items-center gap-4">
                {form.ttd_kepsek_url ? (
                  <div className="w-24 h-16 border rounded bg-white p-1 flex items-center justify-center">
                    <img src={form.ttd_kepsek_url} alt="TTD" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-16 border border-dashed rounded bg-white flex items-center justify-center text-slate-300">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => handleImageUpload(e, 'ttd_kepsek_url')}
                    className="text-xs text-slate-500"
                  />
                  {form.ttd_kepsek_url && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, ttd_kepsek_url: '' }))}
                      className="text-[11px] text-red-600 font-bold block mt-1"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-2">Stempel Sekolah (PNG Transparan)</label>
              <div className="flex items-center gap-4">
                {form.stempel_url ? (
                  <div className="w-24 h-16 border rounded bg-white p-1 flex items-center justify-center">
                    <img src={form.stempel_url} alt="Stempel" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-16 border border-dashed rounded bg-white flex items-center justify-center text-slate-300">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => handleImageUpload(e, 'stempel_url')}
                    className="text-xs text-slate-500"
                  />
                  {form.stempel_url && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, stempel_url: '' }))}
                      className="text-[11px] text-red-600 font-bold block mt-1"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-kemdikbud-dark hover:bg-kemdikbud-hover text-white font-bold shadow transition disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Data Sekolah'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
