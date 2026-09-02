import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityService } from '../../services/activity-service/activity-service';
import {
  Chart,
  LineController,
  LineElement,
  BarController,
  BarElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { ActivityDetailModel } from '../../models/activity-detail-model';
import { RideSummary } from '../../models/ride-summary';
import { WearImpactResponse } from '../../models/wear-impact';
import { WeatherTimeline } from '../../models/weather-timeline';
import { Map } from '../map/map';
import { AbsPipe } from '../../../../shared/pipes/abs/abs-pipe';
import { HeadwindLabelPipe } from '../../pipes/headwind-label/headwind-label-pipe';
import { UserMenu } from '../../../../shared/components/user-menu/user-menu';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

Chart.register(
  LineController,
  LineElement,
  BarController,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler,
);

type WindStatus = 'ok' | 'warn' | 'critical';
type MapMode = 'wind' | 'rain';
type ClimateMode = 'temperature' | 'rain';

@Component({
  selector: 'app-activity-detail',
  imports: [Map, AbsPipe, HeadwindLabelPipe, DatePipe, DecimalPipe, RouterLink, UserMenu],
  providers: [DatePipe],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetail implements OnInit {
  readonly nav = inject(NavigationService);
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);
  private datePipe = inject(DatePipe);
  public activityService = inject(ActivityService);

  @ViewChild('climateChart') climateChartRef!: ElementRef;
  @ViewChild('windChart') windChartRef!: ElementRef;

  public loading = signal(false);
  public error = signal<string | null>(null);
  public climateMode = signal<ClimateMode>('temperature');
  public mapMode = signal<MapMode>('wind');

  /**
   * Bezugsgrößen der relativen Farbskala. Bewusst aus den Karten-Abschnitten und
   * nicht aus den Stundenwerten abgeleitet: die Karte zeigt die feinere Auflösung,
   * und Chart, Karte und Legende müssen dieselbe Skala benutzen.
   */
  public windSegments = computed(() => this.activityService.activityData()?.wind_segments ?? null);

  public windSource = computed(() => this.windSegments()?.wind_source ?? 'none');

  public maxAbsHeadwind = computed(() =>
    (this.windSegments()?.features ?? []).reduce(
      (max, f) => Math.max(max, Math.abs(f.properties.headwind ?? 0)),
      0,
    ),
  );

  public maxPrecipitation = computed(() =>
    (this.windSegments()?.features ?? []).reduce(
      (max, f) => Math.max(max, f.properties.precipitation ?? 0),
      0,
    ),
  );

  private activityId: number | null = null;
  public rideSummary = signal<RideSummary | null>(null);
  public rideSummaryLoading = signal(false);
  public rideSummaryError = signal<string | null>(null);

  public wearImpact = signal<WearImpactResponse | null>(null);
  public wearImpactLoading = signal(false);
  public wearImpactError = signal<string | null>(null);

  private climateChart: Chart | undefined;
  private windChart: Chart | undefined;
  private currentWeatherData: Partial<WeatherTimeline> | null = null;

  private readonly muted = getComputedStyle(document.documentElement)
    .getPropertyValue('--muted')
    .trim();
  private readonly border = getComputedStyle(document.documentElement)
    .getPropertyValue('--border')
    .trim();
  private readonly text = getComputedStyle(document.documentElement)
    .getPropertyValue('--text')
    .trim();
  private readonly accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
  private readonly critical = getComputedStyle(document.documentElement)
    .getPropertyValue('--critical')
    .trim();
  private readonly ok = getComputedStyle(document.documentElement).getPropertyValue('--ok').trim();
  private readonly rain =
    getComputedStyle(document.documentElement).getPropertyValue('--rain').trim() || '#38bdf8';

  ngOnInit(): void {
    Chart.defaults.font.family = "'DM Mono', monospace";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = this.muted;
    Chart.defaults.borderColor = this.border;

    this.route.params.subscribe((params) => {
      const id = +params['id'];
      this.activityId = id;
      this.rideSummary.set(null);
      this.rideSummaryError.set(null);
      this.wearImpact.set(null);
      this.wearImpactError.set(null);
      this.getActivityDetail(id);
    });
  }

  public loadRideSummary(refresh = false) {
    if (this.activityId == null || this.rideSummaryLoading()) return;
    this.rideSummaryLoading.set(true);
    this.rideSummaryError.set(null);
    this.activityService.getRideSummary(this.activityId, refresh).subscribe({
      next: (res) => {
        this.rideSummaryLoading.set(false);
        this.rideSummary.set(res);
      },
      error: (err) => {
        this.rideSummaryLoading.set(false);
        this.rideSummaryError.set(
          err?.error?.error ?? 'KI-Auswertung konnte nicht geladen werden.',
        );
      },
    });
  }

  public loadWearImpact(refresh = false) {
    if (this.activityId == null || this.wearImpactLoading()) return;
    this.wearImpactLoading.set(true);
    this.wearImpactError.set(null);
    this.activityService.getWearImpact(this.activityId, refresh).subscribe({
      next: (res) => {
        this.wearImpactLoading.set(false);
        this.wearImpact.set(res);
      },
      error: (err) => {
        this.wearImpactLoading.set(false);
        this.wearImpactError.set(
          err?.error?.error ?? 'Verschleiß-Auswertung konnte nicht geladen werden.',
        );
      },
    });
  }

  /** Ampel für den wetterbedingten Aufschlag einer Kategorie. */
  public impactClass(extraPct: number): 'ok' | 'warn' | 'critical' {
    if (extraPct >= 30) return 'critical';
    if (extraPct >= 10) return 'warn';
    return 'ok';
  }

  getActivityDetail(id: number) {
    this.loading.set(true);
    this.error.set(null);
    this.activityService.getActivityDetail(id).subscribe({
      next: (data: ActivityDetailModel) => {
        this.loading.set(false);
        afterNextRender(() => this.renderCharts(data.weather_timeline), {
          injector: this.injector,
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Aktivität konnte nicht geladen werden.');
      },
    });
  }

  private renderCharts(weatherData: Partial<WeatherTimeline>) {
    if (!weatherData.time?.length) return;
    this.currentWeatherData = weatherData;
    this.renderClimateSection(weatherData);
    this.renderWindChart(weatherData);
  }

  private timeLabels(times: string[] | undefined): string[] {
    return (times ?? []).map((t) => this.datePipe.transform(t, 'HH:mm') ?? t);
  }

  public setClimateMode(mode: ClimateMode) {
    if (this.climateMode() === mode) return;
    this.climateMode.set(mode);
    if (this.currentWeatherData) {
      this.renderClimateSection(this.currentWeatherData);
    }
  }

  public setMapMode(mode: MapMode) {
    this.mapMode.set(mode);
  }

  private renderClimateSection(weatherData: Partial<WeatherTimeline>) {
    if (this.climateMode() === 'rain') {
      this.renderRainChart(weatherData);
    } else {
      this.renderTemperatureChart(weatherData);
    }
  }

  private renderWindChart(weatherData: Partial<WeatherTimeline>) {
    const headwindValues = weatherData.headwind ?? [];
    // Gemeinsame Skala mit der Karte: sonst bedeutet dieselbe Farbintensität in
    // Chart und Karte unterschiedliche Windstärken. Die Stundenwerte gehen mit ein,
    // damit die Skala auch beim groben Fallback ohne Abschnitte gültig bleibt.
    const maxAbsHeadwind = headwindValues.reduce(
      (max: number, v) => (v == null ? max : Math.max(max, Math.abs(v))),
      this.maxAbsHeadwind(),
    );

    this.windChart?.destroy();
    this.windChart = new Chart(this.windChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.timeLabels(weatherData.time),
        datasets: [
          {
            label: 'Wind (m/s)',
            data: weatherData.wind_speed_10m ?? [],
            borderColor: this.text,
            backgroundColor: this.text,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'Gegenwind (km/h)',
            data: headwindValues,
            borderColor: this.critical,
            borderWidth: 2.5,
            segment: {
              borderColor: (ctx) => this.windSegmentColor(ctx.p1.parsed.y, maxAbsHeadwind),
              backgroundColor: (ctx) => this.windSegmentFill(ctx.p1.parsed.y, maxAbsHeadwind),
            },
            fill: { target: 'origin' },
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: this.border }, ticks: { color: this.muted } },
          y: { grid: { color: this.border }, ticks: { color: this.muted } },
        },
        plugins: {
          legend: { labels: { color: this.muted, boxWidth: 12 } },
        },
      },
    });
  }

  private renderRainChart(weatherData: Partial<WeatherTimeline>) {
    const precipitationValues = weatherData.precipitation ?? [];
    // Gemeinsame Skala mit der Karte, siehe renderWindChart().
    const maxPrecipitation = precipitationValues.reduce(
      (max: number, v) => (v == null ? max : Math.max(max, Math.abs(v))),
      this.maxPrecipitation(),
    );

    this.climateChart?.destroy();
    this.climateChart = new Chart(this.climateChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.timeLabels(weatherData.time),
        datasets: [
          {
            label: 'Niederschlag (mm)',
            data: precipitationValues,
            borderColor: this.rain,
            borderWidth: 2.5,
            segment: {
              borderColor: (ctx) => this.rainSegmentColor(ctx.p1.parsed.y, maxPrecipitation),
              backgroundColor: (ctx) => this.rainSegmentFill(ctx.p1.parsed.y, maxPrecipitation),
            },
            fill: { target: 'origin' },
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: this.border }, ticks: { color: this.muted } },
          y: { grid: { color: this.border }, ticks: { color: this.muted }, beginAtZero: true },
        },
        plugins: {
          legend: { labels: { color: this.muted, boxWidth: 12 } },
        },
      },
    });
  }

  private renderTemperatureChart(weatherData: Partial<WeatherTimeline>) {
    this.climateChart?.destroy();

    this.climateChart = new Chart(this.climateChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.timeLabels(weatherData.time),
        datasets: [
          {
            label: 'Temperatur (°C)',
            data: weatherData.temperature_2m ?? [],
            borderColor: this.accent,
            backgroundColor: this.accent,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: this.border }, ticks: { color: this.muted } },
          y: {
            grid: { color: this.border },
            ticks: { color: this.muted },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { labels: { color: this.muted, boxWidth: 12 } },
        },
      },
    });
  }

  public windStatus(val: number | undefined | null): WindStatus {
    if (val == null || val < 0) return 'ok';
    if (val < 5) return 'warn';
    return 'critical';
  }

  /** Farbintensität relativ zum stärksten Wert dieser Fahrt statt fixer Schwellenwerte. */
  private relativeIntensity(val: number | undefined | null, maxAbs: number): number {
    if (val == null || maxAbs <= 0) return 0;
    return Math.min(1, Math.abs(val) / maxAbs);
  }

  private windSegmentColor(val: number | undefined | null, maxAbs: number): string {
    if (val == null) return this.muted;
    const base = val >= 0 ? this.critical : this.ok;
    const intensity = this.relativeIntensity(val, maxAbs);
    const mixPercent = Math.round(20 + intensity * 80);
    return `color-mix(in srgb, ${base} ${mixPercent}%, ${this.muted})`;
  }

  private windSegmentFill(val: number | undefined | null, maxAbs: number): string {
    if (val == null) return 'transparent';
    const base = val >= 0 ? this.critical : this.ok;
    const intensity = this.relativeIntensity(val, maxAbs);
    const alphaPercent = Math.round(6 + intensity * 24);
    return `color-mix(in srgb, ${base} ${alphaPercent}%, transparent)`;
  }

  private rainSegmentColor(val: number | undefined | null, maxAbs: number): string {
    if (val == null) return this.muted;
    const intensity = this.relativeIntensity(val, maxAbs);
    const mixPercent = Math.round(20 + intensity * 80);
    return `color-mix(in srgb, ${this.rain} ${mixPercent}%, ${this.muted})`;
  }

  private rainSegmentFill(val: number | undefined | null, maxAbs: number): string {
    if (val == null) return 'transparent';
    const intensity = this.relativeIntensity(val, maxAbs);
    const alphaPercent = Math.round(6 + intensity * 24);
    return `color-mix(in srgb, ${this.rain} ${alphaPercent}%, transparent)`;
  }

  public formatDuration(seconds: number | null): string {
    if (!seconds) return '–';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m} min`;
    return `${h} h ${m.toString().padStart(2, '0')} min`;
  }
}
