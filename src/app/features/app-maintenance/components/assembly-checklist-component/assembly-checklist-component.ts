import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AssemblyIntervalItem,
  AssemblyPartItem,
  BikeAssembly,
  ComponentGroupCatalog,
  ComponentSlotList,
  ComponentTemplate,
  CreateAssemblyPayload,
  KudoConfidence,
  KudoGroupSuggestion,
  SpareComponent,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';

interface PartRow {
  template: ComponentTemplate;
  include: boolean;
  brand: string;
  modelName: string;
  customWarnKm: number | null;
  /** Gesetzt, wenn Kudo diese Zeile vorbelegt hat — die UI weist sie als Vorschlag aus. */
  kudo: KudoConfidence | null;
  /**
   * Ein bereits vorhandener, ungruppierter Slot mit exakt diesem Template —
   * z.B. ein Altteil, das noch keiner Baugruppe zugeordnet ist. Wenn gesetzt,
   * kann der Nutzer ihn statt eines neuen Teils übernehmen (`reuseExisting`).
   */
  existingSlot: ComponentSlotList | null;
  /** True = existingSlot wird übernommen (Slot umgehängt), statt ein neues Teil anzulegen. */
  reuseExisting: boolean;
  /**
   * Alle bereits *ausgebauten* Teile mit exakt diesem Template (z.B. mehrere
   * historische Felgen auf einem längst ausgemusterten Slot) — Alternative zu
   * `existingSlot` für den Fall, dass gerade nichts (mehr) montiert ist. Nur
   * relevant, wenn `existingSlot` null ist (siehe ngOnInit). Mehr als ein
   * Kandidat ist möglich — es gibt keine zuverlässige Heuristik, "den einen
   * richtigen" zu erraten, deshalb wählt der Nutzer selbst (`selectedSpareId`).
   */
  spareCandidates: SpareComponent[];
  /** Id des in `spareCandidates` ausgewählten Kandidaten (Default: erster). */
  selectedSpareId: number | null;
  /** True = der ausgewählte Kandidat wird reaktiviert, statt ein neues Teil anzulegen. */
  reuseSpare: boolean;
}

interface IntervalRow {
  template: ComponentTemplate;
  include: boolean;
  intervalKm: number | null;
  intervalDays: number | null;
  kudo: KudoConfidence | null;
}

/**
 * Wiederverwendbare Checkliste zum Anlegen EINER Baugruppe: alle Teile +
 * Verbrauchsmaterial der gewählten `group`, gemeinsames Einbaudatum, optionaler
 * Baugruppen-Name. Wird sowohl vom AddAssemblyDialog als auch vom
 * Bike-Setup-Stepper genutzt. Der Aufrufer steuert die Button-Beschriftungen
 * und ob ein "Überspringen" angeboten wird.
 */
@Component({
  selector: 'app-assembly-checklist-component',
  imports: [FormsModule],
  templateUrl: './assembly-checklist-component.html',
  styleUrl: './assembly-checklist-component.css',
})
export class AssemblyChecklistComponent implements OnInit {
  bikeId = input.required<number>();
  group = input.required<ComponentGroupCatalog>();
  saveLabel = input<string>('Baugruppe anlegen');
  showSkip = input<boolean>(false);
  showName = input<boolean>(true);
  /**
   * Soll die neue Baugruppe direkt aufgezogen werden? `null` überlässt die
   * Entscheidung dem Backend (aufziehen, solange die Gruppe frei ist). Der
   * Wechsel-Dialog setzt `true` — dort ist das Aufziehen ja der ganze Zweck.
   */
  activate = input<boolean | null>(null);
  /**
   * Optionale Vorbelegung durch Kudo. Ersetzt die `default_in_group`-Defaults, lässt
   * aber jede Zeile editierbar — der Nutzer soll korrigieren können, nicht bestätigen
   * müssen.
   */
  prefill = input<KudoGroupSuggestion | null>(null);
  /**
   * Ungruppierte Slots des Bikes (z.B. "Ohne Baugruppe"-Alt-Teile). Für jede
   * Teile-Zeile mit exakt passendem Template wird ein Übernehmen-Vorschlag
   * angeboten, statt den Nutzer zur Neuanlage zu zwingen.
   */
  ungroupedSlots = input<ComponentSlotList[]>([]);
  /**
   * Ausgebaute Teile des Bikes (z.B. ein zurückgelegter Laufradsatz-Teil) —
   * für den "vorhandene Komponente übernehmen"-Vorschlag, wenn kein
   * montierter ungruppierter Slot desselben Templates existiert.
   */
  spareComponents = input<SpareComponent[]>([]);

  created = output<BikeAssembly>();
  skipped = output<void>();

  private readonly bikeService = inject(BikeService);

  name = '';
  installedAt = new Date().toISOString().split('T')[0];
  partRows: PartRow[] = [];
  intervalRows: IntervalRow[] = [];

  saving = signal(false);
  error = signal<string | null>(null);

  selectedCount = computed(
    () =>
      this.partRows.filter((r) => r.include).length +
      this.intervalRows.filter((r) => r.include).length,
  );

  /** True, sobald Kudo mindestens eine Zeile dieser Baugruppe vorbelegt hat. */
  hasPrefill = computed(() => {
    const prefill = this.prefill();
    return !!prefill && (prefill.parts.length > 0 || prefill.intervals.length > 0);
  });

