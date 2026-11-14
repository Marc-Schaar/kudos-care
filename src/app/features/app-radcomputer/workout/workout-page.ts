import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DemoDriver } from '../core/demo-driver';
import { fmtTime } from '../core/format';
import { RideView } from '../core/ride-view';
import { SettingsStore } from '../core/settings-store';
import { SubHeader } from '../menu/sub-header';
import { WorkoutChart } from './workout-chart';
import { WorkoutPlayer, describeTarget } from './workout-player';
import { RC } from '../core/paths';

/** Trainings laden und verwalten. Gefahren wird es auf der Trainingsseite der Fahrt. */
@Component({
  selector: 'rc-workout-page',
  imports: [WorkoutChart, RouterLink, SubHeader],
  templateUrl: './workout-page.html',
  styleUrl: './workout-page.css',
})
export class WorkoutPage {
  protected readonly rc = RC;
  protected readonly player = inject(WorkoutPlayer);
  protected readonly settings = inject(SettingsStore);
  protected readonly demo = inject(DemoDriver);
  private readonly router = inject(Router);
  private readonly view = inject(RideView);

  protected readonly fmtTime = fmtTime;
  protected readonly describeTarget = describeTarget;

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file && (await this.player.loadFile(file))) this.showOnRide();
  }

  protected start(): void {
    this.player.start();
    this.showOnRide();
  }

  protected loadDemo(): void {
    this.demo.loadSampleWorkout();
    this.showOnRide();
  }

  protected showOnRide(): void {
    this.view.show('workout');
    void this.router.navigateByUrl(RC.ride);
  }
}
