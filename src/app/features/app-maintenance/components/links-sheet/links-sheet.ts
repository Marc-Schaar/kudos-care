import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssembliesResponse,
  BikeAssembly,
  BikeComponent,
  ComponentSlot,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { liveAssemblies } from '../../shared/utils/utils';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

const NONE = 'none';
const NEW = 'new';

interface LinkRow {
  slot: ComponentSlot;
  where: string;
  /** Das Laufrad, an dem die Kopplung hängt: das auf derselben Seite. */
  wheel: BikeAssembly;
  parts: BikeComponent[];
  choice: WritableSignal<number | string>;
  newBrand: WritableSignal<string>;
  newModel: WritableSignal<string>;
  /** Muss zum Laufrad passen (Beläge, Scheiben) statt nur zu können. */
  suggested: boolean;
}

/**
 * "Was wechselt mit, wenn dieses Laufrad ans Rad kommt?" Reifen & Co. sitzen auf dem
 * Laufrad und wechseln ohnehin mit. Hier geht es um das, was am Rad bleibt, aber dazu
 * passen muss: von der Bremse nur der Belag, nicht die ganze Bremse.
 */
@Component({
  selector: 'app-links-sheet',
  imports: [BottomSheet, FormsModule, NgTemplateOutlet],
  templateUrl: './links-sheet.html',
})
export class LinksSheet implements OnInit {
  /** Die Laufräder des Satzes, um den es geht. */
  wheels = input.required<BikeAssembly[]>();
  garage = input.required<AssembliesResponse>();

  closed = output<void>();
  changed = output<void>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly NONE = NONE;
  readonly NEW = NEW;

  rows = signal<LinkRow[]>([]);
  busy = signal(false);
  showOthers = signal(false);
  partnerId = signal<number | null>(null);

  suggestedRows = computed(() => this.rows().filter((row) => row.suggested));
  otherRows = computed(() => this.rows().filter((row) => !row.suggested));

  /** Ein einzelnes Laufrad lässt sich mit dem der anderen Seite zum Satz verbinden. */
  partnerOptions = computed(() => {
    const wheels = this.wheels();
    if (wheels.length !== 1) return [];
    return liveAssemblies(this.garage()).filter(
      (assembly) =>
        assembly.group_detail.kind === 'assembly' && assembly.group !== wheels[0].group,
    );
  });

  title = computed(() =>
    this.wheels().length === 1
      ? `Was wechselt mit ${this.wheels()[0].display_name} mit?`
      : 'Was wechselt mit diesem Satz mit?',
  );

  ngOnInit() {
    const wheels = this.wheels();
    this.partnerId.set(wheels.length === 1 ? (wheels[0].linked_assembly_ids[0] ?? null) : null);

    const rows: LinkRow[] = [];
    for (const assembly of this.garage().assemblies) {
      if (assembly.group_detail.kind !== 'area') continue;
      for (const slot of assembly.slots) {
        const row = this.buildRow(slot, assembly.display_name);
        if (row) rows.push(row);
      }
    }
    for (const slot of this.garage().ungrouped_slots) {
      const row = this.buildRow(slot, 'Ohne Baugruppe');
      if (row) rows.push(row);
    }
    this.rows.set(rows);
    if (this.suggestedRows().length === 0) this.showOthers.set(true);
  }

  private buildRow(slot: ComponentSlot, where: string): LinkRow | null {
    const position = slot.template_detail.position;
    const wheels = this.wheels();
    const wheel = position
      ? wheels.find((candidate) => candidate.group_detail.position === position)
      : wheels[0];
    if (!wheel) return null;

    const parts = [
      ...(slot.mounted_component ? [slot.mounted_component] : []),
      ...slot.spare_components,
    ];
    const current = parts.find((part) => wheel.linked_component_ids.includes(part.id));
    return {
      slot,
      where,
      wheel,
      parts,
      choice: signal<number | string>(current?.id ?? NONE),
      newBrand: signal(''),
      newModel: signal(''),
      suggested: slot.template_detail.follows_wheel,
    };
  }

  partLabel(part: BikeComponent): string {
    const km = `${Math.round(part.wear_km).toLocaleString('de-DE')} km`;
    return part.is_mounted ? `${part.label} · gerade drauf · ${km}` : `${part.label} · ${km}`;
  }

  save() {
    this.busy.set(true);
    const rows = this.rows();
    const creations: Observable<unknown>[] = [];
    const created = new Map<LinkRow, number>();

    for (const row of rows) {
      if (row.choice() !== NEW) continue;
      creations.push(
        this.bikeService
          .addComponent(row.slot.id, {
            brand: row.newBrand().trim(),
            model_name: row.newModel().trim(),
            mount: false,
          })
          .pipe(
            switchMap((component) => {
              created.set(row, component.id);
              return of(component);
            }),
          ),
      );
    }

    (creations.length ? forkJoin(creations) : of([]))
      .pipe(
        switchMap(() =>
          forkJoin(
            this.wheels().map((wheel) => {
              const componentIds = rows
                .filter((row) => row.wheel.id === wheel.id)
                .map((row) => created.get(row) ?? row.choice())
                .filter((choice): choice is number => typeof choice === 'number');
              return this.bikeService.setAssemblyLinks(
                wheel.id,
                this.assemblyLinks(wheel),
                componentIds,
              );
            }),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notifications.show('Gespeichert. Das wechselt ab jetzt mit.', 'success');
          this.changed.emit();
        },
        error: () => this.busy.set(false),
      });
  }

  private assemblyLinks(wheel: BikeAssembly): number[] {
    if (this.wheels().length === 1) {
      const partner = this.partnerId();
      return partner == null ? [] : [partner];
    }
    return wheel.linked_assembly_ids;
  }
}
