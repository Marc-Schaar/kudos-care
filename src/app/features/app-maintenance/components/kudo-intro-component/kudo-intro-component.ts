import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BikeType,
  KudoModelCandidate,
  KudoSetupSuggestion,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';

type Phase = 'ask' | 'models' | 'building';

/**
 * "Kudo hilft dir beim Anlegen" — Schritt 0 des Bike-Setups.
 *
 * Hersteller, Baujahr und optional gleich das Modell — statt einer leeren
 * Checkliste schlägt Kudo daraus eine Vorbelegung für den bestehenden Stepper vor.
 * Angelegt wird hier nichts — der Nutzer läuft danach den normalen Ablauf durch
 * und kann jede Zeile korrigieren.
 *
 * Ist das Modell schon bekannt, wird die Modellsuche übersprungen und direkt mit
 * Hersteller+Modell+Baujahr eine Setup-Vorbelegung angefragt — das trifft genauer,
 * weil Kudo dann nicht erst selbst raten muss, welches Modell gemeint sein könnte.
 * Kennt der Nutzer nur den Hersteller, schlägt Kudo wie bisher passende Modelle vor.
 *
 * Fällt Kudo aus (kein API-Key, Timeout), bleibt der manuelle Weg unverändert
 * offen; deshalb ist "Selbst einrichten" hier gleichberechtigt sichtbar und kein
 * Notausgang.
 */
@Component({
  selector: 'app-kudo-intro-component',
  imports: [FormsModule],
  templateUrl: './kudo-intro-component.html',
  styleUrl: './kudo-intro-component.css',
})
export class KudoIntroComponent {
  bikeId = input.required<number>();
  bikeType = input.required<BikeType>();

  /** Vorbelegung steht — der Stepper übernimmt. */
  suggested = output<KudoSetupSuggestion>();
  /** Nutzer will ohne Kudo weitermachen. */
  skipped = output<void>();

  private readonly bikeService = inject(BikeService);

  manufacturer = '';
  /** Optional schon in Schritt 1 angebbar — dann entfällt die Modellsuche. */
  model = '';
  year: number | null = null;

  phase = signal<Phase>('ask');
  loading = signal(false);
  error = signal<string | null>(null);
  models = signal<KudoModelCandidate[]>([]);

  /**
   * Einstiegspunkt des ersten Formulars. Ist ein Modell angegeben, wird direkt eine
   * Setup-Vorbelegung dafür angefragt (treffsicherer als der Umweg über eine von
   * Kudo selbst geratene Modellliste); ohne Modell läuft die bisherige Modellsuche.
   */
  submitAsk() {
    const manufacturer = this.manufacturer.trim();
    if (!manufacturer) {
      this.error.set('Bitte einen Hersteller angeben.');
      return;
    }
    this.error.set(null);

    const model = this.model.trim();
    if (model) {
      // Für den Fall, dass die Setup-Anfrage fehlschlägt: chooseModel() fällt dann
      // auf die Modell-Phase zurück, deren Eintippen-Feld so schon vorbefüllt ist.
      this.customModel = model;
      this.chooseModel(model);
      return;
    }

    this.askModels(manufacturer);
  }

  private askModels(manufacturer: string) {
    this.loading.set(true);
    this.bikeService.fetchKudoModels(manufacturer, this.year, this.bikeType()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.models.set(res.models);
        this.phase.set('models');
        if (res.models.length === 0) {
          // Leere Liste heißt "Hersteller unbekannt", nicht "Kudo kaputt" — der
          // Nutzer kann sein Modell trotzdem frei eintippen.
          this.error.set(
            `Kudo kennt „${manufacturer}" nicht. Du kannst dein Modell trotzdem eintippen.`,
          );
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Kudo ist gerade nicht erreichbar.');
      },
    });
  }

  /** Modell aus der Liste oder frei eingetippt — beides führt hierhin. */
  chooseModel(model: string) {
    const name = model.trim();
    if (!name) {
      this.error.set('Bitte ein Modell auswählen oder eintippen.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    this.phase.set('building');
    this.bikeService
      .fetchKudoSetup(this.bikeId(), this.manufacturer.trim(), name, this.year)
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.suggested.emit(res);
        },
        error: (err) => {
          this.loading.set(false);
          this.phase.set('models');
          this.error.set(err?.error?.error ?? 'Kudo ist gerade nicht erreichbar.');
        },
      });
  }

  customModel = '';

  chooseCustomModel() {
    this.chooseModel(this.customModel);
  }

  back() {
    this.error.set(null);
    this.phase.set('ask');
  }
}
