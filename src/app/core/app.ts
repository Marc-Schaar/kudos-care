import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AiConsentDialog } from '../shared/components/ai-consent-dialog/ai-consent-dialog';
import { EmailPromptDialog } from '../shared/components/email-prompt-dialog/email-prompt-dialog';
import { LegalLinks } from '../shared/components/legal-links/legal-links';
import { isAppRoute, MainNav } from '../shared/components/main-nav/main-nav';
import { NotificationComponent } from '../shared/components/notification-component/notification-component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NotificationComponent,
    EmailPromptDialog,
    AiConsentDialog,
    MainNav,
    LegalLinks,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly path = signal(this.router.url);

  protected readonly title = signal('kudos-care');
  protected readonly showFooter = computed(() => this.path().split(/[?#]/)[0] !== '/');
  protected readonly inApp = computed(() => isAppRoute(this.path()));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.path.set(event.urlAfterRedirects));
  }
}
