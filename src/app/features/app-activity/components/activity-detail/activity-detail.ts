import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../services/activity-service/activity-service';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
);

@Component({
  selector: 'app-activity-detail',
  imports: [],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetail implements OnInit {
  private route = inject(ActivatedRoute);
  public activityService = inject(ActivityService);

  @ViewChild('weatherChart') weatherChartRef!: ElementRef;
  chart: any;

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      this.getActivityDetail(id);
    });
  }

  getActivityDetail(id: number) {
    this.activityService.getActivityDetail(id).subscribe({
      next: (data) => {
        console.log('Details geladen:', data);
        this.renderWeatherChart(data.weather_timeline);
      },
      error: (err) => console.error('Fehler beim Laden:', err),
    });
  }

  private renderWeatherChart(weatherData: any) {
    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.weatherChartRef.nativeElement, {
      type: 'line', // Das funktioniert jetzt, da LineController registriert ist
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
            label: 'Wind (m/s)',
            data: weatherData.wind_speed_10m.slice(0, 15),
            borderColor: '#ff9f40',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            yAxisID: 'y1',
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
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Wind (m/s)' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }
}
