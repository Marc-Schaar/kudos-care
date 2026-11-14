import { Component, computed, inject } from '@angular/core';

import { fmtTime, kmh, num } from '../core/format';
import { Gps } from '../core/gps';
import { RideDisplayState } from '../core/models';
import { RideRecorder } from '../core/ride-recorder';
import { Sensors } from '../core/sensors';
import { Ticker } from '../core/ticker';
import { RidePageKey, RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { MapView } from '../nav/map-view';
import { WorkoutLive } from '../workout/workout-live';
import { WorkoutPlayer } from '../workout/workout-player';
import { DataField } from './data-field';

type FieldKey =
  | 'speed'
  | 'power3s'
  | 'hr'
  | 'cadence'
  | 'distance'
  | 'time'
  | 'avgSpeed'
  | 'avgPower'
  | 'maxPower'
  | 'ascent'
  | 'altitude'
  | 'elapsed'
  | 'lapPower'
  | 'lapTime'
  | 'lapDist'
  | 'lapSpeed';

interface FieldDef {
  key: FieldKey;
  label: string;
  unit?: string;
  size?: 'wide' | 'hero';
}

interface RidePageDef {
  key: RidePageKey;
  name: string;
  /** Nur Datenseiten haben Felder: ein großes, vier kleine, ein breites. */
  fields?: readonly FieldDef[];
}

const PAGES: readonly RidePageDef[] = [
  {
    key: 'data',
    name: 'Fahrt',
    fields: [
      { key: 'speed', label: 'Geschwindigkeit', unit: 'km/h', size: 'hero' },
      { key: 'power3s', label: 'Leistung 3 s', unit: 'W' },
      { key: 'hr', label: 'Puls', unit: 'bpm' },
      { key: 'cadence', label: 'Kadenz', unit: 'rpm' },
      { key: 'distance', label: 'Distanz', unit: 'km' },
      { key: 'time', label: 'Fahrzeit', size: 'wide' },
    ],
  },
  {
    key: 'avg',
    name: 'Schnitt',
    fields: [
      { key: 'avgSpeed', label: 'Ø Geschwindigkeit', unit: 'km/h', size: 'hero' },
      { key: 'avgPower', label: 'Ø Leistung', unit: 'W' },
      { key: 'maxPower', label: 'Max. Leistung', unit: 'W' },
      { key: 'ascent', label: 'Anstieg', unit: 'm' },
      { key: 'altitude', label: 'Höhe', unit: 'm' },
      { key: 'elapsed', label: 'Gesamtzeit', size: 'wide' },
    ],
  },
  {
    key: 'lap',
    name: 'Runde',
    fields: [
      { key: 'lapPower', label: 'Runde Ø Leistung', unit: 'W', size: 'hero' },
      { key: 'lapTime', label: 'Rundenzeit' },
      { key: 'lapDist', label: 'Rundendistanz', unit: 'km' },
      { key: 'lapSpeed', label: 'Runde Ø', unit: 'km/h' },
      { key: 'hr', label: 'Puls', unit: 'bpm' },
      { key: 'power3s', label: 'Leistung 3 s', unit: 'W', size: 'wide' },
    ],
  },
  { key: 'map', name: 'Karte' },
  { key: 'workout', name: 'Training' },
];

const STATE_TEXT: Record<RideDisplayState, string> = {
  idle: 'Bereit',
  running: 'Aufnahme läuft',
  auto: 'Auto-Pause',
  paused: 'Pausiert',
};

@Component({
  selector: 'rc-ride-page',
  imports: [DataField, MapView, WorkoutLive],
  template: `
    @let current = page();
    <div class="body">
      @switch (current.key) {
        @case ('map') {
          <rc-map-view />
        }
        @case ('workout') {
          <rc-workout-live />
        }
        @default {
          <section class="grid" [attr.aria-label]="'Datenseite ' + current.name">
            @for (field of current.fields; track field.key) {
              <rc-data-field
                [label]="field.label"
                [unit]="field.unit ?? ''"
                [value]="values()[field.key]"
                [size]="field.size ?? 'normal'"
              />
            }
          </section>
        }
      }
    </div>
    <div class="meta">
      <span class="state">{{ stateText() }}</span>
      <nav class="dots" aria-label="Seiten">
        @for (p of pages(); track p.key) {
          <button
            type="button"
            [attr.aria-label]="'Seite ' + ($index + 1) + ': ' + p.name"
            [attr.aria-current]="p.key === current.key ? 'true' : null"
            (click)="view.show(p.key)"
          ></button>
        }
      </nav>
      <span class="lapno">{{ current.name }}</span>
    </div>
  `,
  styleUrl: './ride-page.css',
  host: {
    '(click)': 'onTap($event)',
    '(touchstart)': 'onTouchStart($event)',
    '(touchend)': 'onTouchEnd($event)',
    '(document:keydown)': 'onKey($event)',
  },
})
export class RidePage {
  protected readonly ride = inject(RideRecorder);
  private readonly sensors = inject(Sensors);
  private readonly gps = inject(Gps);
  private readonly ticker = inject(Ticker);
  protected readonly view = inject(RideView);
  private readonly settings = inject(SettingsStore);
  private readonly player = inject(WorkoutPlayer);
  private touch: { x: number; y: number } | null = null;

  /** Die Trainingsseite gibt es nur, solange ein Training geladen ist. */
  protected readonly pages = computed(() =>
    PAGES.filter((p) => p.key !== 'workout' || this.player.workout() != null),
  );
  protected readonly page = computed(
    () => this.pages().find((p) => p.key === this.view.page()) ?? this.pages()[0],
  );
  protected readonly stateText = computed(() => {
    const state = this.ride.displayState();
    const hidden = !this.settings.value().showControls && !this.view.revealed();
    return state === 'idle' && hidden ? 'Bereit – tippen für Start' : STATE_TEXT[state];
  });

  protected readonly values = computed<Record<FieldKey, string>>(() => {
    const stats = this.ride.stats();
    const lap = this.ride.currentLap();
    const speed = this.gps.speed();
    const lapMs = stats.movingMs - lap.t0;
    const lapM = stats.distanceM - lap.d0;
    return {
      speed: num(speed == null ? null : speed * 3.6, 1),
      power3s: num(this.sensors.power3s()),
      hr: num(this.sensors.hr()),
      cadence: num(this.sensors.cadence()),
      distance: num(stats.distanceM / 1000, 2),
      time: fmtTime(stats.movingMs),
      avgSpeed: num(kmh(stats.distanceM, stats.movingMs), 1),
      avgPower: num(stats.pwrN ? stats.pwrSum / stats.pwrN : null),
      maxPower: num(stats.pwrN ? stats.pwrMax : null),
      ascent: num(stats.ascentM),
      altitude: num(this.gps.position()?.alt),
      elapsed: fmtTime(stats.startedAt ? this.ticker.now() - stats.startedAt : 0),
      lapPower: num(lap.pwrN ? lap.pwrSum / lap.pwrN : null),
      lapTime: fmtTime(lapMs),
      lapDist: num(lapM / 1000, 2),
      lapSpeed: num(kmh(lapM, lapMs), 1),
    };
  });

  private step(delta: number): void {
    const pages = this.pages();
    const index = pages.findIndex((p) => p.key === this.page().key);
    this.view.show(pages[(index + delta + pages.length) % pages.length].key);
  }

  /**
   * Ist die Bedienleiste ausgeblendet, holt ein Tipp sie für ein paar Sekunden zurück, ein
   * zweiter blendet sie sofort wieder aus. Tasten auf der Seite (Seitenstriche, Kartenzoom)
   * schalten die Leiste nicht mit, sonst verschwände sie beim Blättern.
   */
  protected onTap(event: MouseEvent): void {
    if (this.settings.value().showControls) return;
    if ((event.target as Element | null)?.closest('button, a, input, select')) return;
    this.view.toggle();
  }

  protected onTouchStart(event: TouchEvent): void {
    const t = event.touches[0];
    this.touch = { x: t.clientX, y: t.clientY };
  }

  /** Waagerecht wischen blättert. */
  protected onTouchEnd(event: TouchEvent): void {
    if (!this.touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - this.touch.x;
    const dy = t.clientY - this.touch.y;
    this.touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) this.step(dx < 0 ? 1 : -1);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.step(1);
    if (event.key === 'ArrowLeft') this.step(-1);
  }
}
