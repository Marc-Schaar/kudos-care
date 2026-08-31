import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import {
  BikeType,
  ComponentGroupCatalog,
  KudoGroupSuggestion,
  KudoSetupSuggestion,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { AssemblyChecklistComponent } from '../assembly-checklist-component/assembly-checklist-component';
import { KudoIntroComponent } from '../kudo-intro-component/kudo-intro-component';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';

/**
 * Geführter Erst-Einrichtungs-Ablauf für ein Bike ohne Komponenten: ein Schritt
 * je empfohlener Baugruppe (bike-typ-gefiltert), jeder überspringbar, am Ende
 * eine Zusammenfassung. Nutzt die AssemblyChecklist je Schritt.
 *
 * Davor liegt optional Kudo (Schritt 0): Hersteller + Baujahr → Vorbelegung aller
 * Schritte. Der Ablauf selbst bleibt identisch — Kudo füllt nur die Felder vor,
 * jede Zeile bleibt abwählbar und überschreibbar.
 */
@Component({
  selector: 'app-bike-setup-stepper-component',
  imports: [AssemblyChecklistComponent, KudoIntroComponent, Skeleton],
  templateUrl: './bike-setup-stepper-component.html',
  styleUrl: './bike-setup-stepper-component.css',
})
export class BikeSetupStepperComponent implements OnInit {
  bikeId = input.required<number>();
  bikeType = input.required<BikeType>();

  done = output<void>();

  private readonly bikeService = inject(BikeService);

  loading = signal(true);
  steps = signal<ComponentGroupCatalog[]>([]);
  index = signal(0);
  addedCount = signal(0);
  finished = signal(false);

  /** Kudo-Intro anzeigen, solange der Nutzer weder zugestimmt noch abgelehnt hat. */
  showKudo = signal(true);
  kudoSuggestion = signal<KudoSetupSuggestion | null>(null);

  private prefillByGroup = computed(() => {
    const groups = this.kudoSuggestion()?.groups ?? [];
    return new Map<number, KudoGroupSuggestion>(groups.map((g) => [g.group_id, g]));
  });

  currentGroup = computed<ComponentGroupCatalog | null>(() => this.steps()[this.index()] ?? null);

  /** Kudos Vorbelegung für die gerade angezeigte Baugruppe (null = keine). */
  currentPrefill = computed<KudoGroupSuggestion | null>(() => {
    const group = this.currentGroup();
    return group ? (this.prefillByGroup().get(group.id) ?? null) : null;
  });

  progress = computed(() => {
    const total = this.steps().length;
    return total === 0 ? 0 : Math.round((this.index() / total) * 100);
  });

  ngOnInit() {
    this.bikeService.fetchGroups(this.bikeType()).subscribe({
      next: (groups) => {
        this.steps.set(
          groups
            .filter((g) => g.recommended && (g.parts.length > 0 || g.consumables.length > 0))
            .sort((a, b) => a.sort_order - b.sort_order),
        );
        this.loading.set(false);
        if (this.steps().length === 0) {
          this.showKudo.set(false);
          this.finished.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.showKudo.set(false);
        this.finished.set(true);
      },
    });
  }

  onKudoSuggested(suggestion: KudoSetupSuggestion) {
    this.kudoSuggestion.set(suggestion);
    this.showKudo.set(false);
  }

  onKudoSkipped() {
    this.showKudo.set(false);
  }

  private advance() {
    if (this.index() + 1 >= this.steps().length) {
      this.finished.set(true);
    } else {
      this.index.update((i) => i + 1);
    }
  }

  onCreated() {
    this.addedCount.update((c) => c + 1);
    this.advance();
  }

  onSkipped() {
    this.advance();
  }

  finish() {
    this.done.emit();
  }
}
