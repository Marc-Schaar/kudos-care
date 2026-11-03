import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Landingpage } from './landingpage';

/**
 * Prüft nur, was die Seite behauptet: die Zahlen in den Sätzen kommen aus der Formel, und das
 * eingestellte Wetter landet im Abschluss. Die Bühne selbst braucht Layout und Canvas, das gibt
 * es in jsdom nicht; deshalb läuft hier bewusst kein `detectChanges()`.
 */
describe('Landingpage', () => {
  let page: Landingpage;

  const slide = (key: 'precipitation' | 'temperature' | 'windSpeed', value: number): void => {
    page.setWeather(key, { target: { value: String(value) } } as unknown as Event);
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    page = TestBed.createComponent(Landingpage).componentInstance;
  });

  it('nennt im Urteil die Zahlen, die die Beispielsaison wirklich ergibt', () => {
    expect(page.wearAtEnd).toBe('2.010');
    expect(page.kmAtEnd).toBe('1.540');
    expect(page.kmLeft).toBe('460');
  });

  it('zeigt am Ende der Saison nur die Kette als überfällig', () => {
    const critical = page.parts.filter((part) => part.status === 'critical');
    expect(critical.map((part) => part.id)).toEqual(['chain']);
  });

  it('nennt ohne Eingabe den voreingestellten Regen', () => {
    expect(page.closingLine()).toBe('Bei 4,0 mm/h Regen zählen 100 km für die Kette wie 200 km.');
  });

  it('übernimmt das eingestellte Wetter in den Abschluss', () => {
    slide('precipitation', 1);
    expect(page.closingLine()).toBe('Bei deinem Wetter zählen 100 km für die Kette wie 136 km.');
  });

  it('sagt bei neutralem Wetter, dass jeder Kilometer einmal zählt', () => {
    slide('precipitation', 0);
    slide('temperature', 18);
    slide('windSpeed', 10);
    expect(page.closingLine()).toBe('Bei deinem Wetter zählt jeder Kilometer einmal.');
    expect(page.multipliers().every((row) => row.factor === '×1,0' && row.driver === '')).toBe(
      true,
    );
  });

  it('nennt je Baugruppe den stärksten Treiber', () => {
    slide('precipitation', 0);
    slide('temperature', 38);
    const wheels = page.multipliers().find((row) => row.label === 'Laufräder');
    expect(wheels).toEqual({ label: 'Laufräder', driver: 'Hitze', factor: '×1,6' });
  });
});
