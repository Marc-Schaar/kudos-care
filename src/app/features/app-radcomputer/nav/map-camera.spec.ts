import {
  MAX_ZOOM,
  MIN_ZOOM,
  MapCamera,
  ScreenPoint,
  SpeedZoom,
  cameraAt,
  fitCamera,
  panCamera,
  pinchCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomForSpeed,
} from './map-camera';

const view = { w: 375, h: 500 };

function expectNear(a: ScreenPoint, b: ScreenPoint, digits = 6): void {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
}

/** Wo landet der Weltpunkt, der in `before` unter `p` lag, mit der Kamera `after`? */
function follow(before: MapCamera, after: MapCamera, p: ScreenPoint): ScreenPoint {
  const world = screenToWorld(before, view, p);
  return worldToScreen(after, view, world.x, world.y);
}

describe('Kartenkamera', () => {
  const cam = cameraAt(51, 7, 16, 35, 0.66);

  it('rechnet Bildschirm und Welt verlustfrei hin und zurück, auch gedreht', () => {
    for (const p of [
      { x: 0, y: 0 },
      { x: 300, y: 120 },
      { x: 187.5, y: 330 },
    ]) {
      const w = screenToWorld(cam, view, p);
      expectNear(worldToScreen(cam, view, w.x, w.y), p);
    }
  });

  it('legt die Mitte auf die Ankerhöhe', () => {
    expectNear(worldToScreen(cam, view, cam.x, cam.y), { x: view.w / 2, y: view.h * 0.66 });
  });

  it('dreht so, dass der Kurs oben liegt', () => {
    // Nach Osten schauen: ein Punkt östlich der Mitte liegt darüber, nicht rechts daneben.
    const east = cameraAt(51, 7, 16, 90);
    const p = worldToScreen(east, view, east.x + 1e-5, east.y);
    expect(p.x).toBeCloseTo(view.w / 2, 3);
    expect(p.y).toBeLessThan(view.h / 2);
  });

  it('verschiebt mit einem Finger: was unter dem Finger lag, bleibt darunter', () => {
    const from = { x: 100, y: 300 };
    const to = { x: 160, y: 180 };
    const moved = panCamera(cam, view, from, to);
    expectNear(follow(cam, moved, from), to);
    expect(moved.zoom).toBe(cam.zoom);
    expect(moved.bearing).toBe(cam.bearing);
  });

  it('zoomt mit zwei Fingern um ihren Mittelpunkt', () => {
    const from: [ScreenPoint, ScreenPoint] = [
      { x: 150, y: 250 },
      { x: 250, y: 250 },
    ];
    const to: [ScreenPoint, ScreenPoint] = [
      { x: 100, y: 250 },
      { x: 300, y: 250 },
    ];
    const pinched = pinchCamera(cam, view, from, to, false);
    expect(pinched.zoom).toBeCloseTo(cam.zoom + 1, 6);
    expectNear(follow(cam, pinched, { x: 200, y: 250 }), { x: 200, y: 250 });
  });

  it('dreht nur, wenn Drehen freigegeben ist', () => {
    // Finger um 90 Grad im Uhrzeigersinn verdreht, Abstand gleich.
    const from: [ScreenPoint, ScreenPoint] = [
      { x: 150, y: 250 },
      { x: 250, y: 250 },
    ];
    const to: [ScreenPoint, ScreenPoint] = [
      { x: 200, y: 200 },
      { x: 200, y: 300 },
    ];
    expect(pinchCamera(cam, view, from, to, false).bearing).toBe(cam.bearing);
    const turned = pinchCamera(cam, view, from, to, true);
    expect(turned.bearing).toBeCloseTo((cam.bearing - 90 + 360) % 360, 6);
    expect(turned.zoom).toBeCloseTo(cam.zoom, 6);
    // Der Punkt unter dem zweiten Finger wandert mit dem Finger.
    expectNear(follow(cam, turned, from[1]), to[1]);
  });

  it('hält den Zoom in den Grenzen', () => {
    const far: [ScreenPoint, ScreenPoint] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const wide: [ScreenPoint, ScreenPoint] = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ];
    expect(pinchCamera(cam, view, far, wide, false).zoom).toBe(MAX_ZOOM);
    expect(pinchCamera(cam, view, wide, far, false).zoom).toBe(MIN_ZOOM);
    expect(zoomAt(cam, view, { x: 10, y: 10 }, -40).zoom).toBe(MIN_ZOOM);
  });

  it('zoomt mit dem Mausrad um den Zeiger', () => {
    const p = { x: 50, y: 400 };
    const zoomed = zoomAt(cam, view, p, 0.5);
    expect(zoomed.zoom).toBeCloseTo(16.5, 6);
    expectNear(follow(cam, zoomed, p), p);
  });
});

