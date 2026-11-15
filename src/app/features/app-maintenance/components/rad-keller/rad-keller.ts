import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';
import { WarnClassPipe } from '../../pipes/warn-class/warn-class-pipe';
import { Board, BoardEntry } from '../../shared/utils/utils';

/**
 * Alles, was sich wechseln lässt, an einer Linie: links am Rad, rechts im Keller. Wer die
 * Seite öffnet, um Laufräder zu tauschen, sieht zuerst, was wo ist — und auf welcher Seite
 * der Knopf dafür sitzt.
 *
 * Rechnet nichts selbst (`buildBoard()`); meldet nur, was angetippt wurde.
 */
@Component({
  selector: 'app-rad-keller',
  imports: [DecimalPipe, Icon, NgTemplateOutlet, RouterLink, WarnClassPipe],
  templateUrl: './rad-keller.html',
  styleUrl: './rad-keller.css',
})
export class RadKeller {
  board = input.required<Board>();
  bikeId = input.required<number>();
  /** Komponenten-Id → Anzeigename, für "wechselt mit". */
  partLabels = input.required<Map<number, string>>();

  switch = output<BoardEntry>();
  link = output<BoardEntry>();
  addSet = output<void>();

  readonly nav = inject(NavigationService);

  /** Einzelteile, die mit diesem Satz mitwechseln (z.B. die passenden Bremsbeläge). */
  linked(entry: BoardEntry): string[] {
    const labels = this.partLabels();
    return entry.members.flatMap((member) =>
      member.linked_component_ids
        .map((id) => labels.get(id))
        .filter((label): label is string => !!label),
    );
  }
}
