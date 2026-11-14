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
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
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

/** Was in einer Spalte der Tafel gewählt ist: ein Teil, ein neues oder nichts. */
type Peg = number | typeof NEW | null;

/**
 * Eine Tafel je Platz, der zum Laufrad passen muss (Beläge, Scheiben): die Laufräder
 * dieser Seite als Spalten, die Teile des Platzes als Zeilen. Je Spalte genau eine Wahl.
 * So sieht man alle Paarungen auf einmal, auch die der anderen Sätze — ein Belag, der
 * schon am anderen Laufrad hängt, oder eine Seite ganz ohne Belag fallen sofort auf.
 */
interface Board {
  slot: ComponentSlot;
  where: string;
  wheels: BikeAssembly[];
  parts: BikeComponent[];
  /** wheel.id → Wahl. Fehlt der Eintrag, ist nichts gekoppelt. */
  pegs: WritableSignal<Record<number, Peg>>;
  /** Neues Teil, das erst beim Speichern angelegt wird. */
  draft: WritableSignal<{ brand: string; model: string } | null>;
}

/** Alles andere (Kette & Co.): nur für die geöffneten Laufräder, wie bisher. */
interface OtherRow {
  slot: ComponentSlot;
  where: string;
  wheel: BikeAssembly;
  parts: BikeComponent[];
  choice: WritableSignal<number | string>;
  newBrand: WritableSignal<string>;
  newModel: WritableSignal<string>;
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
  styleUrl: './links-sheet.css',
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

  boards = signal<Board[]>([]);
  otherRows = signal<OtherRow[]>([]);
  busy = signal(false);
  showOthers = signal(false);
  partnerId = signal<number | null>(null);

  /** Ein einzelnes Laufrad lässt sich mit dem der anderen Seite zum Satz verbinden. */
  partnerOptions = computed(() => {
    const wheels = this.wheels();
    if (wheels.length !== 1) return [];
    return liveAssemblies(this.garage()).filter(
      (assembly) => assembly.group_detail.kind === 'assembly' && assembly.group !== wheels[0].group,
    );
  });

  title = computed(() =>
    this.wheels().length === 1
      ? `Was wechselt mit ${this.wheels()[0].display_name} mit?`
      : 'Was wechselt mit diesem Satz mit?',
  );

  private openedIds = computed(() => new Set(this.wheels().map((wheel) => wheel.id)));

  ngOnInit() {
    const wheels = this.wheels();
    this.partnerId.set(wheels.length === 1 ? (wheels[0].linked_assembly_ids[0] ?? null) : null);

    const placed: { slot: ComponentSlot; where: string }[] = [];
    for (const assembly of this.garage().assemblies) {
      if (assembly.group_detail.kind !== 'area') continue;
      for (const slot of assembly.slots) placed.push({ slot, where: assembly.display_name });
    }
    for (const slot of this.garage().ungrouped_slots) {
      placed.push({ slot, where: 'Ohne Baugruppe' });
    }

    const boards: Board[] = [];
    const others: OtherRow[] = [];
    for (const { slot, where } of placed) {
      if (slot.template_detail.follows_wheel) {
        const board = this.buildBoard(slot, where);
        if (board) boards.push(board);
      } else {
        const row = this.buildOtherRow(slot, where);
        if (row) others.push(row);
      }
    }
    this.boards.set(boards);
    this.otherRows.set(others);
    if (boards.length === 0) this.showOthers.set(true);
  }

  /** Spalten: alle Laufräder dieser Seite, die geöffneten zuerst, dann das aufgezogene. */
  private sideWheels(slot: ComponentSlot): BikeAssembly[] {
    const position = slot.template_detail.position;
    const opened = this.openedIds();
    const rank = (wheel: BikeAssembly) => (opened.has(wheel.id) ? 0 : wheel.is_active ? 1 : 2);
    return liveAssemblies(this.garage())
      .filter(
        (assembly) =>
          assembly.group_detail.kind === 'assembly' &&
          (!position || assembly.group_detail.position === position),
      )
      .sort((a, b) => rank(a) - rank(b));
  }

