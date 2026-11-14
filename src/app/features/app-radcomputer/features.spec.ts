import { parseGpx } from './nav/gpx';
import { buildRoute, matchRoute } from './nav/route-builder';
import { osrmCue } from './nav/route-planner';
import { parseErgMrc, parseWorkoutFile, parseZwo } from './workout/workout-parsers';

const M_LAT = 111320;
const M_LON = M_LAT * Math.cos((51 * Math.PI) / 180);

/** Strecke aus Teilstücken [Ost, Nord] in Metern, ein Punkt alle 10 m. */
function path(legs: [number, number][]): [number, number][] {
  const out: [number, number][] = [[51, 7]];
  let east = 0;
  let north = 0;
  for (const [dE, dN] of legs) {
    const steps = Math.round(Math.hypot(dE, dN) / 10);
    for (let i = 1; i <= steps; i++)
      out.push([51 + (north + (dN * i) / steps) / M_LAT, 7 + (east + (dE * i) / steps) / M_LON]);
    east += dE;
    north += dN;
  }
  return out;
}

describe('Route', () => {
  const route = buildRoute(
    'Test',
    path([
      [0, 400],
      [300, 0],
      [0, 300],
      [-200, 0],
      [0, 300],
    ]),
  );

  it('misst die Länge', () => {
    expect(route.lengthM).toBeCloseTo(1500, -1);
  });

  it('erkennt Abbiegungen aus der Geometrie und endet mit dem Ziel', () => {
    expect(route.cues.map((c) => c.kind)).toEqual(['right', 'left', 'left', 'right', 'arrive']);
    expect(route.cues[0].dist).toBeCloseTo(400, -1);
    expect(route.cues[1].dist).toBeCloseTo(700, -1);
  });

  it('sagt auf gerader Strecke und in weiten Bögen nichts an', () => {
    // Viertelkreis mit 200 m Radius: 20 m Blick nach vorn und hinten ergeben nur ~11 Grad.
    const arc: [number, number][] = [];
    for (let a = 0; a <= 90; a += 2) {
      const rad = (a * Math.PI) / 180;
      arc.push([51 + (200 * Math.sin(rad)) / M_LAT, 7 + (200 * (1 - Math.cos(rad))) / M_LON]);
    }
    expect(buildRoute('Bogen', arc).cues.map((c) => c.kind)).toEqual(['arrive']);
  });

  it('findet die Position auf der Route samt Abstand', () => {
    const on = matchRoute(route.points, 51 + 200 / M_LAT, 7, 0);
    expect(on.alongM).toBeCloseTo(200, 0);
    expect(on.offM).toBeLessThan(1);
    const off = matchRoute(route.points, 51 + 200 / M_LAT, 7 + 50 / M_LON, 0);
    expect(off.offM).toBeCloseTo(50, 0);
  });

  it('bleibt bei Hin-und-zurück-Strecken auf dem richtigen Ast', () => {
    const outAndBack = buildRoute(
      'Pendel',
      path([
        [0, 500],
        [0, -500],
      ]),
    );
    // Auf dem Rückweg, 100 m vor dem Ende: die Stelle liegt auch auf dem Hinweg.
    const hint = outAndBack.points.findIndex((p) => p.dist >= 880);
    expect(matchRoute(outAndBack.points, 51 + 100 / M_LAT, 7, hint).alongM).toBeCloseTo(900, -1);
  });

  it('übernimmt Hinweise des Routendienstes', () => {
    const cue = osrmCue({
      name: 'Kölner Straße',
      maneuver: { type: 'turn', modifier: 'right', location: [7, 51 + 400 / M_LAT] },
    });
    expect(cue?.text).toBe('Rechts abbiegen auf Kölner Straße');
    expect(osrmCue({ maneuver: { type: 'depart', location: [7, 51] } })).toBeNull();
    expect(
      osrmCue({ maneuver: { type: 'new name', modifier: 'straight', location: [7, 51] } }),
    ).toBeNull();
    expect(
      osrmCue({ maneuver: { type: 'roundabout', modifier: 'right', exit: 2, location: [7, 51] } })
        ?.text,
    ).toBe('Im Kreisverkehr die 2. Ausfahrt nehmen');
    const routed = buildRoute(
      'Ziel',
      path([
        [0, 400],
        [300, 0],
      ]),
      { cues: [cue!] },
    );
    expect(routed.cues.map((c) => c.text)).toEqual([
      'Rechts abbiegen auf Kölner Straße',
      'Ziel erreicht',
    ]);
    expect(routed.cues[0].dist).toBeCloseTo(400, -1);
  });
});

