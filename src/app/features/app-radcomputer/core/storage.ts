/**
 * localStorage kann leer zurückkommen, voll sein oder (privater Modus, eingebettete
 * Browser) werfen. Deshalb läuft jeder Zugriff hier durch und scheitert still.
 */
export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  /** `false`, wenn der Speicher voll oder gesperrt ist. */
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nichts zu tun */
    }
  },
};