  ngOnInit() {
    const g = this.group();
    const prefill = this.prefill();
    const partHints = new Map((prefill?.parts ?? []).map((p) => [p.template_id, p]));
    const intervalHints = new Map((prefill?.intervals ?? []).map((i) => [i.template_id, i]));
    // Pro Template höchstens ein ungruppierter Slot möglich (DB-Constraint) —
    // eine einfache Map reicht, kein Auswahl-Dropdown nötig. Ohne montiertes
    // Teil gibt es nichts Sinnvolles zu übernehmen.
    const existingByTemplate = new Map(
      this.ungroupedSlots()
        .filter((s) => s.mounted_component !== null)
        .map((s) => [s.template, s]),
    );
    // Kann mehrere Kandidaten je Template geben (z.B. mehrere historische
    // Felgen auf einem längst ausgemusterten Slot) — nur relevant, wenn kein
    // montierter ungruppierter Slot existiert (der ist der "näherliegende"
    // Fund, durchgehend montiert).
    const sparesByTemplate = new Map<number, SpareComponent[]>();
    for (const spare of this.spareComponents()) {
      const list = sparesByTemplate.get(spare.template) ?? [];
      list.push(spare);
      sparesByTemplate.set(spare.template, list);
    }

    this.partRows = g.parts.map((t) => {
      const hint = partHints.get(t.id);
      const existingSlot = existingByTemplate.get(t.id) ?? null;
      const spareCandidates = existingSlot ? [] : (sparesByTemplate.get(t.id) ?? []);
      return {
        template: t,
        include: hint ? hint.include : t.default_in_group,
        brand: hint?.brand ?? '',
        modelName: hint?.model_name ?? '',
        customWarnKm: hint?.custom_warn_km ?? null,
        kudo: hint ? hint.confidence : null,
        existingSlot,
        // Fund automatisch vorschlagen (kein Rätselraten für den Nutzer nötig,
        // Template-Match ist eindeutig) — abwählbar, falls doch ein zweites,
        // neues Teil gewünscht ist.
        reuseExisting: existingSlot !== null,
        spareCandidates,
        selectedSpareId: spareCandidates[0]?.id ?? null,
        reuseSpare: spareCandidates.length > 0,
      };
    });
    this.intervalRows = g.consumables.map((t) => {
      const hint = intervalHints.get(t.id);
      return {
        template: t,
        include: hint ? hint.include : t.default_in_group,
        intervalKm: hint?.interval_km ?? t.warn_km,
        intervalDays: hint?.interval_days ?? t.warn_days,
        kudo: hint ? hint.confidence : null,
      };
    });
  }

  /** Kurzlabel für das Kudo-Badge einer Zeile. */
  confidenceLabel(confidence: KudoConfidence): string {
    return { high: 'Kudo', medium: 'Kudo ~', low: 'Kudo ?' }[confidence];
  }

  /** Anzeigename für den Übernehmen-Vorschlag einer bestehenden Komponente. */
  existingLabel(slot: ComponentSlotList): string {
    const comp = slot.mounted_component;
    const name = [comp?.brand, comp?.model_name].filter((v) => !!v).join(' ');
    return name || 'ohne Marke/Modell';
  }

  /** Anzeigename für den Übernehmen-Vorschlag eines ausgebauten Teils. */
  spareLabel(spare: SpareComponent): string {
    const name = [spare.brand, spare.model_name].filter((v) => !!v).join(' ');
    return name || 'ohne Marke/Modell';
  }

  /** Anzeigetext einer Zeile im Auswahlfeld, wenn mehrere Kandidaten existieren. */
  spareOptionLabel(spare: SpareComponent): string {
    const parts = [this.spareLabel(spare)];
    if (spare.prior_wear_km != null) {
      parts.push(`${spare.prior_wear_km} km`);
    }
    if (spare.retired_at) {
      parts.push(`ausgebaut ${spare.retired_at}`);
    }
    return parts.join(' · ');
  }

  buildPayload(): CreateAssemblyPayload {
    const parts: AssemblyPartItem[] = this.partRows.map((r) => {
      if (r.existingSlot && r.reuseExisting) {
        return {
          template_id: r.template.id,
          include: r.include,
          existing_slot_id: r.existingSlot.id,
        };
      }
      if (r.spareCandidates.length > 0 && r.reuseSpare && r.selectedSpareId != null) {
        return {
          template_id: r.template.id,
          include: r.include,
          reuse_component_id: r.selectedSpareId,
        };
      }
      return {
        template_id: r.template.id,
        include: r.include,
        brand: r.brand.trim(),
        model_name: r.modelName.trim(),
        custom_warn_km: r.customWarnKm,
      };
    });
    const intervals: AssemblyIntervalItem[] = this.intervalRows.map((r) => ({
      template_id: r.template.id,
      include: r.include,
      interval_km: r.intervalKm,
      interval_days: r.intervalDays,
    }));
    const payload: CreateAssemblyPayload = {
      group_id: this.group().id,
      name: this.name.trim(),
      installed_at: this.installedAt || undefined,
      parts,
      intervals,
    };
    const activate = this.activate();
    if (activate !== null) {
      payload.activate = activate;
    }
    return payload;
  }

  save() {
    if (this.selectedCount() === 0) {
      this.error.set('Bitte mindestens ein Element auswählen.');
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    this.bikeService.createAssembly(this.bikeId(), this.buildPayload()).subscribe({
      next: (assembly) => {
        this.saving.set(false);
        this.created.emit(assembly);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Anlegen fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }
}
