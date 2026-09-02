import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssemblyIntervalItem,
  AssemblyPartItem,
  ComponentGroupCatalog,
  ComponentSlotList,
  ComponentTemplate,
  CreateAssemblyPayload,
  SpareComponent,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';

/** Ein Schritt = genau ein Teil bzw. ein Verbrauchsmaterial. */
export interface WizardStep {
  template: ComponentTemplate;
  kind: 'part' | 'interval';
  include: boolean;

  // Nur für kind === 'part'
  brand: string;
  modelName: string;
  customWarnKm: number | null;
  /** Vorhandener, ungruppierter Slot mit diesem Template (durchgehend montiert). */
  existingSlot: ComponentSlotList | null;
  reuseExisting: boolean;
  /** Bereits ausgebaute Teile desselben Templates — mehrere möglich. */
  spareCandidates: SpareComponent[];
  selectedSpareId: number | null;
  reuseSpare: boolean;

  // Nur für kind === 'interval'
  intervalKm: number | null;
  intervalDays: number | null;
}

/**
 * Assistent zum Anlegen einer Baugruppe: ein Teil pro Schritt.
 *
 * Loest den frueheren Dialog ab, der alle Templates einer Gruppe gleichzeitig
 * als Zeile mit drei Eingabefeldern zeigte — bei "Laufrad hinten" acht Zeilen
 * mit bis zu 40 Feldern auf einmal, auf dem Handy unbenutzbar.
 *
 * Aufbau: Gruppe waehlen → Grunddaten → je ein Schritt pro Teil → Zusammenfassung.
 * Jeder Teil-Schritt stellt genau eine Frage ("ist das dran?") mit zwei grossen
 * Flaechen; Marke, Modell und Lebensdauer sind optional und stehen darunter, wenn
 * die Antwort ja lautet. Der Katalog-Default (`default_in_group`) bestimmt die
 * Vorauswahl, sodass Durchtippen ohne Nachdenken zu einem sinnvollen Ergebnis
 * fuehrt.
 *
 * Bewusst NICHT im Bike-Setup-Stepper verwendet: der laeuft schon eine Baugruppe
 * pro Schritt: dort ein Teil pro Schritt zu erzwingen ergaebe bei acht Gruppen
 * ueber achtzig Schritte fuer ein neues Rad.
 */
@Component({
  selector: 'app-assembly-wizard-component',
  imports: [FormsModule],
  templateUrl: './assembly-wizard-component.html',
  styleUrl: './assembly-wizard-component.css',
})
export class AssemblyWizardComponent {
  bikeId = input.required<number>();
  bikeType = input.required<string>();
  availableGroups = input<ComponentGroupCatalog[]>([]);
  ungroupedSlots = input<ComponentSlotList[]>([]);
  spareComponents = input<SpareComponent[]>([]);

  close = output<void>();
  created = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notify = inject(NotificationService);

  readonly group = signal<ComponentGroupCatalog | null>(null);
  readonly steps = signal<WizardStep[]>([]);
  /** -1 = Grunddaten, 0..n-1 = Teile-Schritte, n = Zusammenfassung. */
  readonly index = signal(-1);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  name = '';
  installedAt = new Date().toISOString().split('T')[0];

  readonly current = computed<WizardStep | null>(() => {
    const i = this.index();
    return i >= 0 && i < this.steps().length ? this.steps()[i] : null;
  });

  readonly onBasics = computed(() => this.group() !== null && this.index() === -1);
  readonly onSummary = computed(() => this.group() !== null && this.index() >= this.steps().length);
  readonly selectedCount = computed(() => this.steps().filter((s) => s.include).length);
  readonly selectedSteps = computed(() => this.steps().filter((s) => s.include));

  /** 0..1 für den Fortschrittsbalken; Grunddaten und Zusammenfassung zählen mit. */
  readonly progress = computed(() => {
    const total = this.steps().length + 1;
    if (total <= 1) return 0;
    return Math.min(1, Math.max(0, (this.index() + 1) / total));
  });

  pickGroup(group: ComponentGroupCatalog) {
    this.group.set(group);
    this.name = '';
    this.index.set(-1);
    this.steps.set(this.buildSteps(group));
  }

