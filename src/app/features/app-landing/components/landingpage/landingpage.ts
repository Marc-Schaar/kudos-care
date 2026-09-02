import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../../shared/services/navigation-service/navigation-service';

/**
 * Öffentliche Landing-Page (`/landingpage`, ohne authGuard).
 *
 * Die Scroll-Animationen hängen an zwei Signalen, beide per rAF-gedrosseltem
 * Scroll-Listener gesetzt:
 *  - `pageProgress` (0..1 über die gesamte Seite) — nur für Nebeneffekte.
 *  - `stageProgress` (0..1, solange die Kurbel-Sektion `#how` im Sticky-Bereich
 *    gepinnt ist) — treibt Kurbeldrehung, Kettenlauf und den 3D-Tilt. Lokaler
 *    Fortschritt statt globalem, damit die Bewegung über den gepinnten Abschnitt
 *    voll ausschlägt statt nur einen kleinen Ausschnitt zu durchlaufen.
 *
 * Die eigentliche Bewegung passiert in CSS über die gebundenen Custom-Properties.
 * Abschnitts-Einblendungen laufen über einen IntersectionObserver (`is-in`).
 */
@Component({
  selector: 'app-landingpage',
  imports: [RouterLink],
  templateUrl: './landingpage.html',
  styleUrl: './landingpage.css',
})
export class Landingpage implements AfterViewInit, OnDestroy {
  readonly nav = inject(NavigationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** 0..1 – Scroll-Fortschritt über die gesamte Seite. */
  readonly pageProgress = signal(0);

  /** 0..1 – Fortschritt durch den gepinnten Kurbel-Abschnitt. */
  readonly stageProgress = signal(0);

  /** Antriebs-/Laufrad-Rotation in Grad — 2,5 Umdrehungen über den gepinnten Abschnitt. */
  readonly crankDeg = computed(() => this.stageProgress() * 900);
  /** 3D-Kippwinkel um X: von leicht nach hinten (32°) bis leicht nach vorn (-14°). */
  readonly tiltX = computed(() => 32 - this.stageProgress() * 46);
  /** Leichte Drehung um Z, damit der Tilt räumlich wirkt. */
  readonly tiltZ = computed(() => this.stageProgress() * 20 - 8);

  private rafId = 0;
  private stageEl: HTMLElement | null = null;
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    this.stageEl = this.host.nativeElement.querySelector<HTMLElement>('.lp-stage');
    this.updateProgress();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });

    const targets = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-reveal]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          this.observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    targets.forEach((el) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    this.observer?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /** Weicher Sprung zu einem Anker-Abschnitt (Button „So funktioniert's"). */
  scrollToId(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private readonly onScroll = (): void => {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.updateProgress();
    });
  };

  private updateProgress(): void {
    const doc = document.documentElement;
    const pageMax = doc.scrollHeight - window.innerHeight;
    this.pageProgress.set(pageMax > 0 ? clamp01(window.scrollY / pageMax) : 0);

    if (this.stageEl) {
      const rect = this.stageEl.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      this.stageProgress.set(travel > 0 ? clamp01(-rect.top / travel) : 0);
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
