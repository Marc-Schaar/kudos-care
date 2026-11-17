import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { angleDiff } from './geo';
import { Gps } from './gps';

/**
 * Ab dieser Geschwindigkeit (m/s, rund 7 km/h) gilt der GPS-Kurs, darunter der Kompass.
 * In Fahrt ist der GPS-Kurs verlässlicher: Lenker und Rahmen aus Stahl oder Alu, Akkus von
 * E-Bikes und der Magnet am Speichensensor lenken den Kompass ab. Im Stand gibt es dagegen
 * gar keinen Kurs, weil sich die Position nicht ändert.
 */
const GPS_COURSE_MIN = 2;
/** Glättung je Messung: der Kompass zittert, die Karte soll ruhig drehen. */
const SMOOTH = 0.2;
/** Unter einem Grad keine neue Zeichnung. */
const MIN_STEP_DEG = 1;

export type CompassState = 'off' | 'on' | 'denied' | 'unsupported';

interface CompassEvent extends DeviceOrientationEvent {
  /** iOS: Kurs der Geräteoberkante, 0 = Norden, im Uhrzeigersinn */
  webkitCompassHeading?: number;
}

interface PermissionedOrientation {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Kompassrichtung des Telefons aus einer Orientierungsmessung, 0 = Norden, im Uhrzeigersinn.
 * `screenAngle` ist die Drehung des Bildschirms (quer = 90/270): Gemessen wird zur Oberkante
 * des Geräts, angezeigt in Richtung der Bildschirmoberkante.
 */
export function compassHeading(
  event: { webkitCompassHeading?: number; alpha: number | null; absolute?: boolean },
  absoluteEvent: boolean,
  screenAngle: number,
): number | null {
  let raw: number | null = null;
  if (typeof event.webkitCompassHeading === 'number' && event.webkitCompassHeading >= 0) {
    raw = event.webkitCompassHeading;
  } else if ((absoluteEvent || event.absolute) && event.alpha != null) {
    // W3C: alpha wächst gegen den Uhrzeigersinn.
    raw = 360 - event.alpha;
  }
  if (raw == null || !Number.isFinite(raw)) return null;
  return (((raw + screenAngle) % 360) + 360) % 360;
}

/**
 * Fahrtrichtung für Karte und Wind: in Fahrt der GPS-Kurs, im Stand der Kompass des
 * Telefons. Vorher drehte sich die Karte nur in Bewegung; an der Ampel blieb sie auf dem
 * letzten Kurs stehen, und wer das Rad gewendet hatte, sah die Karte falsch herum.
 */
@Injectable({ providedIn: 'root' })
export class Heading {
  private readonly gps = inject(Gps);
  private readonly win = inject(DOCUMENT).defaultView;
  private listening = false;

  readonly compass = signal<number | null>(null);
  readonly compassState = signal<CompassState>('off');

  readonly value = computed<number | null>(() => {
    const course = this.gps.heading();
    const compass = this.compass();
    const speed = this.gps.speed();
    if (compass != null && (speed == null || speed < GPS_COURSE_MIN)) return compass;
    return course ?? compass;
  });

  constructor() {
    // Ohne Nachfrage (Android, Desktop) läuft der Kompass sofort. Auf dem iPhone kommen
    // Messungen erst nach `enable()` aus einem Tipp, oder wenn die Erlaubnis schon besteht.
    this.listen();
  }

  /**
   * Aus einem Tipp heraus aufrufen (Kompassknopf, Start): iOS fragt nur dann nach der
   * Erlaubnis für Bewegung und Ausrichtung.
   */
  enable(): void {
    if (this.compassState() === 'on' || !this.win) return;
    const ctor = (this.win as unknown as { DeviceOrientationEvent?: PermissionedOrientation })
      .DeviceOrientationEvent;
    if (!ctor) {
      this.compassState.set('unsupported');
      return;
    }
    if (typeof ctor.requestPermission !== 'function') {
      this.expectReadings();
      return;
    }
    ctor
      .requestPermission()
      .then((result) => {
        if (result !== 'granted') this.compassState.set('denied');
        else this.expectReadings();
      })
      .catch(() => this.compassState.set('denied'));
  }

  /** Kommt trotz Erlaubnis nichts (Desktop, Gerät ohne Magnetometer), gibt es keinen Kompass. */
  private expectReadings(): void {
    setTimeout(() => {
      if (this.compassState() === 'off') this.compassState.set('unsupported');
    }, 2000);
  }

  private listen(): void {
    const win = this.win;
    if (this.listening || !win) return;
    if (!('DeviceOrientationEvent' in win)) {
      this.compassState.set('unsupported');
      return;
    }
    this.listening = true;
    // Chrome liefert die Nordrichtung nur im „absolute“-Ereignis.
    const absolute = 'ondeviceorientationabsolute' in win;
    win.addEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', (e) =>
      this.onOrientation(e as CompassEvent, absolute),
    );
  }

  private screenAngle(): number {
    const win = this.win as (Window & { orientation?: number }) | null;
    return win?.screen?.orientation?.angle ?? win?.orientation ?? 0;
  }

  private onOrientation(event: CompassEvent, absolute: boolean): void {
    const raw = compassHeading(event, absolute, this.screenAngle());
    if (raw == null) return;
    this.compassState.set('on');
    const prev = this.compass();
    if (prev == null) {
      this.compass.set(raw);
      return;
    }
    const next = (prev + SMOOTH * angleDiff(prev, raw) + 360) % 360;
    if (Math.abs(angleDiff(prev, next)) >= MIN_STEP_DEG) this.compass.set(next);
  }
}
