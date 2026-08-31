import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmailPromptDialog } from '../shared/components/email-prompt-dialog/email-prompt-dialog';
import { NotificationComponent } from '../shared/components/notification-component/notification-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, EmailPromptDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('kudos-care');
}
