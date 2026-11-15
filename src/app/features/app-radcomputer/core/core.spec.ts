import { cadenceFrom, parseHeartRate, parsePower } from './ble-parsers';
import { fmtDistance, fmtTime, num, speakDistance, speakDuration } from './format';
import { angleDiff, bearing, haversine } from './geo';
import { Lap, RideStats, TrackPoint } from './models';
import { buildTcx } from './tcx';
import { compassPoint, relativeWind, windWord } from './wind';

describe('Bluetooth-Parser', () => {
  it('liest Leistung und Kurbeldaten hinter allen optionalen Feldern', () => {
    const dv = new DataView(new ArrayBuffer(17));
    dv.setUint16(0, 0x01 | 0x04 | 0x10 | 0x20, true); // Balance, Drehmoment, Rad, Kurbel
    dv.setInt16(2, 287, true);
    dv.setUint16(13, 777, true);
    dv.setUint16(15, 31000, true);
    expect(parsePower(dv)).toEqual({ power: 287, crank: { revs: 777, time: 31000 } });
  });

  it('liefert ohne Kurbel-Flag keine Kurbeldaten', () => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setInt16(2, 150, true);
    expect(parsePower(dv)).toEqual({ power: 150, crank: null });
  });

  it('rechnet die Kadenz auch über den Zählerüberlauf hinweg', () => {
    // 2 Umdrehungen in 1,333 s = 90 rpm; die Zeit läuft dabei über 65535.
    expect(
      cadenceFrom({ revs: 65535, time: 65000 }, { revs: 1, time: (65000 + 1365) & 0xffff }),
    ).toBeCloseTo(90, 0);
    expect(cadenceFrom({ revs: 10, time: 500 }, { revs: 10, time: 500 })).toBeNull();
  });

  it('liest den Puls mit 8 und 16 Bit', () => {
    const small = new DataView(new ArrayBuffer(2));
    small.setUint8(1, 146);
    const wide = new DataView(new ArrayBuffer(3));
    wide.setUint8(0, 1);
    wide.setUint16(1, 301, true);
    expect(parseHeartRate(small)).toBe(146);
    expect(parseHeartRate(wide)).toBe(301);
  });
});

describe('Formatierung', () => {
  it('zeigt Zahlen mit Komma und Striche für fehlende Werte', () => {
    expect(num(32.44, 1)).toBe('32,4');
    expect(num(null)).toBe('--');
    expect(num(Number.NaN)).toBe('--');
  });

  it('zeigt Zeiten kurz', () => {
    expect(fmtTime(7000)).toBe('0:07');
    expect(fmtTime(754000)).toBe('12:34');
    expect(fmtTime(5025000)).toBe('1:23:45');
  });

  it('formatiert Entfernungen für Anzeige und Sprache', () => {
    expect(fmtDistance(347)).toBe('350 m');
    expect(fmtDistance(4230)).toBe('4,2 km');
    expect(speakDistance(180)).toBe('200 Metern');
    expect(speakDistance(1020)).toBe('einem Kilometer');
    expect(speakDistance(4230, false)).toBe('4,2 Kilometer');
    expect(speakDuration(270)).toBe('4 Minuten 30 Sekunden');
    expect(speakDuration(3600)).toBe('1 Stunde');
  });
});

describe('Geometrie', () => {
  it('misst Strecke und Richtung', () => {
    expect(haversine(51, 7, 51.001, 7)).toBeCloseTo(111.2, 0);
    expect(bearing(51, 7, 51.001, 7)).toBeCloseTo(0, 1);
    expect(bearing(51, 7, 51, 7.001)).toBeCloseTo(90, 1);
    expect(angleDiff(350, 80)).toBe(90);
    expect(angleDiff(80, 350)).toBe(-90);
  });
});

describe('TCX-Export', () => {
  const stats: RideStats = {
    startedAt: 0,
    movingMs: 4000,
    distanceM: 40,
    ascentM: 0,
    pwrSum: 0,
    pwrN: 0,
    pwrMax: 0,
  };
  const track: TrackPoint[] = [
    [1000, 51, 7, 100, 0, 140, 88, 200],
    [2000, 51.0001, 7, 100, 10, 141, 89, 210],
    [3000, null, null, null, 20, null, null, null],
    [4000, 51.0003, 7, 101, 30, 143, 90, 250],
  ];
  const laps: Lap[] = [
    { trackIdx: 0, t0: 0, d0: 0, pwrSum: 0, pwrN: 0, label: 'Einfahren' },
    { trackIdx: 2, t0: 2000, d0: 20, pwrSum: 0, pwrN: 0, label: 'Belastung <1>' },
  ];

  it('schreibt wohlgeformtes XML mit einer Runde je Runde', () => {
    const doc = new DOMParser().parseFromString(buildTcx(track, laps, stats)!, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(doc.getElementsByTagName('Lap').length).toBe(2);
    expect(doc.getElementsByTagName('Trackpoint').length).toBe(4);
    expect(doc.getElementsByTagName('Position').length).toBe(3); // ein Punkt ohne GPS
    expect(doc.getElementsByTagName('Notes')[1].textContent).toBe('Belastung <1>');
  });

  it('liefert ohne Aufzeichnung nichts', () => {
    expect(buildTcx([], laps, stats)).toBeNull();
  });
});

describe('Wind', () => {
  it('zerlegt den Wind in Gegen- und Rückenwind', () => {
    // Nach Norden fahren, Wind aus Norden: voll von vorn.
    const head = relativeWind(0, 20, 0);
    expect(head.kind).toBe('head');
    expect(head.head).toBeCloseTo(20);
    expect(head.cross).toBeCloseTo(0);
    // Dieselbe Strecke zurück: voll von hinten.
    const tail = relativeWind(0, 20, 180);
    expect(tail.kind).toBe('tail');
    expect(tail.head).toBeCloseTo(-20);
  });

  it('rechnet über die Nordrichtung hinweg', () => {
    // Kurs 350°, Wind aus 10°: 20° von rechts vorn.
    const r = relativeWind(10, 20, 350);
    expect(r.kind).toBe('head');
    expect(r.fromDeg).toBeCloseTo(20);
    expect(r.cross).toBeGreaterThan(0);
  });

  it('nennt Wind von der Seite Seitenwind, mit der richtigen Seite', () => {
    const right = relativeWind(90, 20, 0);
    expect(right.kind).toBe('cross');
    expect(right.cross).toBeCloseTo(20);
    expect(relativeWind(270, 20, 0).cross).toBeCloseTo(-20);
    // 60° von vorn spürt man noch als Gegenwind.
    expect(relativeWind(60, 20, 0).kind).toBe('head');
  });

  it('zählt Windstille nicht als Gegen- oder Rückenwind', () => {
    expect(relativeWind(0, 0.5, 0).kind).toBe('cross');
  });

  it('benennt Himmelsrichtung und Stärke', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(225)).toBe('SW');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
    expect(windWord(3)).toBe('still');
    expect(windWord(18)).toBe('mäßig');
    expect(windWord(45)).toBe('stürmisch');
  });
});
