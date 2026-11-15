import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification-service/notification-service';
import {
  AssembliesResponse,
  BikeAssembly,
  ComponentGroupCatalog,
  CreateAssemblyPayload,
} from '../../models/maintenance.models';
import { BikeService } from '../../services/bike-service/bike-service';
import { buildBoard, dayParam, todayIso } from '../../shared/utils/utils';
import { Icon } from '../../../../shared/components/icon/icon';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';

/**
 * Neuer Laufradsatz: ein Name, welche Seiten, fertig. Legt beide Laufräder mit den üblichen
 * Teilen an und koppelt sie. Marken und Modelle trägt man danach an den Teilen nach — wer
 * einen Satz anlegt, will erstmal wechseln können, nicht zwölf Felder ausfüllen.
 */
@Component({
  selector: 'app-wheelset-sheet',
  imports: [BottomSheet, FormsModule, Icon, NgTemplateOutlet],
  templateUrl: './wheelset-sheet.html',
  styleUrl: './wheelset-sheet.css',
})
export class WheelsetSheet {
  bikeId = input.required<number>();
  garage = input.required<AssembliesResponse>();

  closed = output<void>();
  /** Die neuen Laufräder — damit die Seite gleich fragen kann, was mitwechselt. */
  created = output<BikeAssembly[]>();

  private readonly bikeService = inject(BikeService);
  private readonly notifications = inject(NotificationService);

  readonly today = todayIso();
  name = signal('');
  front = signal(true);
  rear = signal(true);
  mountNow = signal(false);
  installedAt = signal(this.today);
  busy = signal(false);

  private group(position: 'front' | 'rear'): ComponentGroupCatalog | undefined {
    return this.garage().available_groups.find(
      (group) => group.kind === 'assembly' && group.position === position,
    );
  }

  /** Noch gar kein Laufrad am Rad: dann ist der neue Satz sowieso der aktive. */
  hasWheelOnBike = computed(() =>
    this.garage().assemblies.some((assembly) => assembly.group_detail.kind === 'assembly'),
  );

  // ── Vorschau an der Linie ──────────────────────────────────────────────────

  /** Wo der neue Satz landet: ans Rad, wenn dort keiner ist oder er gleich drauf soll. */
  landsOnBike = computed(() => !this.hasWheelOnBike() || this.mountNow());
  /** Erst animieren, wenn jemand "Gleich aufziehen" angefasst hat, nicht beim Öffnen. */
  moved = signal(false);

  previewName = computed(() => this.name().trim() || 'Neuer Satz');
  previewSides = computed(() =>
    [this.front() && 'Vorderrad', this.rear() && 'Hinterrad'].filter(Boolean).join(' und '),
  );

  /** Der Satz, der gerade am Rad ist — er wandert beim Aufziehen in den Keller. */
  currentSet = computed(
    () =>
      buildBoard(this.garage().assemblies, this.garage().parked_assemblies).rad.find(
        (entry) => entry.kind === 'wheelset',
      )?.name ?? null,
  );

  setMountNow(value: boolean) {
    this.moved.set(true);
    this.mountNow.set(value);
  }

  canSave = computed(() => this.name().trim().length > 0 && (this.front() || this.rear()));

  private payload(group: ComponentGroupCatalog, side: string): CreateAssemblyPayload {
    return {
      group_id: group.id,
      name: `${this.name().trim()} ${side}`,
      installed_at: this.installedAt(),
      parts: group.parts.map((template) => ({
        template_id: template.id,
        include: template.default_in_group,
      })),
      intervals: group.consumables.map((template) => ({
        template_id: template.id,
        include: template.default_in_group,
      })),
    };
  }

  save() {
    if (!this.canSave()) return;
    this.busy.set(true);

    const front = this.front() ? this.group('front') : undefined;
    const rear = this.rear() ? this.group('rear') : undefined;

    const createFront: Observable<BikeAssembly | null> = front
      ? this.bikeService.createAssembly(this.bikeId(), this.payload(front, 'vorne'))
      : of(null);

    createFront
      .pipe(
        switchMap((frontWheel) =>
          rear
            ? this.bikeService
                .createAssembly(this.bikeId(), {
                  ...this.payload(rear, 'hinten'),
                  ...(frontWheel ? { linked_assembly_ids: [frontWheel.id] } : {}),
                })
                .pipe(switchMap((rearWheel) => of([frontWheel, rearWheel])))
            : of([frontWheel]),
        ),
        switchMap((wheels) => {
          const created = wheels.filter((wheel): wheel is BikeAssembly => wheel !== null);
          if (!this.mountNow() || created.length === 0) return of(created);
          return this.bikeService
            .activateAssembly(created[0].id, dayParam(this.installedAt()))
            .pipe(switchMap(() => of(created)));
        }),
      )
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.notifications.show(`${this.name().trim()} ist angelegt.`, 'success');
          this.created.emit(created);
        },
        error: () => this.busy.set(false),
      });
  }
}
