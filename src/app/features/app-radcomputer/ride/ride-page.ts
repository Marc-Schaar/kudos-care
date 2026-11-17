import { Component, computed, inject } from '@angular/core';

import { RideDisplayState } from '../core/models';
import { RideRecorder } from '../core/ride-recorder';
import { RidePageKey, RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { MapView } from '../nav/map-view';
import { WorkoutLive } from '../workout/workout-live';
import { WorkoutPlayer } from '../workout/workout-player';
import { WindTile } from '../wind/wind-tile';
import { BellButton } from './bell-button';
import { DataField } from './data-field';
import { FieldDef, FieldSize, RideFields, effectivePages, fieldDef, pageLayout } from './fields';

interface PageField {
  def: FieldDef;
  size: FieldSize;
}

interface RidePageDef {
  key: RidePageKey;
  name: string;
  /** Nur Datenseiten haben Felder; Karte und Training sind eigene Ansichten. */
  fields?: PageField[];
  rows?: string;
}

const STATE_TEXT: Record<RideDisplayState, string> = {
  idle: 'Bereit',
  running: 'Aufnahme läuft',
  auto: 'Auto-Pause',
  paused: 'Pausiert',
};

@Component({
  selector: 'rc-ride-page',
  imports: [DataField, MapView, WorkoutLive, WindTile, BellButton],
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
          <section
            class="grid"
            [style.grid-template-rows]="current.rows"
            [attr.aria-label]="'Datenseite ' + current.name"
          >
            @for (field of current.fields; track $index) {
              <div class="cell" [class.full]="field.size !== 'normal'">
                @switch (field.def.kind) {
                  @case ('wind') {
                    <rc-wind-tile />
                  }
                  @case ('bell') {
                    <rc-bell variant="tile" />
                  }
                  @default {
                    @let r = readings()[field.def.key];
                    <rc-data-field
                      [label]="r?.label ?? field.def.label"
                      [unit]="r?.unit ?? field.def.unit ?? ''"
                      [value]="r?.value ?? '--'"
                      [size]="field.size"
                    />
                  }
                }
              </div>
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
  protected readonly view = inject(RideView);
  private readonly settings = inject(SettingsStore);
  private readonly player = inject(WorkoutPlayer);
  private readonly fields = inject(RideFields);
  private touch: { x: number; y: number } | null = null;

  protected readonly readings = this.fields.readings;

  /**
   * Eigene Datenseiten aus den Einstellungen, dahinter Karte und – solange ein Training
   * geladen ist – die Trainingsseite. Die Datenseiten heißen intern `data`, `data-1` …
   */
  protected readonly pages = computed<RidePageDef[]>(() => {
    const data = effectivePages(this.settings.value().dataPages).map((page, i) => {
      const defs = page.fields.map(fieldDef).filter((d): d is FieldDef => d != null);
      const layout = pageLayout(defs.length);
      return {
        key: (i === 0 ? 'data' : `data-${i}`) as RidePageKey,
        name: page.name,
        fields: defs.map((def, j) => ({ def, size: layout.sizes[j] })),
        rows: layout.rows,
      };
    });
    const extra: RidePageDef[] = [{ key: 'map', name: 'Karte' }];
    if (this.player.workout() != null) extra.push({ key: 'workout', name: 'Training' });
    return [...data, ...extra];
  });
  protected readonly page = computed(
    () => this.pages().find((p) => p.key === this.view.page()) ?? this.pages()[0],
  );
  protected readonly stateText = computed(() => {
    const state = this.ride.displayState();
    const hidden = !this.settings.value().showControls && !this.view.revealed();
    return state === 'idle' && hidden ? 'Bereit – tippen für Start' : STATE_TEXT[state];
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
