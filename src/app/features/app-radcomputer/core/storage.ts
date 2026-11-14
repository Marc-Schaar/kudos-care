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
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* voll oder gesperrt */
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
