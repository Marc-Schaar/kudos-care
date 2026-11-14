import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalLinks } from '../../../../shared/components/legal-links/legal-links';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import {
  DRY_KM,
  SAMPLE_RIDES,
  SEASON_KM,
  TRACKED_PARTS,
  seasonAt,
} from '../../models/sample-season';
import {
  Weather,
  WeatherDriver,
  WearCategory,
  rideMultiplier,
  warnStatus,
} from '../../models/wear-formula';
import { CHAIN_PITCH, GEAR_RATIO, GROUND_Y, RING_R, VIEW_H } from '../landing-scene/bike-geometry';
import { LandingScene } from '../landing-scene/landing-scene';
import { RainLayer } from './rain-layer';

/** Bühnenzeit in Viewport-Höhen. Die Scroll-Strecke der Bühne ist genau `END`. */
const ROLL_START = 0.25;
const DRY_END = 1.9;
const RAIN_START = 2.5;
const RAIN_END = 5.5;
const CONTROL_START = 6.3;
const COMPARE_START = 7.7;
const COMPARE_END = 9.0;
const COLLAPSE_END = 10.2;
const END = 10.5;
/** Ab hier ist die Kette neu: erst wenn das Papier weg ist und ihr Wert kurz zu lesen war. */
const CHAIN_NEW_AT = COLLAPSE_END - 0.15;
/** Am Telefon bleibt die letzte Zeile stehen, bis das Papier fast weg ist und der Abschluss kommt. */
const STACKED_LAST_ROW_END = 9.85;

/** Radumdrehungen je Bühnenzeit, auf Sicht abgestimmt, nicht auf die echten Kilometer. */
const WHEEL_DEG_PER_T = 1500;

/** Ab hier gilt in der Hälfte das eingestellte Wetter statt der laufenden Beispielfahrt. */
const CONTROL_WEATHER_FROM = 5.9;

const CATEGORY_LABELS: readonly { label: string; category: WearCategory }[] = [
  { label: 'Antrieb', category: 'drivetrain' },
  { label: 'Federung', category: 'suspension' },
  { label: 'Bremsen', category: 'brakes' },
  { label: 'Laufräder', category: 'wheels' },
  { label: 'Cockpit', category: 'cockpit' },
];

const DRIVER_LABELS: Record<WeatherDriver, string> = {
  rain: 'Regen',
  heat: 'Hitze',
  cold: 'Kälte',
  wind: 'Wind',
};

/** Dieselben Wörter wie `WarnLabelPipe` in der App. */
const STATUS_LABELS = { ok: 'In Ordnung', warn: 'Bald fällig', critical: 'Überfällig' } as const;
const STATUS_COLORS = { ok: '#c8f060', warn: '#f59e0b', critical: '#f43f5e' } as const;

/** Wechselt in `landingpage.css` an derselben Breite die Aufteilung von Spalten auf Stapel. */
const STACKED_QUERY = '(max-width: 760px)';

const de = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const de1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface Cue {
  el: HTMLElement;
  from: number;
  to: number | null;
  rampIn: number;
  rampOut: number;
  last: number;
}

interface Key {
  t: number;
  value: number;
}

/** Kamera-Stützpunkt: Punkt (u, v) der Zeichnung landet bei (x, y) der Bühne, Maßstab s. */
interface Shot {
  t: number;
  s: number;
  u: number;
  v: number;
  x: number;
  y: number;
}

interface ResolvedShot {
  t: number;
  s: number;
  tx: number;
  ty: number;
}

const GROUND_V = GROUND_Y / VIEW_H;

const SHOTS_SPLIT: readonly Shot[] = [
  { t: 0, s: 1, u: 0.51, v: GROUND_V, x: 0.5, y: 0.91 },
  { t: DRY_END, s: 1.08, u: 0.51, v: GROUND_V, x: 0.5, y: 0.91 },
  { t: RAIN_START, s: 1.45, u: 0.37, v: 0.68, x: 0.34, y: 0.64 },
  { t: 3.6, s: 2.05, u: 0.33, v: 0.68, x: 0.3, y: 0.68 },
  { t: 6.05, s: 2.05, u: 0.33, v: 0.68, x: 0.3, y: 0.68 },
  { t: 6.8, s: 1.3, u: 0.45, v: 0.7, x: 0.42, y: 0.74 },
  { t: COMPARE_END, s: 1.3, u: 0.45, v: 0.7, x: 0.42, y: 0.74 },
  { t: COLLAPSE_END, s: 1.02, u: 0.5, v: GROUND_V, x: 0.655, y: 0.91 },
];