describe('Routenübersicht', () => {
  const a = cameraAt(51.0, 7.0, 0);
  const b = cameraAt(51.3, 7.4, 0);
  const bounds = {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  };

  it('zeigt die ganze Strecke mit Rand, Norden oben', () => {
    const cam = fitCamera(bounds, view, 32);
    expect(cam.bearing).toBe(0);
    expect(cam.anchorY).toBe(0.5);
    for (const corner of [
      [bounds.minX, bounds.minY],
      [bounds.maxX, bounds.maxY],
    ]) {
      const p = worldToScreen(cam, view, corner[0], corner[1]);
      expect(p.x).toBeGreaterThanOrEqual(32 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(view.w - 32 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(32 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(view.h - 32 + 1e-6);
    }
  });

  it('füllt die knappere Richtung aus, statt zu klein zu zeigen', () => {
    const cam = fitCamera(bounds, view, 32);
    const left = worldToScreen(cam, view, bounds.minX, cam.y);
    const top = worldToScreen(cam, view, cam.x, bounds.minY);
    // Mindestens eine Seite liegt genau am Rand.
    expect(Math.min(Math.abs(left.x - 32), Math.abs(top.y - 32))).toBeLessThan(1e-6);
  });

  it('geht bei kurzen Strecken und einzelnen Punkten nicht näher als Stufe 17', () => {
    const point = { minX: a.x, maxX: a.x, minY: a.y, maxY: a.y };
    expect(fitCamera(point, view).zoom).toBe(17);
    const tiny = { ...point, maxX: a.x + 1e-7 };
    expect(fitCamera(tiny, view).zoom).toBe(17);
  });
});

describe('Zoom nach Tempo', () => {
  it('bleibt bis 12 km/h nah dran und zoomt darüber stetig heraus', () => {
    expect(zoomForSpeed(0)).toBe(17);
    expect(zoomForSpeed(12)).toBe(17);
    expect(zoomForSpeed(16)).toBeCloseTo(16.75, 6);
    expect(zoomForSpeed(30)).toBe(15.75);
    expect(zoomForSpeed(45)).toBe(15);
    expect(zoomForSpeed(70)).toBe(15);
    expect(zoomForSpeed(-3)).toBe(17);
    expect(zoomForSpeed(Number.NaN)).toBe(17);
    let last = Infinity;
    for (let v = 0; v <= 60; v += 0.5) {
      const z = zoomForSpeed(v);
      expect(z).toBeLessThanOrEqual(last);
      last = z;
    }
  });

  it('springt bei einem kurzen Antritt nicht sofort heraus', () => {
    const zoom = new SpeedZoom();
    let t = 0;
    expect(zoom.update(0, t)).toBe(17);
    // Zwei Sekunden 40 km/h: geglättet noch Stadttempo.
    for (let i = 0; i < 2; i++) zoom.update(40 / 3.6, (t += 1000));
    expect(zoom.update(40 / 3.6, (t += 1000))).toBeGreaterThanOrEqual(16.5);
  });

  it('kommt bei gleichbleibendem Tempo auf dessen Zoom, in Viertelstufen', () => {
    const zoom = new SpeedZoom();
    let t = 0;
    zoom.update(0, t);
    let z = 0;
    for (let i = 0; i < 120; i++) z = zoom.update(30 / 3.6, (t += 1000));
    expect(z).toBe(15.75);
    expect((z * 4) % 1).toBe(0);
  });

  it('pendelt nicht, wenn das Tempo um eine Rundungsgrenze schwankt', () => {
    // 28,3 km/h ergibt 15,875: genau zwischen den Stufen 15,75 und 16.
    const zoom = new SpeedZoom();
    let t = 0;
    for (let i = 0; i < 120; i++) zoom.update(28.33 / 3.6, (t += 1000));
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(zoom.update((i % 2 ? 27.3 : 29.3) / 3.6, (t += 1000)));
    expect(seen.size).toBe(1);
  });

  it('übernimmt beim ersten Wert dessen Zoom direkt', () => {
    expect(new SpeedZoom().update(45 / 3.6, 0)).toBe(15);
  });

  it('wertet eine fehlende Position als Stillstand', () => {
    const zoom = new SpeedZoom();
    let t = 0;
    zoom.update(30 / 3.6, t);
    let z = 0;
    for (let i = 0; i < 120; i++) z = zoom.update(null, (t += 1000));
    expect(z).toBe(17);
  });
});
