/** Alle Wege im Radcomputer, an einer Stelle wie im NavigationService von Kudos Care. */
const BASE = '/app/radcomputer';

export const RC = {
  ride: `${BASE}/fahrt`,
  menu: `${BASE}/menue`,
  route: `${BASE}/menue/route`,
  training: `${BASE}/menue/training`,
  save: `${BASE}/menue/speichern`,
  settings: `${BASE}/menue/einstellungen`,
} as const;

/**
 * `state` beim Freischalten des Uploads. Der Strava-Callback von Kudos Care erkennt daran,
 * dass er danach zurück in den Radcomputer führen soll.
 */
export const RADCOMPUTER_GRANT_STATE = 'radcomputer';