const SHOTS_STACKED: readonly Shot[] = [
  { t: 0, s: 1, u: 0.5, v: GROUND_V, x: 0.5, y: 0.6 },
  { t: DRY_END, s: 1, u: 0.5, v: GROUND_V, x: 0.5, y: 0.6 },
  { t: RAIN_START, s: 1.25, u: 0.42, v: 0.7, x: 0.46, y: 0.47 },
  { t: 3.6, s: 1.75, u: 0.34, v: 0.7, x: 0.52, y: 0.5 },
  { t: 6.05, s: 1.75, u: 0.34, v: 0.7, x: 0.52, y: 0.5 },
  { t: 6.8, s: 1.3, u: 0.45, v: 0.7, x: 0.5, y: 0.6 },
  { t: COMPARE_END, s: 1.3, u: 0.45, v: 0.7, x: 0.5, y: 0.6 },
  { t: COLLAPSE_END, s: 1, u: 0.5, v: GROUND_V, x: 0.5, y: 0.7 },
];

/**
 * Das Rad tritt zurück, bevor die Regler da sind, nicht erst mit der Kamerafahrt: sonst liegen
 * die noch kräftigen Linien für einen Moment unter dem Text.
 */
const DIM_SPLIT: readonly Key[] = [
  { t: 5.9, value: 1 },
  { t: 6.25, value: 0.2 },
  { t: COMPARE_END, value: 0.2 },
  { t: COLLAPSE_END, value: 1 },
];

const DIM_STACKED: readonly Key[] = [
  { t: 5.9, value: 1 },
  { t: 6.25, value: 0.1 },
  { t: COMPARE_END, value: 0.1 },
  { t: COLLAPSE_END, value: 1 },
];

const DIVIDER_SPLIT: readonly Key[] = [
  { t: RAIN_START, value: 0.5 },
  { t: RAIN_END, value: 0.585 },
  { t: COMPARE_START, value: 0.585 },
  { t: COMPARE_END, value: 0.8 },
  { t: COLLAPSE_END - 0.2, value: 1.002 },
];

const DIVIDER_STACKED: readonly Key[] = [
  { t: RAIN_START, value: 0.6 },
  { t: RAIN_END, value: 0.66 },
  { t: CONTROL_START - 0.2, value: 0.66 },
  { t: CONTROL_START + 0.2, value: 0.76 },
  { t: COMPARE_START, value: 0.76 },
  { t: COMPARE_START + 0.15, value: 0.68 },
  { t: COMPARE_END, value: 0.8 },
  { t: COLLAPSE_END - 0.2, value: 1.002 },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smooth(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function sample(keys: readonly Key[], t: number): number {
  if (t <= keys[0].t) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const span = keys[i].t - keys[i - 1].t;
      return (
        keys[i - 1].value + (keys[i].value - keys[i - 1].value) * smooth((t - keys[i - 1].t) / span)
      );
    }
  }
  return keys[keys.length - 1].value;
}

/**
 * Öffentliche Landing-Page. Grammatik "Split Stage": zwei Hälften halten über die ganze Seite
 * dagegen, am Ende wandert die Trennlinie zum Rand und die dunkle Seite gewinnt. Die Gründe
 * dahinter stehen in `scrollcraft/builds/kudos-care/BRIEF.md`.
 *
 * Alle Bewegung hängt an einer Zahl, der Bühnenzeit `t`, und läuft über direkte DOM-Zugriffe in
 * einem rAF-Loop, der nur läuft, solange sich etwas bewegt. Signals gibt es nur für das, was
 * selten wechselt (Regler). Bewusst ohne die Scrollcraft-Engine: sie hat kein Teardown, in einer
 * SPA liefen ihre Listener und ihr rAF-Loop nach dem Routenwechsel weiter.
 */
