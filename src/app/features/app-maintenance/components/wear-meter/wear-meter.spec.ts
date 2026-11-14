import { formatTimes } from './wear-meter';

describe('formatTimes', () => {
  it('rundet ab, damit knapp unter 2 nicht als 2× erscheint', () => {
    expect(formatTimes(1.96)).toBe('1,9×');
  });

  it('zeigt unter zehn eine Nachkommastelle, ganze Werte ohne', () => {
    expect(formatTimes(3.54)).toBe('3,5×');
    expect(formatTimes(7.08)).toBe('7×');
  });

  it('wird ab zehn ganzzahlig und deckelt bei 99+', () => {
    expect(formatTimes(10.24)).toBe('10×');
    expect(formatTimes(250)).toBe('99+×');
  });
});