  private partsOf(slot: ComponentSlot): BikeComponent[] {
    return [...(slot.mounted_component ? [slot.mounted_component] : []), ...slot.spare_components];
  }

  private buildBoard(slot: ComponentSlot, where: string): Board | null {
    const wheels = this.sideWheels(slot);
    if (wheels.length === 0) return null;
    const parts = this.partsOf(slot);
    const pegs: Record<number, Peg> = {};
    for (const wheel of wheels) {
      pegs[wheel.id] =
        parts.find((part) => wheel.linked_component_ids.includes(part.id))?.id ?? null;
    }
    return { slot, where, wheels, parts, pegs: signal(pegs), draft: signal(null) };
  }

  private buildOtherRow(slot: ComponentSlot, where: string): OtherRow | null {
    const position = slot.template_detail.position;
    const wheels = this.wheels();
    const wheel = position
      ? wheels.find((candidate) => candidate.group_detail.position === position)
      : wheels[0];
    if (!wheel) return null;
    const parts = this.partsOf(slot);
    const current = parts.find((part) => wheel.linked_component_ids.includes(part.id));
    return {
      slot,
      where,
      wheel,
      parts,
      choice: signal<number | string>(current?.id ?? NONE),
      newBrand: signal(''),
      newModel: signal(''),
    };
  }

  // ── Tafel ──────────────────────────────────────────────────────────────────

  isOpened(wheel: BikeAssembly): boolean {
    return this.openedIds().has(wheel.id);
  }

  setPeg(board: Board, wheel: BikeAssembly, peg: Peg) {
    board.pegs.update((pegs) => ({ ...pegs, [wheel.id]: peg }));
  }

  /** Mehrdeutige Plätze (vor der Bereinigung zwei gleichnamige) brauchen ihren Ort. */
  showWhere(board: Board): boolean {
    return this.boards().some(
      (other) => other !== board && other.slot.display_name === board.slot.display_name,
    );
  }

  /** Steht am aufgezogenen Laufrad, aber am Rad ist kein Teil montiert. */
  nothingMounted(board: Board): boolean {
    return board.slot.mounted_component === null && board.wheels.some((wheel) => wheel.is_active);
  }

  /** Laufräder ohne Wahl: beim Wechsel auf sie bleibt montiert, was drauf ist. */
  unpegged(board: Board): BikeAssembly[] {
    const pegs = board.pegs();
    return board.wheels.filter((wheel) => pegs[wheel.id] == null);
  }

  /** Dasselbe Teil an mehreren Laufrädern: es bleibt beim Wechsel einfach drauf. */
  shared(board: Board): BikeComponent[] {
    const counts = new Map<number, number>();
    for (const peg of Object.values(board.pegs())) {
      if (typeof peg === 'number') counts.set(peg, (counts.get(peg) ?? 0) + 1);
    }
    return board.parts.filter((part) => (counts.get(part.id) ?? 0) > 1);
  }

  startDraft(board: Board) {
    board.draft.set({ brand: '', model: '' });
  }

  updateDraft(board: Board, field: 'brand' | 'model', value: string) {
    board.draft.update((draft) => (draft ? { ...draft, [field]: value } : draft));
  }

  dropDraft(board: Board) {
    board.draft.set(null);
    board.pegs.update((pegs) => {
      const next: Record<number, Peg> = {};
      for (const [id, peg] of Object.entries(pegs)) next[Number(id)] = peg === NEW ? null : peg;
      return next;
    });
  }

  draftLabel(board: Board): string {
    const draft = board.draft();
    return [draft?.brand.trim(), draft?.model.trim()].filter(Boolean).join(' ') || 'Neues Teil';
  }