@Component({
  selector: 'app-landingpage',
  imports: [RouterLink, LandingScene, LegalLinks],
  templateUrl: './landingpage.html',
  styleUrls: ['./landingpage.css', './landingpage.responsive.css', './landingpage.reduced.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landingpage implements AfterViewInit, OnDestroy {
  readonly nav = inject(NavigationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly ctaLabel = 'Mit Strava verbinden';
  readonly rides = SAMPLE_RIDES;
  readonly endOfStage = END;

  private readonly seasonEnd = seasonAt(SEASON_KM);
  private readonly chainWarnKm = TRACKED_PARTS[0].warnKm;

  readonly wearAtEnd = de.format(this.seasonEnd.wear.drivetrain);
  readonly kmAtEnd = de.format(SEASON_KM);
  readonly kmLeft = de.format(this.chainWarnKm - SEASON_KM);

  readonly comparisons = [
    {
      left: 'Eigener Stand für jedes Teil, ab dem Tag des Einbaus.',
      right: 'Eine Zahl fürs ganze Rad.',
    },
    {
      left: 'Zählt auch Tage: Dichtmilch hält 120, Bremsflüssigkeit 730, gefahren oder nicht.',
      right: 'Zählt keine Tage.',
    },
    {
      left: 'Der zweite Laufradsatz im Keller sammelt keine Kilometer.',
      right: 'Kennt keinen Keller.',
    },
    {
      left: 'Meldet sich per E-Mail, wenn ein Teil fällig wird.',
      right: 'Schweigt.',
    },
  ].map((row, i, all) => {
    const start = COMPARE_START + 0.08 + (i * (COMPARE_END - COMPARE_START - 0.2)) / all.length;
    const next =
      COMPARE_START + 0.08 + ((i + 1) * (COMPARE_END - COMPARE_START - 0.2)) / all.length;
    return {
      ...row,
      cue: `${start.toFixed(2)} ${(COMPARE_END + 0.25).toFixed(2)} 0.1 0.08`,
      cueStacked: `${start.toFixed(2)} ${(i === all.length - 1 ? STACKED_LAST_ROW_END : next + 0.05).toFixed(2)} 0.14 0.14`,
    };
  });

  readonly parts = TRACKED_PARTS.map((part) => {
    const ratio = this.seasonEnd.wear[part.category] / part.warnKm;
    return {
      id: part.id,
      name: part.name,
      status: warnStatus(ratio),
      value: `${de.format(ratio * 100)} %`,
    };
  });

  readonly weather = signal<Weather>({ precipitation: 4, temperature: 9, windSpeed: 18 });
  private readonly weatherTouched = signal(false);

  readonly rainLabel = computed(() => `${de1.format(this.weather().precipitation)} mm/h`);
  readonly tempLabel = computed(() => `${this.weather().temperature} °C`);
  readonly windLabel = computed(() => `${this.weather().windSpeed} km/h`);

  readonly multipliers = computed(() =>
    CATEGORY_LABELS.map(({ label, category }) => {
      const { multiplier, driver } = rideMultiplier(this.weather(), category);
      return {
        label,
        driver: driver ? DRIVER_LABELS[driver] : '',
        factor: `×${de1.format(multiplier)}`,
      };
    }),
  );

  /** Das eingestellte Wetter reist bis in den Abschluss mit. */
  readonly closingLine = computed(() => {
    const weather = this.weather();
    const { multiplier } = rideMultiplier(weather, 'drivetrain');
    const lead = this.weatherTouched()
      ? 'Bei deinem Wetter'
      : `Bei ${de1.format(weather.precipitation)} mm/h Regen`;
    if (multiplier <= 1) return `${lead} zählt jeder Kilometer einmal.`;
    return `${lead} zählen 100 km für die Kette wie ${de.format(100 * multiplier)} km.`;
  });

  private stage!: HTMLElement;
  private track!: HTMLElement;
  private rain: RainLayer | null = null;
  private stackedQuery!: MediaQueryList;
  private reduced = false;

  private cues: Cue[] = [];
  private frames: HTMLElement[] = [];
  private wheels: Element[] = [];
  private pulleys: Element[] = [];
  private cranks: Element[] = [];
  private pedals: Element[] = [];
  private chains: Element[] = [];
  private fars: HTMLElement[] = [];
  private roads: HTMLElement[] = [];
  private nears: HTMLElement[] = [];
  private marks: HTMLElement[] = [];
  private ticks: HTMLElement[] = [];
  private partEls: { el: HTMLElement; u: number; v: number }[] = [];
  private divider!: HTMLElement;
  private tint!: HTMLElement;
  private rainCanvas: HTMLCanvasElement | null = null;
  private out: Record<string, HTMLElement> = {};
  private barWear!: HTMLElement;
  private barKm!: HTMLElement;
  private chainOld: HTMLElement | null = null;
  private chainNew: HTMLElement | null = null;

  private stackedNow = false;
  private shots: ResolvedShot[] = [];
  private stageW = 0;
  private stageH = 0;
  private travel = 1;
  private groundPx = 0;
  private markInset = 0;

  private tCurrent = 0;
  private tTarget = 0;
  private rainNow = 0;
  private windNow = 0;
  private pointerX = 0;
  private pointerY = 0;
  private pointerNowX = 0;
  private pointerNowY = 0;

  private rafId = 0;
  private lastFrame = 0;
  private visible = true;
  private observer?: IntersectionObserver;

  private seenTick = -1;
  private lastStatus = '';
  private lastChainColor = '';
  private lastDiv = -1;
  private lastRolled = -1;
  private readonly written: Record<string, string> = {};

  ngAfterViewInit(): void {
    const root = this.host.nativeElement;
    this.stage = root.querySelector<HTMLElement>('[data-stage]')!;
    this.track = root.querySelector<HTMLElement>('.kc-track')!;
    this.divider = root.querySelector<HTMLElement>('[data-divider]')!;
    this.tint = root.querySelector<HTMLElement>('[data-tint]')!;

    const all = <T extends Element = HTMLElement>(selector: string): T[] =>
      Array.from(root.querySelectorAll<T>(selector));

    this.frames = all('[data-frame]');
    this.wheels = all<Element>('[data-wheel]');
    this.pulleys = all<Element>('[data-pulley]');
    this.cranks = all<Element>('[data-crank]');
    this.pedals = all<Element>('[data-pedal]');
    this.chains = all<Element>('[data-chain]');
    this.fars = all('[data-far]');
    this.roads = all('[data-road]');
    this.nears = all('[data-near]');
    this.marks = all('[data-mark]');
    this.ticks = all('[data-tick]');
    this.chainOld = root.querySelector<HTMLElement>('[data-chain-old]');
    this.chainNew = root.querySelector<HTMLElement>('[data-chain-new]');
    this.barWear = root.querySelector<HTMLElement>('[data-bar="wear"]')!;
    this.barKm = root.querySelector<HTMLElement>('[data-bar="km"]')!;
    for (const el of all('[data-out]')) this.out[el.dataset['out']!] = el;

    const anchors: Record<string, { u: number; v: number }> = {
      chain: { u: 0.335, v: 0.595 },
      cassette: { u: 0.214, v: 0.625 },
      'rear-tyre': { u: 0.06, v: 0.4 },
      pads: { u: 0.76, v: 0.53 },
      'front-tyre': { u: 0.94, v: 0.4 },
    };
    this.partEls = all('[data-part]').map((el) => ({ el, ...anchors[el.dataset['part']!] }));

    const canvas = root.querySelector<HTMLCanvasElement>('[data-rain]');
    if (canvas) this.rain = new RainLayer(canvas);
    this.rainCanvas = canvas;

    this.stackedQuery = window.matchMedia(STACKED_QUERY);
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Marker für den Prüf-Harness, sonst wartet er vergeblich auf die Engine.
    document.documentElement.classList.add('sc-ready');

    if (this.reduced) {
      this.renderStill();
      return;
    }

    this.layout();
    this.renderAt(this.scrollToT());
    this.tCurrent = this.tTarget = this.scrollToT();

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    root.addEventListener('focusin', this.onFocusIn);
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
    }
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.wake();
    });
    this.observer.observe(this.stage);
    document.addEventListener('visibilitychange', this.wake);
    void document.fonts?.ready.then(() => {
      this.layout();
      this.wake();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.wake);
    this.host.nativeElement.removeEventListener('focusin', this.onFocusIn);
    this.observer?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.documentElement.classList.remove('sc-ready');
  }

  setWeather(key: keyof Weather, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.weather.update((current) => ({ ...current, [key]: value }));
    this.weatherTouched.set(true);
    if (this.reduced) {
      this.paintWeather(this.weather().precipitation, this.weather().windSpeed);
      this.applyTint(this.weather().temperature);
      return;
    }
    this.wake();
  }

  // ── Maße ──────────────────────────────────────────────────────────────────

  private layout(): void {
    this.stackedNow = this.stackedQuery.matches;
    this.stageW = this.stage.clientWidth;
    this.stageH = this.stage.clientHeight;
    this.travel = Math.max(this.track.offsetHeight - this.stageH, 1);
    this.rain?.resize(this.stageW, this.stageH);

    this.cues = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[data-sc-cue]'),
    ).map((el) => this.parseCue(el));

    const frame = this.frames[0];
    const w = frame.offsetWidth;
    const h = frame.offsetHeight;
    const left = frame.offsetLeft;
    const top = frame.offsetTop;
    const shots = this.stackedNow ? SHOTS_STACKED : SHOTS_SPLIT;
    this.shots = shots.map((shot, i) => {
      const isLast = i === shots.length - 1;
      const s = isLast ? this.closingScale(shot, w, h, left, top) : shot.s;
      // Das Schlussbild zeigt das ganze Rad: auf schmalen Bühnen nach innen schieben.
      const halfWidth = (w * s) / 2 / this.stageW;
      const x = isLast ? Math.min(shot.x, 0.985 - halfWidth) : shot.x;
      return {
        t: shot.t,
        s,
        tx: x * this.stageW - (left + shot.u * w * s),
        ty: shot.y * this.stageH - (top + shot.v * h * s),
      };
    });

    for (const side of ['l', 'r'] as const) {
      const read = this.host.nativeElement.querySelector<HTMLElement>(`.kc-read.kc-${side}`);
      if (read) {
        this.stage.style.setProperty(
          `--read-bottom-${side}`,
          `${read.offsetTop + read.offsetHeight}px`,
        );
      }
    }

    const last = this.shots[this.shots.length - 1];
    for (const part of this.partEls) {
      part.el.style.left = `${left + part.u * w * last.s + last.tx}px`;
      part.el.style.top = `${top + part.v * h * last.s + last.ty}px`;
    }

    this.groundPx = this.stageH - this.readRoadHeight();

    const care = this.marks[0]?.querySelector('b:last-child') as HTMLElement | null;
    this.markInset = care ? care.offsetWidth : 0;
  }

  /**
   * Maßstab fürs Schlussbild: das Rad steht rechtsbündig neben dem Abschlusstext. Auf Bühnen
   * zwischen Tablet und Laptop (900×700, 1024×768) lief es bei festem Maßstab unter Text und CTA,
   * das Etikett "Reifen hinten" lag direkt auf dem Button. Dann wird es kleiner statt
   * darunterzurutschen. Steht es ohnehin unter dem Text (Hochformat), bleibt der Maßstab.
   */
  private closingScale(shot: Shot, w: number, h: number, left: number, top: number): number {
    if (this.stackedNow) return shot.s;
    const close = this.host.nativeElement.querySelector<HTMLElement>('.kc-close');
    if (!close) return shot.s;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = 1.5 * rem;
    const textRight = close.offsetLeft + close.offsetWidth + gap;
    const textBottom = close.offsetTop + close.offsetHeight + gap;

    const rear = this.partEls.find((p) => p.el.dataset['part'] === 'rear-tyre');
    const labelHalf = rear ? rear.el.offsetWidth / 2 : 0;
    const labelHeight = rear ? rear.el.offsetHeight + 1.15 * rem : 0;

    const fits = (s: number): boolean => {
      const ty = shot.y * this.stageH - (top + shot.v * h * s);
      const bikeTop = Math.min(top + ty, top + ty + (rear?.v ?? 0) * h * s - labelHeight);
      if (bikeTop >= textBottom) return true;
      const x = Math.min(shot.x, 0.985 - (w * s) / 2 / this.stageW);
      const bikeLeft = x * this.stageW - shot.u * w * s;
      const labelLeft = bikeLeft + (rear?.u ?? 0) * w * s - labelHalf;
      return Math.min(bikeLeft, labelLeft) >= textRight;
    };

    // Schrittweise verkleinern, bis es passt; unter 0,6 wird das Rad zu klein für die Etiketten.
    let s = shot.s;
    while (s > 0.6 && !fits(s)) s -= 0.01;
    return s;
  }

  private readRoadHeight(): number {
    const road = this.host.nativeElement.querySelector<HTMLElement>('.kc-plane--dark [data-road]');
    return road?.parentElement?.offsetHeight ?? 0;
  }

  private parseCue(el: HTMLElement): Cue {
    const spec =
      (this.stackedNow && el.dataset['cueStacked']) || el.getAttribute('data-sc-cue') || '';
    const [from = 0, to, rampIn, rampOut] = spec.trim().split(/\s+/).map(Number);
    return { el, from, to: to ?? null, rampIn: rampIn ?? 0.3, rampOut: rampOut ?? 0.3, last: -1 };
  }

  private scrollToT(): number {
    const top = this.track.getBoundingClientRect().top;
    return clamp01(-top / this.travel) * END;
  }

  // ── Ereignisse ────────────────────────────────────────────────────────────

  private readonly onScroll = (): void => {
    this.tTarget = this.scrollToT();
    this.wake();
  };

  private readonly onResize = (): void => {
    // Reine Höhenänderung am Telefon ist die Adressleiste, kein neues Layout.
    if (this.stackedQuery.matches && this.stage.clientWidth === this.stageW) return;
    this.layout();
    this.tTarget = this.scrollToT();
    this.wake();
  };

  private readonly onPointer = (event: PointerEvent): void => {
    this.pointerX = event.clientX / window.innerWidth - 0.5;
    this.pointerY = event.clientY / window.innerHeight - 0.5;
    this.wake();
  };

  /**
   * Fokus auf einem Element, das gerade ausgeblendet ist: die Bühne an die Stelle fahren, an der
   * es sichtbar ist. Der Browser scrollt es sonst nur irgendwie ins Bild, und in einer gepinnten
   * Bühne ändert das gar nichts an seiner Deckkraft.
   */
  private readonly onFocusIn = (event: FocusEvent): void => {
    const at = (event.target as HTMLElement).dataset?.['focusAt'];
    if (at === undefined) return;
    const top = this.track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (Number(at) / END) * this.travel, behavior: 'instant' });
  };

  private readonly wake = (): void => {
    if (this.rafId || document.hidden || !this.visible) return;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private readonly tick = (now: number): void => {
    this.rafId = 0;
    const dt = Math.max(0, Math.min(now - this.lastFrame, 64));
    this.lastFrame = now;

    const ease = 1 - Math.exp(-dt / 70);
    this.tCurrent += (this.tTarget - this.tCurrent) * ease;
    if (Math.abs(this.tTarget - this.tCurrent) < 0.0005) this.tCurrent = this.tTarget;
    this.pointerNowX += (this.pointerX - this.pointerNowX) * ease;
    this.pointerNowY += (this.pointerY - this.pointerNowY) * ease;

    const weather = this.weatherAt(this.tCurrent);
    this.rainNow += (weather.precipitation - this.rainNow) * (1 - Math.exp(-dt / 260));
    this.windNow += (weather.windSpeed - this.windNow) * (1 - Math.exp(-dt / 260));
    if (Math.abs(weather.precipitation - this.rainNow) < 0.01) this.rainNow = weather.precipitation;

    this.renderAt(this.tCurrent);
    this.applyTint(weather.temperature);
    this.drawRain(dt);

    const moving =
      this.tCurrent !== this.tTarget ||
      Math.abs(this.pointerX - this.pointerNowX) > 0.001 ||
      Math.abs(this.pointerY - this.pointerNowY) > 0.001 ||
      this.rainNow > 0.01;
    if (moving) this.wake();
  };

  // ── Die Bühne zu einem Zeitpunkt ──────────────────────────────────────────

  private kmAt(t: number): number {
    if (t <= ROLL_START) return 0;
    if (t <= DRY_END) return (DRY_KM * (t - ROLL_START)) / (DRY_END - ROLL_START);
    if (t <= RAIN_START) return DRY_KM;
    if (t <= RAIN_END)
      return DRY_KM + ((SEASON_KM - DRY_KM) * (t - RAIN_START)) / (RAIN_END - RAIN_START);
    return SEASON_KM;
  }

  /** Gefahrene Strecke in Bühnenzeit: Räder stehen in der Stille und ab dem Urteil. */
  private rolledAt(t: number): number {
    const dry = Math.max(0, Math.min(t, DRY_END) - ROLL_START);
    const wet = Math.max(0, Math.min(t, RAIN_END) - RAIN_START);
    return dry + wet;
  }

  private weatherAt(t: number): Weather {
    if (t >= CONTROL_WEATHER_FROM) {
      const fade = 1 - smooth((t - (COLLAPSE_END - 1.1)) / 0.8);
      const chosen = this.weather();
      return { ...chosen, precipitation: chosen.precipitation * fade };
    }
    if (t < RAIN_START) {
      const drops = smooth((t - 2.05) / 0.4) * 0.5;
      return { precipitation: drops, temperature: 16, windSpeed: 8 };
    }
    return SAMPLE_RIDES[seasonAt(this.kmAt(t)).ride];
  }

  private renderAt(t: number): void {
    const stacked = this.stackedNow;
    const div = sample(stacked ? DIVIDER_STACKED : DIVIDER_SPLIT, t);
    if (div !== this.lastDiv) {
      // Vererbt sich auf die ganze Bühne, also nur schreiben, wenn sie sich wirklich bewegt.
      this.lastDiv = div;
      this.stage.style.setProperty('--div', div.toFixed(4));
    }

    this.applyCamera(t);
    this.applyMotion(t);
    this.applyCues(t);
    this.applyReadouts(t);
    this.applyMark(div);
    if (this.rainCanvas) {
      // Hinter die Regler und Sätze treten, im Peak und im Abschluss voll.
      const behindText = smooth((t - 5.9) / 0.4) * (1 - smooth((t - COMPARE_END) / 0.4));
      this.rainCanvas.style.opacity = (1 - behindText * 0.55).toFixed(3);
    }

    // Wechsel der Kette auf "neu" am Ende: Erleichterung statt Rot auf dem letzten Bild.
    const fresh = t > CHAIN_NEW_AT;
    if (this.chainOld && this.chainNew) {
      this.chainOld.hidden = fresh;
      this.chainNew.hidden = !fresh;
    }

    this.stage.setAttribute(
      'data-sc-verify-state',
      `${div.toFixed(3)}|${this.kmAt(t).toFixed(0)}|${t.toFixed(2)}`,
    );
    this.stage.setAttribute('data-sc-verify-hold', String(t >= COLLAPSE_END));
  }

  private applyCamera(t: number): void {
    const shots = this.shots;
    let i = shots.length - 1;
    for (let k = 1; k < shots.length; k++) {
      if (t <= shots[k].t) {
        i = k;
        break;
      }
    }
    const a = shots[Math.max(i - 1, 0)];
    const b = shots[i];
    const mix = b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1;
    const s = a.s + (b.s - a.s) * mix;
    const tx = a.tx + (b.tx - a.tx) * mix + this.pointerNowX * -6;
    const ty = a.ty + (b.ty - a.ty) * mix + this.pointerNowY * -3;
    const dim = sample(this.stackedNow ? DIM_STACKED : DIM_SPLIT, t);

    const transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
    for (const frame of this.frames) {
      frame.style.transform = transform;
      frame.style.opacity = dim.toFixed(3);
    }
  }

  private applyMotion(t: number): void {
    const rolled = this.rolledAt(t);
    if (rolled !== this.lastRolled) {
      this.lastRolled = rolled;
      const wheelDeg = rolled * WHEEL_DEG_PER_T;
      const crankDeg = wheelDeg / GEAR_RATIO;
      const chainTravel = (crankDeg * Math.PI * RING_R) / 180;

      for (const el of this.wheels) this.spin(el, wheelDeg);
      for (const el of this.pulleys) this.spin(el, wheelDeg * 1.6);
      for (const el of this.cranks) this.spin(el, crankDeg);
      for (const el of this.pedals) this.spin(el, -crankDeg);
      const offset = (-chainTravel % (CHAIN_PITCH * 100)).toFixed(2);
      for (const el of this.chains) el.setAttribute('stroke-dashoffset', offset);
    }

    // Pointer-Anteil in vw: fern rund 5 px, nah rund 17 px bei 1440 px Breite.
    const far = -((rolled * 9) % 140) + this.pointerNowX * -0.7;
    const road = -((rolled * 62) % 4);
    const near = -((rolled * 150) % 70) + this.pointerNowX * -2.4;
    // Die Pfosten stehen nur während der Fahrt im Bild, sonst laufen sie durch die Regler.
    const nearOpacity = 1 - smooth((t - DRY_END) / 0.35);
    for (const el of this.fars) el.style.transform = `translate3d(${far.toFixed(2)}vw,0,0)`;
    for (const el of this.roads) el.style.transform = `translate3d(${road.toFixed(2)}vw,0,0)`;
    for (const el of this.nears) {
      el.style.transform = `translate3d(${near.toFixed(2)}vw,0,0)`;
      el.style.opacity = nearOpacity.toFixed(3);
    }
  }

  private spin(el: Element, deg: number): void {
    const data = (el as SVGElement).dataset;
    el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${data['cx']} ${data['cy']})`);
  }

  private applyCues(t: number): void {
    for (const cue of this.cues) {
      let vis: number;
      if (cue.to === null) {
        vis = smooth((t - cue.from) / 0.3);
      } else {
        const win = Math.max(cue.to - cue.from, 0.001);
        const inEnd = cue.from + win * cue.rampIn;
        const outStart = cue.to - win * cue.rampOut;
        if (t < cue.from) vis = 0;
        else if (t < inEnd) vis = smooth((t - cue.from) / Math.max(inEnd - cue.from, 0.001));
        else if (t <= outStart) vis = 1;
        else vis = smooth(1 - (t - outStart) / Math.max(cue.to - outStart, 0.001));
      }
      // Bewusst nur Deckkraft: `visibility: hidden` nähme Regler und CTA aus der Tab-Reihenfolge
      // und den Text aus dem, was ein Screenreader vorliest.
      if (vis === cue.last) continue;
      cue.last = vis;
      cue.el.style.opacity = vis.toFixed(3);
      cue.el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
      // Bei voller Deckkraft räumen, sonst überschreibt der Inline-Wert den Hover-Lift des CTA.
      cue.el.style.transform =
        vis === 1 ? '' : `translate3d(0,${((1 - vis) * 1.2).toFixed(2)}svh,0)`;
    }
  }

  private applyReadouts(t: number): void {
    const km = this.kmAt(t);
    const point = seasonAt(km);
    const wear = point.wear.drivetrain;
    const ratio = wear / this.chainWarnKm;
    const status = warnStatus(ratio);
    const ride = SAMPLE_RIDES[point.ride];
    const factor = rideMultiplier(ride, 'drivetrain').multiplier;

    this.write('wear', de.format(wear));
    this.write('km', de.format(km));
    this.write('factor', t < RAIN_START ? '×1,0' : `×${de1.format(factor)}`);
    this.barWear.style.transform = `scaleX(${Math.min(ratio, 1.04).toFixed(4)})`;
    this.barKm.style.transform = `scaleX(${(km / this.chainWarnKm).toFixed(4)})`;

    if (status !== this.lastStatus) {
      this.lastStatus = status;
      this.write('status', STATUS_LABELS[status]);
      this.stage.dataset['chain'] = status;
    }

    // Kette in der Zeichnung: Ampel, zum Schluss neu und wieder Lime.
    const color = t > CHAIN_NEW_AT ? STATUS_COLORS.ok : STATUS_COLORS[status];
    if (color !== this.lastChainColor) {
      this.lastChainColor = color;
      this.stage.style.setProperty('--chain-live', color);
    }

    const label =
      t < ROLL_START
        ? ''
        : ride.precipitation > 0
          ? `Fahrt ${point.ride + 1}: ${de.format(ride.km)} km bei ${de1.format(ride.precipitation)} mm/h`
          : `Fahrt ${point.ride + 1}: ${de.format(ride.km)} km, trocken`;
    this.write('ride', label);

    const seen = t < ROLL_START ? -1 : point.ride;
    if (seen !== this.seenTick) {
      this.ticks.forEach((tick, i) => tick.classList.toggle('is-seen', i <= seen));
      this.seenTick = seen;
    }
  }

  /** `textContent` löst auch beim gleichen Wert ein Layout aus, deshalb der Vergleich. */
  private write(key: string, value: string): void {
    if (this.written[key] === value) return;
    this.written[key] = value;
    this.out[key].textContent = value;
  }

  private applyMark(div: number): void {
    if (this.stackedNow) return;
    const x = Math.min(div * this.stageW, this.stageW - this.markInset - 16);
    for (const mark of this.marks) mark.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  }

  private applyTint(temperature: number): void {
    const cold = clamp01((5 - temperature) / 15);
    const heat = clamp01((temperature - 28) / 12);
    this.tint.style.background =
      cold > 0
        ? `rgba(56, 132, 220, ${(cold * 0.2).toFixed(3)})`
        : `rgba(240, 130, 40, ${(heat * 0.17).toFixed(3)})`;
  }

  private drawRain(dt: number): void {
    const div = Number(this.stage.style.getPropertyValue('--div'));
    const edgeX = this.stackedNow ? this.stageW : div * this.stageW;
    const edgeY = this.stackedNow ? div * this.stageH : this.stageH;
    const ground = this.stackedNow ? div * this.stageH : this.groundPx;
    this.rain?.draw(dt, this.rainNow, this.windNow, edgeX, edgeY, ground);
  }

  // ── Reduzierte Bewegung: alles liegt im normalen Fluss, Endstände sofort ──

  private renderStill(): void {
    const root = this.host.nativeElement;
    root.querySelectorAll<HTMLElement>('[data-sc-cue]').forEach((el) => {
      el.style.opacity = '1';
    });
    this.stage.style.setProperty('--div', this.stackedQuery.matches ? '1' : '0.5');
    this.stage.style.setProperty('--chain-live', STATUS_COLORS.critical);
    this.stage.dataset['chain'] = 'critical';
    this.out['wear'].textContent = this.wearAtEnd;
    this.out['km'].textContent = this.kmAtEnd;
    this.out['status'].textContent = STATUS_LABELS.critical;
    this.out['factor'].textContent = '×2,0';
    this.out['ride'].textContent = `${SAMPLE_RIDES.length} Beispielfahrten`;
    this.barWear.style.transform = 'scaleX(1.02)';
    this.barKm.style.transform = `scaleX(${SEASON_KM / this.chainWarnKm})`;
    this.ticks.forEach((tick) => tick.classList.add('is-seen'));
    if (this.chainNew) this.chainNew.hidden = true;
    for (const el of this.chains) el.setAttribute('stroke-dashoffset', '0');

    const canvas = root.querySelector<HTMLCanvasElement>('[data-rain]');
    if (canvas && this.rain) {
      this.stageW = canvas.clientWidth;
      this.stageH = canvas.clientHeight;
      this.rain.resize(this.stageW, this.stageH);
      this.paintWeather(this.weather().precipitation, this.weather().windSpeed);
    }
  }

  private paintWeather(precipitation: number, wind: number): void {
    const stacked = this.stackedQuery.matches;
    this.rain?.draw(
      0,
      precipitation,
      wind,
      stacked ? this.stageW : this.stageW * 0.5,
      this.stageH,
      this.stageH * (stacked ? 1 : GROUND_Y / VIEW_H),
    );
  }
}
