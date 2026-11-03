import { afterRenderEffect, Component, ElementRef, inject, viewChild } from '@angular/core';
import { NotificationService } from '../../services/notification-service/notification-service';

/**
 * Der Toast läuft als Popover, damit er in der Top Layer des Browsers liegt. Ein modaler
 * `<dialog>` (die Bottom Sheets im Wartungsbereich) liegt dort auch und verdeckte einen
 * normalen Toast samt Fehlermeldung, egal wie hoch der z-index war. Was später in die Top
 * Layer kommt, liegt oben.
 */
@Component({
  selector: 'app-notification-component',
  imports: [],
  templateUrl: './notification-component.html',
  styleUrl: './notification-component.css',
})
export class NotificationComponent {
  public service = inject(NotificationService);

  private readonly toast = viewChild<ElementRef<HTMLElement>>('toast');

  constructor() {
    afterRenderEffect(() => {
      this.toast()?.nativeElement.showPopover?.();
    });
  }
}