  km(part: BikeComponent): string {
    return `${Math.round(part.wear_km).toLocaleString('de-DE')} km`;
  }

  partLabel(part: BikeComponent): string {
    return part.is_mounted
      ? `${part.label} · gerade drauf · ${this.km(part)}`
      : `${part.label} · ${this.km(part)}`;
  }

  // ── Speichern ──────────────────────────────────────────────────────────────

  save() {
    this.busy.set(true);
    const boards = this.boards();
    const others = this.otherRows();

    const createdForBoard = new Map<Board, number>();
    const createdForRow = new Map<OtherRow, number>();
    const creations: Observable<unknown>[] = [];

    for (const board of boards) {
      const draft = board.draft();
      if (!draft || !Object.values(board.pegs()).includes(NEW)) continue;
      creations.push(
        this.create(board.slot, draft.brand, draft.model).pipe(
          map((id) => createdForBoard.set(board, id)),
        ),
      );
    }
    for (const row of others) {
      if (row.choice() !== NEW) continue;
      creations.push(
        this.create(row.slot, row.newBrand(), row.newModel()).pipe(
          map((id) => createdForRow.set(row, id)),
        ),
      );
    }

    (creations.length ? forkJoin(creations) : of([]))
      .pipe(
        switchMap(() => {
          const updates = this.linkUpdates(boards, others, createdForBoard, createdForRow);
          return updates.length ? forkJoin(updates) : of([]);
        }),
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

  private create(slot: ComponentSlot, brand: string, model: string): Observable<number> {
    return this.bikeService
      .addComponent(slot.id, { brand: brand.trim(), model_name: model.trim(), mount: false })
      .pipe(map((component) => component.id));
  }

  /**
   * Je Laufrad die neue Teile-Liste. Was auf keiner Tafel und in keiner Zeile steht,
   * bleibt unangetastet; die anderen Laufräder werden nur geschrieben, wenn sich an
   * ihrer Paarung etwas geändert hat.
   */
  private linkUpdates(
    boards: Board[],
    others: OtherRow[],
    createdForBoard: Map<Board, number>,
    createdForRow: Map<OtherRow, number>,
  ): Observable<unknown>[] {
    const wheels = new Map<number, BikeAssembly>();
    for (const board of boards) for (const wheel of board.wheels) wheels.set(wheel.id, wheel);
    for (const wheel of this.wheels()) wheels.set(wheel.id, wheel);

    const updates: Observable<unknown>[] = [];
    for (const wheel of wheels.values()) {
      const shown = new Set<number>();
      const chosen: number[] = [];

      for (const board of boards) {
        if (!board.wheels.includes(wheel)) continue;
        board.parts.forEach((part) => shown.add(part.id));
        const peg = board.pegs()[wheel.id];
        const id = peg === NEW ? createdForBoard.get(board) : peg;
        if (typeof id === 'number') chosen.push(id);
      }
      for (const row of others) {
        if (row.wheel.id !== wheel.id) continue;
        row.parts.forEach((part) => shown.add(part.id));
        const choice = row.choice();
        const id = choice === NEW ? createdForRow.get(row) : choice;
        if (typeof id === 'number') chosen.push(id);
      }

      const kept = wheel.linked_component_ids.filter((id) => !shown.has(id));
      const next = [...kept, ...chosen];
      const opened = this.isOpened(wheel);
      const unchanged =
        next.length === wheel.linked_component_ids.length &&
        next.every((id) => wheel.linked_component_ids.includes(id));
      if (!opened && unchanged) continue;

      updates.push(this.bikeService.setAssemblyLinks(wheel.id, this.assemblyLinks(wheel), next));
    }
    return updates;
  }

  private assemblyLinks(wheel: BikeAssembly): number[] {
    if (this.wheels().length === 1 && this.isOpened(wheel)) {
      const partner = this.partnerId();
      return partner == null ? [] : [partner];
    }
    return wheel.linked_assembly_ids;
  }
}
