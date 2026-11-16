// src/lib/firestoreWriteCounter.ts
// Melacak estimasi penulisan Firestore (Spark Plan Quota Tracker) untuk sesi ini.

let sessionWriteCount = 0;
const listeners = new Set<(count: number) => void>();

export function tambahEstimasiTulis(jumlah: number = 1): void {
  sessionWriteCount += Math.max(0, jumlah);
  listeners.forEach((fn) => fn(sessionWriteCount));
}

export function getEstimasiTulisSesiIni(): number {
  return sessionWriteCount;
}

export function subscribeEstimasiTulis(callback: (count: number) => void): () => void {
  listeners.add(callback);
  callback(sessionWriteCount);
  return () => {
    listeners.delete(callback);
  };
}
