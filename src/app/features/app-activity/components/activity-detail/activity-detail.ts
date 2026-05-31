import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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

@Component({
  selector: 'app-activity-detail',
  imports: [Map, AbsPipe],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetail implements OnInit {
  private route = inject(ActivatedRoute);
  public activityService = inject(ActivityService);

  @ViewChild('climateChart') climateChartRef!: ElementRef;
  @ViewChild('windChart') windChartRef!: ElementRef;

  chart: any;

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      this.getActivityDetail(id);
    });
  }

  getActivityDetail(id: number) {
    this.activityService.getActivityDetail(id).subscribe({
      next: (data: ActivityDetailModel) => {
        this.renderCharts(data.weather_timeline);
      },
      error: (err) => console.error('Fehler beim Laden:', err),
    });
  }

  private renderCharts(weatherData: WeatherTimeline) {
    this.renderClimateChart(weatherData);
    this.renderWindChart(weatherData);
  }

  private renderWindChart(weatherData: WeatherTimeline) {
    new Chart(this.windChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: weatherData.time,
        datasets: [
          { label: 'Wind (m/s)', data: weatherData.wind_speed_10m, borderColor: '#ff9f40' },
          {
            label: 'Gegenwind (km/h)',
            data: weatherData.headwind,
            borderColor: '#d32f2f',
            borderDash: [5, 5],
          },
        ],
      },
      options: {
        /* ... */
      },
    });
  }

  private renderClimateChart(weatherData: WeatherTimeline) {
    if (this.chart) this.chart.destroy();

    this.chart = new Chart(this.climateChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: weatherData.time.slice(0, 15),
        datasets: [
          {
            label: 'Temperatur (°C)',
            data: weatherData.temperature_2m.slice(0, 15),
            borderColor: '#3e95cd',
            tension: 0.1,
          },

          {
            label: 'Regen (mm)',
            data: weatherData.precipitation.slice(0, 15),
            type: 'bar',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Temperatur (°C)' },
            beginAtZero: true,
          },

          y2: {
            position: 'right',
            title: { display: true, text: 'Regen (mm)' },
            grid: { drawOnChartArea: false },
            offset: true,
            display: weatherData.precipitation.some((v: number) => v > 0),
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
        },
      },
    });
  }

  public getWindColor(val: number | undefined): string {
    if (!val || val < 0) return 'green';
    if (val < 5) return 'orange';
    return 'red';
  }
}
