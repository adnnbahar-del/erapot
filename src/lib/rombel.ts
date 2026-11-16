import { TingkatKelas, Fase } from '../types';

export const ROMAWI: readonly TingkatKelas[] = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;
export const TERBILANG = ['Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam'] as const;

export type ModeKelas = 'tunggal' | 'rombel';

export function faseDariTingkat(t: number): Fase {
  return t <= 2 ? 'A' : t <= 4 ? 'B' : 'C';
}

export function idKelas(tingkat: number, huruf: string): string {
  return huruf ? `${tingkat}${huruf.trim().toUpperCase()}` : String(tingkat); // "4A" | "4"
}

export function labelKelas(tingkat: number, huruf: string): string {
  const cleanHuruf = huruf ? huruf.trim().toUpperCase() : '';
  return cleanHuruf ? `${tingkat}${cleanHuruf}` : `Kelas ${tingkat}`; // "4A" | "Kelas 4"
}

export function emailGuru(idKelas: string, domain: string): string {
  return `guru-${idKelas.toLowerCase()}@${domain}`; // guru-4a@… | guru-4@…
}

export function namaRombel(tingkat: number, huruf: string): string {
  return idKelas(tingkat, huruf);
}

/** Label "Kelas" di rapor. */
export function labelRapor(
  tingkat: number,
  huruf: string,
  format: 'romawi' | 'angka' | 'strip' = 'romawi'
): string {
  const cleanHuruf = (huruf || '').trim().toUpperCase();
  const safeTingkat = Math.max(1, Math.min(6, tingkat));
  const r = ROMAWI[safeTingkat - 1];
  const tb = TERBILANG[safeTingkat - 1];

  if (!cleanHuruf) {
    if (format === 'angka') return String(safeTingkat); // "4"
    return `${r} (${tb})`; // "IV (Empat)" (romawi & strip)
  }

  if (format === 'angka') return `${safeTingkat}${cleanHuruf}`; // "4A"
  if (format === 'strip') return `${r}-${cleanHuruf}`; // "IV-A"
  return `${r} ${cleanHuruf} (${tb} ${cleanHuruf})`; // "IV A (Empat A)"
}

export function hurufBerikutnya(hurufAda: string[]): string {
  if (!hurufAda || hurufAda.length === 0) return 'A';
  const charCodes = hurufAda
    .map((h) => (h || '').trim().toUpperCase().charCodeAt(0))
    .filter((code) => !isNaN(code) && code >= 65 && code <= 90);

  const max = charCodes.length > 0 ? Math.max(...charCodes) : 64;
  return String.fromCharCode(max + 1); // ['A','B','C'] → 'D'
}

export function parseRombelNama(nama: string): { tingkat: number; huruf: string } {
  const clean = String(nama || '').trim();

  // Format "Kelas 4" atau "Kelas 4A"
  const matchKelas = clean.match(/^Kelas\s*([1-6])([A-Za-z]+)?$/i);
  if (matchKelas) {
    return {
      tingkat: parseInt(matchKelas[1], 10),
      huruf: matchKelas[2] ? matchKelas[2].toUpperCase() : '',
    };
  }

  // Format "4A", "4", "rombel_4a", "rombel_4"
  const cleanRombel = clean.replace(/^rombel_/i, '');
  const match = cleanRombel.match(/^([1-6])([A-Za-z]+)?$/);
  if (match) {
    return {
      tingkat: parseInt(match[1], 10),
      huruf: match[2] ? match[2].toUpperCase() : '',
    };
  }

  return { tingkat: 1, huruf: '' };
}

/** Urut daftar kelas campuran ["1A","1B","2","3","4A","4B"] tetap urut tingkat lalu huruf */
export function sortKelasList(kelasList: string[]): string[] {
  return [...kelasList].sort((a, b) => {
    const pa = parseRombelNama(a);
    const pb = parseRombelNama(b);
    if (pa.tingkat !== pb.tingkat) {
      return pa.tingkat - pb.tingkat;
    }
    return (pa.huruf || '').localeCompare(pb.huruf || '');
  });
}

/** Validasi izin akses rombel: guru Kelas 4 hanya bisa akses 4, tidak bisa 4A atau 40; guru 4A tidak bisa 4 */
export function canAccessRombel(
  userRole: string,
  userRombelId: string | undefined,
  targetRombelId: string
): boolean {
  if (userRole === 'admin') return true;
  if (!userRombelId || !targetRombelId) return false;
  const cleanUser = userRombelId.replace(/^rombel_/i, '').toLowerCase();
  const cleanTarget = targetRombelId.replace(/^rombel_/i, '').toLowerCase();
  return cleanUser === cleanTarget;
}

export function formatDiubahOleh(session: {
  peran: string;
  kelas?: string;
  username?: string;
  namaWali?: string;
}): string {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const roleText = session.peran === 'admin' ? 'admin' : `wali kelas ${session.kelas || session.username}`;
  return `${roleText}, ${day} ${month} ${year} ${hours}.${mins}`;
}
