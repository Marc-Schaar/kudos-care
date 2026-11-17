import { decodePolyline, routeOutline } from './route-outline';

describe('Routenumriss', () => {
  it('liest die Beispiel-Polyline aus Googles Dokumentation', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('hört bei einer abgeschnittenen Zeichenkette auf, statt Unsinn zu liefern', () => {
    expect(decodePolyline('_p~iF~ps|U_ul')).toEqual([[38.5, -120.2]]);
  });

  it('passt die Strecke seitentreu in den Kasten und beginnt am Start', () => {
    const outline = routeOutline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 56, 44);
    expect(outline).not.toBeNull();
    const nums = outline!.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let n = 0; n < nums.length; n += 2) {
      expect(nums[n]).toBeGreaterThanOrEqual(3.9);
      expect(nums[n]).toBeLessThanOrEqual(52.1);
      expect(nums[n + 1]).toBeGreaterThanOrEqual(3.9);
      expect(nums[n + 1]).toBeLessThanOrEqual(40.1);
    }
    expect(outline!.d.startsWith(`M${outline!.start.x} ${outline!.start.y}`)).toBe(true);
  });

  it('liefert ohne Strecke keinen Umriss', () => {
    expect(routeOutline('', 56, 44)).toBeNull();
    expect(routeOutline('_p~iF~ps|U', 56, 44)).toBeNull();
  });
});
