import { Lap, RideStats, TrackPoint } from './models';

const iso = (t: number): string => new Date(t).toISOString();
const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Baut eine TCX-Datei mit einer Runde je aufgezeichneter Runde. Strava und der
 * Import von Garmin Connect lesen daraus Strecke, Puls, Kadenz und Leistung.
 */
export function buildTcx(
  track: readonly TrackPoint[],
  laps: readonly Lap[],
  stats: RideStats,
): string | null {
  if (!track.length) return null;

  const lapsXml = laps
    .map((lap, i) => {
      const next = laps[i + 1];
      const segment = track.slice(lap.trackIdx, next ? next.trackIdx : track.length);
      if (!segment.length) return '';
      const seconds = ((next ? next.t0 : stats.movingMs) - lap.t0) / 1000;
      const meters = (next ? next.d0 : stats.distanceM) - lap.d0;
      const points = segment
        .map(
          ([t, lat, lon, alt, dist, hr, cad, pwr]) =>
            `<Trackpoint><Time>${iso(t)}</Time>` +
            (lat != null && lon != null
              ? `<Position><LatitudeDegrees>${lat.toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${lon.toFixed(7)}</LongitudeDegrees></Position>`
              : '') +
            (alt != null ? `<AltitudeMeters>${alt.toFixed(1)}</AltitudeMeters>` : '') +
            `<DistanceMeters>${dist.toFixed(1)}</DistanceMeters>` +
            (hr != null ? `<HeartRateBpm><Value>${Math.round(hr)}</Value></HeartRateBpm>` : '') +
            (cad != null ? `<Cadence>${Math.min(254, Math.round(cad))}</Cadence>` : '') +
            (pwr != null
              ? `<Extensions><ns3:TPX><ns3:Watts>${Math.round(pwr)}</ns3:Watts></ns3:TPX></Extensions>`
              : '') +
            '</Trackpoint>',
        )
        .join('');
      return (
        `<Lap StartTime="${iso(segment[0][0])}"><TotalTimeSeconds>${seconds.toFixed(0)}</TotalTimeSeconds>` +
        `<DistanceMeters>${meters.toFixed(1)}</DistanceMeters><Calories>0</Calories>` +
        `<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${points}</Track>` +
        (lap.label ? `<Notes>${escapeXml(lap.label)}</Notes>` : '') +
        '</Lap>'
      );
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">' +
    `<Activities><Activity Sport="Biking"><Id>${iso(track[0][0])}</Id>${lapsXml}</Activity></Activities></TrainingCenterDatabase>\n`
  );
}

export function tcxFileName(startMs: number): string {
  const d = new Date(startMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `fahrt-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.tcx`;
}
