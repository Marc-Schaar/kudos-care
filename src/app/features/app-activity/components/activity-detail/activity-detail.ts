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
  ChartOptions,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js';
import { ActivityDetailModel } from '../../models/activity-detail-model';
import { RideSummary } from '../../models/ride-summary';
import { WearImpactResponse } from '../../models/wear-impact';
import { WeatherTimeline } from '../../models/weather-timeline';
import { Map } from '../map/map';
import { AbsPipe } from '../../../../shared/pipes/abs/abs-pipe';
import { HeadwindLabelPipe } from '../../pipes/headwind-label/headwind-label-pipe';
import { Icon } from '../../../../shared/components/icon/icon';
import { formatDuration, mean } from '../../models/ride-insights';
import {
  hasProfileData,
  profileSegments,
  RAIN_SCALE_FLOOR_MM,
  verdictSentence,
  windVerdict,
} from '../../models/wind-profile';
import { WindProfile } from '../wind-profile/wind-profile';
import { WearImpact } from '../wear-impact/wear-impact';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

type MapMode = 'wind' | 'rain';

@Component({
  selector: 'app-activity-detail',
  imports: [
    Map,
    WindProfile,
    WearImpact,
    AbsPipe,
    HeadwindLabelPipe,
    DatePipe,
    DecimalPipe,
    Icon,
    RouterLink,
  ],
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

  @ViewChild('climateChart') climateChartRef?: ElementRef;

  public loading = signal(false);
  public error = signal<string | null>(null);
  public mapMode = signal<MapMode>('wind');
  /** Abschnitt, auf den gerade gezeigt wird, geteilt zwischen Karte und Windprofil. */
  public activeSegment = signal<number | null>(null);

  /**
   * Bezugsgrößen der relativen Farbskala. Bewusst aus den Karten-Abschnitten und
   * nicht aus den Stundenwerten abgeleitet: die Karte zeigt die feinere Auflösung,
   * und Chart, Karte und Legende müssen dieselbe Skala benutzen.
   */
  public windSegments = computed(() => this.activityService.activityData()?.wind_segments ?? null);

  public windSource = computed(() => this.windSegments()?.wind_source ?? 'none');

  private rideKm = computed(() => this.activityService.activityData()?.distance_km ?? null);

  private profileRows = computed(() => profileSegments(this.windSegments(), this.rideKm()));

  public hasProfile = computed(() => hasProfileData(this.profileRows(), this.mapMode()));

  /**
   * Der Befund-Satz unter dem Titel. Nur bei abschnittsgenauen Daten: die grobe
   * Start-Ziel-Schätzung kennt nur eine Richtung und würde "42 von 42 km" behaupten.
   */
  public verdict = computed(() => {
    if (this.windSource() !== 'stream') return null;
    const verdict = windVerdict(this.profileRows());
    return verdict ? verdictSentence(verdict) : null;
  });

  public maxAbsHeadwind = computed(() =>
    (this.windSegments()?.features ?? []).reduce(
      (max, f) => Math.max(max, Math.abs(f.properties.headwind ?? 0)),
      0,
    ),
  );

  public maxPrecipitation = computed(() =>
    (this.windSegments()?.features ?? []).reduce(
      (max, f) => Math.max(max, f.properties.precipitation ?? 0),
      RAIN_SCALE_FLOOR_MM,
    ),
  );

  /** Das Wetter der Fahrt als zwei Zahlen für die Kopfzeile. */
  public climate = computed(() => {
    const weather = this.activityService.activityData()?.weather_timeline;
    return {
      temperature: mean(weather?.temperature_2m),
      precipitation: mean(weather?.precipitation),
    };
  });

  private activityId: number | null = null;
  public rideSummary = signal<RideSummary | null>(null);
  public rideSummaryLoading = signal(false);
  public rideSummaryError = signal<string | null>(null);

  public wearImpact = signal<WearImpactResponse | null>(null);
  public wearImpactLoading = signal(false);
  public wearImpactError = signal<string | null>(null);

  private climateChart: Chart | undefined;

  private readonly muted = getComputedStyle(document.documentElement)
    .getPropertyValue('--muted')
    .trim();
  private readonly border = getComputedStyle(document.documentElement)
    .getPropertyValue('--border')
    .trim();
  private readonly text = getComputedStyle(document.documentElement)
    .getPropertyValue('--text')
    .trim();
  private readonly surface2 = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface2')
    .trim();

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
      this.activeSegment.set(null);
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
    if (!weatherData.time?.length || !this.climateChartRef) return;
    this.renderTemperatureChart(weatherData);
  }

  private timeLabels(times: string[] | undefined): string[] {
    return (times ?? []).map((t) => this.datePipe.transform(t, 'HH:mm') ?? t);
  }

  public setMapMode(mode: MapMode) {
    this.mapMode.set(mode);
  }

  /**
   * Nur noch die Temperatur über die Zeit. Gegenwind und Regen zeigt das Windprofil über die
   * Distanz, aus denselben Abschnitten wie die Karte; ein zweites Diagramm über Stunden
   * erzählte dasselbe in einer anderen Achse und lief optisch auseinander.
   */
  private renderTemperatureChart(weatherData: Partial<WeatherTimeline>) {
    this.climateChart?.destroy();
    this.climateChart = new Chart(this.climateChartRef!.nativeElement, {
      type: 'line',
      data: {
        labels: this.timeLabels(weatherData.time),
        datasets: [
          {
            label: 'Temperatur (°C)',
            data: weatherData.temperature_2m ?? [],
            borderColor: this.text,
            backgroundColor: this.text,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: this.chartOptions(),
    });
  }

  /** Dünne Linie, waagerechtes Raster im Hintergrund, Fadenkreuz mit Tooltip über die volle Höhe. */
  private chartOptions(): ChartOptions<'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 240 },
      scales: {
        x: {
          grid: { display: false },
          border: { color: this.border },
          ticks: { color: this.muted, maxTicksLimit: 6 },
        },
        y: {
          grid: { color: this.border },
          border: { display: false },
          ticks: { color: this.muted, maxTicksLimit: 5, callback: (value) => `${value} °` },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: this.surface2,
          titleColor: this.text,
          bodyColor: this.text,
          borderColor: this.border,
          borderWidth: 1,
          cornerRadius: 4,
          padding: 8,
          displayColors: false,
        },
      },
    };
  }

  public formatDuration = formatDuration;
}
