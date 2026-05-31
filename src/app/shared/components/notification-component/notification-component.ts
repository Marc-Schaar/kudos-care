import { Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification-service/notification-service';

@Component({
  selector: 'app-notification-component',
  imports: [],
  templateUrl: './notification-component.html',
  styleUrl: './notification-component.css',
})
export class NotificationComponent {
  public service = inject(NotificationService);
}
