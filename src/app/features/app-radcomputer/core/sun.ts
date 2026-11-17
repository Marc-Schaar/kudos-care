/**
 * Sonnenauf- und -untergang ohne Netz, nach dem Verfahren von suncalc (NOAA-Näherung,
 * auf rund eine Minute genau). Für das Datenfeld „Sonnenuntergang“: Wer abends losfährt,
 * will wissen, wie lange es noch hell ist.
 */
const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
/** Obliquität der Ekliptik */
const E = RAD * 23.4397;
/** Oberer Sonnenrand am Horizont, mit Refraktion */
const H0 = RAD * -0.833;

const toDays = (date: Date): number => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number): Date => new Date((j + 0.5 - J1970) * DAY_MS);

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/** `null` bei Polartag oder Polarnacht. */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes | null {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const n = Math.round(toDays(date) - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const m = RAD * (357.5291 + 0.98560028 * ds);
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(E) * Math.sin(l));
  const transit = (a: number): number =>
    J2000 + a + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  const noon = transit(ds);
  const cosW = (Math.sin(H0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW);
  const set = transit(J0 + (w + lw) / (2 * Math.PI) + n);
  return { sunrise: fromJulian(noon - (set - noon)), sunset: fromJulian(set) };
}
