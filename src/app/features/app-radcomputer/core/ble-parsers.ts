export interface CrankData {
  revs: number;
  /** Zeitpunkt der letzten Kurbelumdrehung in 1/1024 s (läuft bei 65536 über) */
  time: number;
}

export interface PowerMeasurement {
  power: number;
  crank: CrankData | null;
}

export const uuid16 = (n: number): string =>
  `0000${n.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;

/** Cycling Power Measurement (0x2A63): Flags, Leistung, dann optionale Felder in fester Reihenfolge. */
export function parsePower(dv: DataView): PowerMeasurement {
  const flags = dv.getUint16(0, true);
  const out: PowerMeasurement = { power: dv.getInt16(2, true), crank: null };
  let o = 4;
  if (flags & 0x01) o += 1; // Pedalbalance
  if (flags & 0x04) o += 2; // akkumuliertes Drehmoment
  if (flags & 0x10) o += 6; // Radumdrehungen
  if (flags & 0x20 && dv.byteLength >= o + 4) {
    out.crank = { revs: dv.getUint16(o, true), time: dv.getUint16(o + 2, true) };
  }
  return out;
}

/** Heart Rate Measurement (0x2A37): 8 oder 16 Bit je nach Flag. */
export function parseHeartRate(dv: DataView): number {
  return dv.getUint8(0) & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1);
}

/** Kadenz aus zwei aufeinanderfolgenden Kurbelmeldungen, `null` wenn keine neue Umdrehung dabei war. */
export function cadenceFrom(prev: CrankData, next: CrankData): number | null {
  const dRevs = (next.revs - prev.revs) & 0xffff;
  const dTime = (next.time - prev.time) & 0xffff;
  if (dRevs === 0 || dTime === 0) return null;
  const rpm = (dRevs * 1024 * 60) / dTime;
  return rpm < 250 ? rpm : null;
}
