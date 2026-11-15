import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { lifeInRides, WearImpact } from './wear-impact';
import { WearImpactBreakdown } from '../../models/wear-impact';

const breakdown: WearImpactBreakdown = {
  distance_km: 48.2,
  conditions: { precipitation: 1.2, temperature: 9, wind_speed: 14 },
  total_extra_km: 30,
  component_count: 3,
  categories: [
    {
      category: 'brakes',
      category_display: 'Bremsen',
      multiplier: 1.31,
      extra_pct: 31,
      extra_km: 14.9,
      dominant_driver: 'rain',
      dominant_driver_display: 'Regen',
      components: [
        {
          id: 1,
          name: 'Bremsbeläge vorne',
          brand: '',
          model_name: '',
          effective_km: 63.1,
          extra_km: 14.9,
          warn_km: 3000,
          share_of_life_pct: 2.1,
        },
      ],
    },
    {
      category: 'frame',
      category_display: 'Rahmen & Lager',
      multiplier: 1,
      extra_pct: 0,
      extra_km: 0,
      dominant_driver: null,
      dominant_driver_display: null,
      components: [
        {
          id: 2,
          name: 'Steuersatz',
          brand: '',
          model_name: '',
          effective_km: 48.2,
          extra_km: 0,
          warn_km: null,
          share_of_life_pct: null,
        },
      ],
    },
  ],
};

// Wie in app.config.ts: ohne deutsches Locale schriebe DecimalPipe „63.1".
registerLocaleData(localeDe);

describe('WearImpact', () => {
  let fixture: ComponentFixture<WearImpact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WearImpact],
      providers: [{ provide: LOCALE_ID, useValue: 'de' }],
    }).compileComponents();
    fixture = TestBed.createComponent(WearImpact);
    fixture.componentRef.setInput('breakdown', breakdown);
    await fixture.whenStable();
  });

  it('nennt im Satz den teuersten Bereich, nicht die Summe über alle Teile', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('63,1');
    expect(text).toContain('Bremsen: +31 % durch Regen');
  });

  it('setzt „gefahren" für alle Bereiche an dieselbe Stelle', () => {
    expect(fixture.componentInstance.baseWidth()).toBeCloseTo(100 / 1.31);
  });

  it('zeichnet ohne Aufschlag keinen Überstand', () => {
    const row = fixture.componentInstance.rows().find((r) => r.key === 'frame')!;
    expect(row.extraWidth).toBe(0);
  });
});

describe('lifeInRides', () => {
  it('dreht den Anteil an der Lebensdauer in Fahrten um', () => {
    expect(lifeInRides(2.5)).toBe('hält etwa 40 Fahrten wie diese');
  });

  it('rundet große Zahlen auf Fünfer, kleine nicht', () => {
    expect(lifeInRides(2.1)).toBe('hält etwa 50 Fahrten wie diese');
    expect(lifeInRides(12)).toBe('hält etwa 8 Fahrten wie diese');
  });

  it('deckelt sehr kleine und sehr große Anteile', () => {
    expect(lifeInRides(0.05)).toBe('hält über 1.000 Fahrten wie diese');
    expect(lifeInRides(120)).toBe('diese Fahrt allein war länger als seine Lebensdauer');
  });
});
