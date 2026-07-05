import {
  afterNextRender,
  Component,
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
import { WeatherTimeline } from '../../models/weather-timeline';
import { Map } from '../map/map';
import { AbsPipe } from '../../../../shared/pipes/abs/abs-pipe';
import { DatePipe, DecimalPipe } from '@angular/common';

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
type ChartMode = 'wind' | 'rain';

@Component({
  selector: 'app-activity-detail',
  imports: [Map, AbsPipe, DatePipe, DecimalPipe, RouterLink],
  providers: [DatePipe],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private injector = inject(Injector);
  private datePipe = inject(DatePipe);
  public activityService = inject(ActivityService);

  @ViewChild('climateChart') climateChartRef!: ElementRef;
  @ViewChild('conditionChart') conditionChartRef!: ElementRef;

  public loading = signal(false);
  public error = signal<string | null>(null);
  public chartMode = signal<ChartMode>('wind');
  public mapMode = signal<ChartMode>('wind');

  private climateChart: Chart | undefined;
  private conditionChart: Chart | undefined;
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
  private readonly ok = getComputedStyle(document.documentElement)
    .getPropertyValue('--ok')
    .trim();
  /** Kein eigener CSS-Variablen-Slot fürs Design-System vorgesehen, daher fest hinterlegt. */
  private readonly rain = '#38bdf8';

  ngOnInit(): void {
    Chart.defaults.font.family = "'DM Mono', monospace";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = this.muted;
    Chart.defaults.borderColor = this.border;

    this.route.params.subscribe((params) => {
      const id = +params['id'];
      this.getActivityDetail(id);
    });
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
    this.renderClimateChart(weatherData);
    this.renderConditionChart(weatherData);
  }

  private timeLabels(times: string[] | undefined): string[] {
    return (times ?? []).map((t) => this.datePipe.transform(t, 'HH:mm') ?? t);
  }

  public setChartMode(mode: ChartMode) {
    if (this.chartMode() === mode) return;
    this.chartMode.set(mode);
    if (this.currentWeatherData) {
      this.renderConditionChart(this.currentWeatherData);
    }
  }

  public setMapMode(mode: ChartMode) {
    this.mapMode.set(mode);
  }

  private renderConditionChart(weatherData: Partial<WeatherTimeline>) {
    if (this.chartMode() === 'rain') {
      this.renderRainChart(weatherData);
    } else {
      this.renderWindChart(weatherData);
    }
  }

  private renderWindChart(weatherData: Partial<WeatherTimeline>) {
    const headwindValues = weatherData.headwind ?? [];
    const maxAbsHeadwind = headwindValues.reduce(
      (max: number, v) => (v == null ? max : Math.max(max, Math.abs(v))),
      0,
    );

    this.conditionChart?.destroy();
    this.conditionChart = new Chart(this.conditionChartRef.nativeElement, {
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
    const maxPrecipitation = precipitationValues.reduce(
      (max: number, v) => (v == null ? max : Math.max(max, Math.abs(v))),
      0,
    );

    this.conditionChart?.destroy();
    this.conditionChart = new Chart(this.conditionChartRef.nativeElement, {
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

  private renderClimateChart(weatherData: Partial<WeatherTimeline>) {
    this.climateChart?.destroy();
    const precipitation = weatherData.precipitation ?? [];

    this.climateChart = new Chart(this.climateChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.timeLabels(weatherData.time?.slice(0, 15)),
        datasets: [
          {
            label: 'Temperatur (°C)',
            data: (weatherData.temperature_2m ?? []).slice(0, 15),
            borderColor: this.accent,
            backgroundColor: this.accent,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'Regen (mm)',
            data: precipitation.slice(0, 15),
            type: 'bar',
            backgroundColor: `color-mix(in srgb, ${this.text} 25%, transparent)`,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: this.border }, ticks: { color: this.muted } },
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Temperatur (°C)', color: this.muted },
            grid: { color: this.border },
            ticks: { color: this.muted },
            beginAtZero: true,
          },
          y2: {
            position: 'right',
            title: { display: true, text: 'Regen (mm)', color: this.muted },
            grid: { drawOnChartArea: false },
            ticks: { color: this.muted },
            offset: true,
            display: precipitation.some((v: number) => v > 0),
          },
        },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: this.muted, boxWidth: 12 } },
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
