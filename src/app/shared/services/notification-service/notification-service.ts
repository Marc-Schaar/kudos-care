import { Injectable, signal } from '@angular/core';

export interface AppNotification {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  notification = signal<AppNotification | null>(null);

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.notification.set({ message, type });
    setTimeout(() => this.notification.set(null), 3000);
  }
}
