import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEGAL_CONTACT } from '../legal-contact';
import { Imprint } from './imprint/imprint';
import { Privacy } from './privacy/privacy';

describe('Rechtstexte', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const render = (component: typeof Imprint | typeof Privacy): string => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('nennt im Impressum Anschrift und Kontakt aus einer Quelle', () => {
    const text = render(Imprint);
    expect(text).toContain(LEGAL_CONTACT.name);
    expect(text).toContain(LEGAL_CONTACT.street);
    expect(text).toContain(LEGAL_CONTACT.postalCity);
    expect(text).toContain(LEGAL_CONTACT.email);
  });

  // Die Liste spiegelt die externen Aufrufe in Frontend und Backend.
  it.each(['Strava', 'Brevo', 'Open-Meteo', 'OpenFreeMap', 'Google Gemini', 'Groq'])(
    'nennt in der Datenschutzerklärung %s',
    (service) => {
      expect(render(Privacy)).toContain(service);
    },
  );
});