  private buildSteps(group: ComponentGroupCatalog): WizardStep[] {
    // Höchstens ein ungruppierter Slot je Template (DB-Constraint), daher Map.
    const existingByTemplate = new Map(
      this.ungroupedSlots()
        .filter((s) => s.mounted_component !== null)
        .map((s) => [s.template, s]),
    );
    const sparesByTemplate = new Map<number, SpareComponent[]>();
    for (const spare of this.spareComponents()) {
      const list = sparesByTemplate.get(spare.template) ?? [];
      list.push(spare);
      sparesByTemplate.set(spare.template, list);
    }

    const parts: WizardStep[] = group.parts.map((t) => {
      const existingSlot = existingByTemplate.get(t.id) ?? null;
      const spareCandidates = existingSlot ? [] : (sparesByTemplate.get(t.id) ?? []);
      return {
        template: t,
        kind: 'part' as const,
        include: t.default_in_group,
        brand: '',
        modelName: '',
        customWarnKm: null,
        existingSlot,
        reuseExisting: existingSlot !== null,
        spareCandidates,
        selectedSpareId: spareCandidates[0]?.id ?? null,
        reuseSpare: spareCandidates.length > 0,
        intervalKm: null,
        intervalDays: null,
      };
    });

    const intervals: WizardStep[] = group.consumables.map((t) => ({
      template: t,
      kind: 'interval' as const,
      include: t.default_in_group,
      brand: '',
      modelName: '',
      customWarnKm: null,
      existingSlot: null,
      reuseExisting: false,
      spareCandidates: [],
      selectedSpareId: null,
      reuseSpare: false,
      intervalKm: t.warn_km,
      intervalDays: t.warn_days,
    }));

    return [...parts, ...intervals];
  }

  /** Ja/Nein beantworten und gleich weiter — der übliche Weg durch den Assistenten. */
  answer(include: boolean) {
    const step = this.current();
    if (!step) return;
    step.include = include;
    this.next();
  }

  next() {
    this.index.update((i) => Math.min(i + 1, this.steps().length));
  }

  back() {
    if (this.index() <= -1) {
      // Vor den Grunddaten liegt die Gruppenauswahl.
      this.group.set(null);
      this.steps.set([]);
      return;
    }
    this.index.update((i) => i - 1);
  }

  /** Von der Zusammenfassung aus gezielt einen Schritt korrigieren. */
  jumpTo(step: WizardStep) {
    const i = this.steps().indexOf(step);
    if (i >= 0) this.index.set(i);
  }

  spareLabel(spare: SpareComponent): string {
    const name = [spare.brand, spare.model_name].filter((v) => !!v).join(' ');
    return name || 'ohne Marke/Modell';
  }

  spareOptionLabel(spare: SpareComponent): string {
    const parts = [this.spareLabel(spare)];
    if (spare.prior_wear_km != null) parts.push(`${spare.prior_wear_km} km`);
    if (spare.retired_at) parts.push(`ausgebaut ${spare.retired_at}`);
    return parts.join(' · ');
  }

  existingLabel(slot: ComponentSlotList): string {
    const comp = slot.mounted_component;
    const name = [comp?.brand, comp?.model_name].filter((v) => !!v).join(' ');
    return name || 'ohne Marke/Modell';
  }

  /** Kurzfassung einer Zeile für die Zusammenfassung. */
  summaryDetail(step: WizardStep): string {
    if (step.kind === 'interval') {
      const parts = [];
      if (step.intervalKm) parts.push(`${step.intervalKm} km`);
      if (step.intervalDays) parts.push(`${step.intervalDays} Tage`);
      return parts.join(' · ') || 'ohne Intervall';
    }
    if (step.existingSlot && step.reuseExisting) {
      return `übernommen: ${this.existingLabel(step.existingSlot)}`;
    }
    if (step.reuseSpare && step.selectedSpareId != null) {
      const spare = step.spareCandidates.find((s) => s.id === step.selectedSpareId);
      return spare ? `reaktiviert: ${this.spareLabel(spare)}` : 'reaktiviert';
    }
    const name = [step.brand, step.modelName].filter((v) => !!v.trim()).join(' ');
    return name || 'ohne Marke/Modell';
  }

  private buildPayload(): CreateAssemblyPayload {
    const parts: AssemblyPartItem[] = this.steps()
      .filter((s) => s.kind === 'part')
      .map((s) => {
        if (s.existingSlot && s.reuseExisting) {
          return {
            template_id: s.template.id,
            include: s.include,
            existing_slot_id: s.existingSlot.id,
          };
        }
        if (s.spareCandidates.length > 0 && s.reuseSpare && s.selectedSpareId != null) {
          return {
            template_id: s.template.id,
            include: s.include,
            reuse_component_id: s.selectedSpareId,
          };
        }
        return {
          template_id: s.template.id,
          include: s.include,
          brand: s.brand.trim(),
          model_name: s.modelName.trim(),
          custom_warn_km: s.customWarnKm,
        };
      });

    const intervals: AssemblyIntervalItem[] = this.steps()
      .filter((s) => s.kind === 'interval')
      .map((s) => ({
        template_id: s.template.id,
        include: s.include,
        interval_km: s.intervalKm,
        interval_days: s.intervalDays,
      }));

    return {
      group_id: this.group()!.id,
      name: this.name.trim(),
      installed_at: this.installedAt || undefined,
      parts,
      intervals,
    };
  }

  save() {
    if (this.selectedCount() === 0) {
      this.error.set('Bitte mindestens ein Element auswählen.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    this.bikeService.createAssembly(this.bikeId(), this.buildPayload()).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.show(`Baugruppe „${this.group()!.name}" angelegt.`, 'success');
        this.created.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Anlegen fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }
}