describe('GPX', () => {
  it('liest Trackpunkte und Namen', () => {
    const gpx = parseGpx(
      `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Feierabendrunde</name><trkseg>
        <trkpt lat="51.0" lon="7.0"><ele>100</ele></trkpt><trkpt lat="51.001" lon="7.0"/></trkseg></trk></gpx>`,
    );
    expect(gpx.name).toBe('Feierabendrunde');
    expect(gpx.coords).toEqual([
      [51, 7],
      [51.001, 7],
    ]);
  });

  it('meldet leere und kaputte Dateien verständlich', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow('keine Strecke');
    expect(() => parseGpx('kein xml')).toThrow('kein gültiges GPX');
  });
});

describe('Trainingsdateien', () => {
  const zwo = `<workout_file><name>4x4</name><workout>
    <Warmup Duration="600" PowerLow="0.5" PowerHigh="0.75"/>
    <IntervalsT Repeat="2" OnDuration="240" OffDuration="120" OnPower="1.1" OffPower="0.5"/>
    <SteadyState Duration="300" Power="0.65"/>
    <FreeRide Duration="60"/>
    <textevent timeoffset="10" message="Los"/>
    <Cooldown Duration="300" PowerLow="0.6" PowerHigh="0.4"/>
  </workout></workout_file>`;

  it('liest ZWO und rechnet mit der FTP in Watt um', () => {
    const w = parseZwo(zwo, 200);
    expect(w.name).toBe('4x4');
    expect(w.steps.map((s) => s.label)).toEqual([
      'Einfahren',
      'Belastung 1 von 2',
      'Erholung 1 von 2',
      'Belastung 2 von 2',
      'Erholung 2 von 2',
      'Grundlage',
      'Freie Fahrt',
      'Ausfahren',
    ]);
    expect(w.steps[0]).toMatchObject({ durationS: 600, fromW: 100, toW: 150 });
    expect(w.steps[1]).toMatchObject({ durationS: 240, fromW: 220, toW: 220 });
    expect(w.steps[6]).toMatchObject({ fromW: null, toW: null });
    expect(w.steps[7]).toMatchObject({ fromW: 120, toW: 80 }); // Ausfahren fällt ab
    expect(w.totalS).toBe(600 + 2 * 360 + 300 + 60 + 300);
  });

  it('liest MRC in Prozent und ERG in Watt', () => {
    const data = '[COURSE DATA]\n0\t50\n5\t50\n5\t100\n8\t100\n8\t60\n10\t40\n[END COURSE DATA]';
    const mrc = parseErgMrc(
      `[COURSE HEADER]\nDESCRIPTION = Schwelle\nMINUTES PERCENT\n[END COURSE HEADER]\n${data}`,
      200,
    );
    expect(mrc.name).toBe('Schwelle');
    expect(mrc.steps).toEqual([
      { label: 'Locker', durationS: 300, fromW: 100, toW: 100 },
      { label: 'Schwelle', durationS: 180, fromW: 200, toW: 200 },
      { label: 'Rampe', durationS: 120, fromW: 120, toW: 80 },
    ]);
    const erg = parseErgMrc(
      `[COURSE HEADER]\nFTP = 250\nMINUTES WATTS\n[END COURSE HEADER]\n${data}`,
      200,
    );
    expect(erg.steps[1]).toMatchObject({ fromW: 100, toW: 100 }); // Watt bleiben Watt
  });

  it('erkennt das Format an der Endung und lehnt FIT verständlich ab', () => {
    expect(parseWorkoutFile('plan.zwo', zwo, 250).steps[1].fromW).toBe(275);
    expect(() => parseWorkoutFile('plan.fit', '', 200)).toThrow('.zwo');
    expect(() => parseWorkoutFile('plan.txt', 'hallo', 200)).toThrow('Unbekanntes Format');
  });
});
