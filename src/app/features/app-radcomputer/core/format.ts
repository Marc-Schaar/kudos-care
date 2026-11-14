export const DASH = '--';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Zahl mit deutschem Dezimalkomma, `--` wenn kein Wert vorliegt. */
export function num(v: number | null | undefined, digits = 0): string {
  return v == null || !Number.isFinite(v) ? DASH : v.toFixed(digits).replace('.', ',');
}

/** 0:07, 12:34 oder 1:23:45 */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function kmh(meters: number, ms: number): number | null {
  return ms >= 1000 ? (meters / (ms / 1000)) * 3.6 : null;
}

/** Entfernung für die Anzeige: „350 m“, „4,2 km“, „38 km“ */
export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${num(m / 1000, m >= 10000 ? 0 : 1)} km`;
}

/**
 * Entfernung für die Sprachausgabe. Im Dativ für „in 200 Metern“,
 * sonst im Nominativ für „4,2 Kilometer bis …“.
 */
export function speakDistance(m: number, dative = true): string {
  const n = dative ? 'n' : '';
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} Meter${n}`;
  const km = Math.round(m / 100) / 10;
  if (km === 1) return dative ? 'einem Kilometer' : 'ein Kilometer';
  return `${String(km).replace('.', ',')} Kilometer${n}`;
}

/** Dauer für die Sprachausgabe: „4 Minuten 30 Sekunden“ */
export function speakDuration(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? '1 Stunde' : `${h} Stunden`);
  if (m) parts.push(m === 1 ? '1 Minute' : `${m} Minuten`);
  if (sec && !h) parts.push(sec === 1 ? '1 Sekunde' : `${sec} Sekunden`);
  return parts.length ? parts.join(' ') : '0 Sekunden';
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
