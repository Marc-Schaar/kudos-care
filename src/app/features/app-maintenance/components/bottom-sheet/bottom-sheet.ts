import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Der eine Rahmen für alles, was über einer Seite aufgeht: auf dem Handy ein Blatt von
 * unten, ab Tablet-Breite mittig. Baut auf dem nativen `<dialog>` auf, damit Fokus-Falle,
 * Escape und das Sperren des Hintergrunds nicht von Hand nachgebaut werden müssen.
 *
 * Wer es einblendet, entscheidet per `@if`; geschlossen wird über `closed`.
 */
@Component({
  selector: 'app-bottom-sheet',
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.css',
})
export class BottomSheet implements AfterViewInit {
  title = input.required<string>();
  closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit() {
    this.dialog().nativeElement.showModal();
  }

  /** Ein Klick auf den Hintergrund trifft den Dialog selbst, nicht sein Innenleben. */
  onDialogClick(event: MouseEvent) {
    if (event.target === this.dialog().nativeElement) {
      this.closed.emit();
    }
  }

  onCancel(event: Event) {
    event.preventDefault();
    this.closed.emit();
  }
}
