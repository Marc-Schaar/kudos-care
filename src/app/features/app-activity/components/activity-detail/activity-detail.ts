import { Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
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
);

type WindStatus = 'ok' | 'warn' | 'critical';

@Component({
  selector: 'app-activity-detail',
  imports: [Map, AbsPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetail implements OnInit {
  private route = inject(ActivatedRoute);
  public activityService = inject(ActivityService);

  @ViewChild('climateChart') climateChartRef!: ElementRef;
  @ViewChild('windChart') windChartRef!: ElementRef;

  public loading = signal(false);
  public error = signal<string | null>(null);

  private climateChart: Chart | undefined;
  private windChart: Chart | undefined;

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
  private readonly warn = getComputedStyle(document.documentElement)
    .getPropertyValue('--warn')
    .trim();

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
        this.renderCharts(data.weather_timeline);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Aktivität konnte nicht geladen werden.');
      },
    });
  }

  private renderCharts(weatherData: Partial<WeatherTimeline>) {
    if (!weatherData.time?.length) return;
    this.renderClimateChart(weatherData);
    this.renderWindChart(weatherData);
  }

  private renderWindChart(weatherData: Partial<WeatherTimeline>) {
    this.windChart?.destroy();
    this.windChart = new Chart(this.windChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: weatherData.time,
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
            data: weatherData.headwind ?? [],
            borderColor: this.critical,
            borderWidth: 2.5,
            segment: {
              borderColor: (ctx) => this.windSegmentColor(ctx.p1.parsed.y),
              backgroundColor: (ctx) =>
                `color-mix(in srgb, ${this.windSegmentColor(ctx.p1.parsed.y)} 18%, transparent)`,
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

  private renderClimateChart(weatherData: Partial<WeatherTimeline>) {
    this.climateChart?.destroy();
    const precipitation = weatherData.precipitation ?? [];

    this.climateChart = new Chart(this.climateChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: weatherData.time!.slice(0, 15),
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

  private windSegmentColor(val: number | undefined | null): string {
    const status = this.windStatus(val);
    const map: Record<WindStatus, string> = {
      ok: this.ok,
      warn: this.warn,
      critical: this.critical,
    };
    return map[status];
  }

  public formatDuration(seconds: number | null): string {
    if (!seconds) return '–';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m} min`;
    return `${h} h ${m.toString().padStart(2, '0')} min`;
  }
}
