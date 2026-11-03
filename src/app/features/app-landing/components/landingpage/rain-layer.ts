/**
 * Der Regen. Ein Canvas über der ganzen Bühne, aber sichtbar nur in der dunklen Hälfte: das
 * Papier liegt darüber, deshalb endet der Regen hart an der Trennlinie, ohne dass hier jemand
 * rechnen müsste. Gezeichnet wird trotzdem nur links davon, der Rest wäre verschenkt.
 */

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  /** Nah = heller und länger, fern = schwächer. Zwei Stufen reichen für die Tiefe. */
  near: boolean;
}

interface Splash {
  x: number;
  y: number;
  age: number;
}

const MAX_DPR = 1.5;
const SPLASH_MS = 150;
/** Ab hier ist der Regen voll: passt zur Kappe der Formel bei 7,5 mm/h. */
const FULL_RAIN_MM_H = 7.5;

export class RainLayer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    // Dichte an die Fläche koppeln, sonst wirkt ein Telefon wie ein Wolkenbruch.
    const count = Math.round(Math.min(640, (width * height) / 1900));
    this.drops = Array.from({ length: count }, () => this.spawn(true));
  }

  private spawn(anywhere: boolean): Drop {
    const near = Math.random() < 0.38;
    return {
      x: Math.random() * this.width * 1.2 - this.width * 0.1,
      y: anywhere ? Math.random() * this.height : -Math.random() * this.height * 0.3,
      speed: (near ? 1500 : 980) + Math.random() * 320,
      length: (near ? 38 : 20) + Math.random() * 16,
      near,
    };
  }

  /**
   * Ein Frame.
   * @param dt      Millisekunden seit dem letzten Frame, 0 friert den Regen ein.
   * @param rain    mm/h, bestimmt die Anzahl der Tropfen.
   * @param wind    km/h, kippt die Fallrichtung.
   * @param edgeX   Trennlinie in px, Tropfen rechts davon werden nicht gezeichnet.
   * @param edgeY   Trennlinie in px, von oben gesehen (nur Telefon).
   * @param groundY Höhe der Fahrbahn in px, dort enden die Tropfen.
   */
  draw(
    dt: number,
    rain: number,
    wind: number,
    edgeX: number,
    edgeY: number,
    groundY: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const amount = Math.min(1, rain / FULL_RAIN_MM_H);
    if (amount <= 0.001) return;

    const active = Math.ceil(this.drops.length * Math.pow(amount, 0.8));
    const slant = Math.min(0.55, wind / 110);
    const seconds = dt / 1000;

    const far = new Path2D();
    const near = new Path2D();

    for (let i = 0; i < active; i++) {
      const drop = this.drops[i];
      drop.y += drop.speed * seconds;
      drop.x -= drop.speed * slant * seconds;

      if (drop.y > groundY) {
        if (dt > 0 && drop.x < edgeX && this.splashes.length < 80 && Math.random() < 0.5) {
          this.splashes.push({ x: drop.x, y: groundY, age: 0 });
        }
        Object.assign(drop, this.spawn(false));
      } else if (drop.x < -60) {
        drop.x += this.width * 1.2;
      }

      if (drop.x > edgeX + 30 || drop.y - drop.length > edgeY) continue;
      const path = drop.near ? near : far;
      path.moveTo(drop.x, drop.y);
      path.lineTo(drop.x + drop.length * slant, Math.min(groundY, drop.y) - drop.length);
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(160, 214, 250, 0.34)';
    ctx.lineWidth = 1;
    ctx.stroke(far);
    ctx.strokeStyle = 'rgba(205, 234, 255, 0.78)';
    ctx.lineWidth = 1.5;
    ctx.stroke(near);

    ctx.strokeStyle = 'rgba(205, 234, 255, 0.5)';
    ctx.lineWidth = 1;
    this.splashes = this.splashes.filter((splash) => {
      splash.age += dt;
      if (splash.age >= SPLASH_MS) return false;
      const grown = splash.age / SPLASH_MS;
      ctx.beginPath();
      ctx.ellipse(splash.x, splash.y, 2 + grown * 7, 1 + grown * 2, 0, Math.PI, 2 * Math.PI);
      ctx.globalAlpha = 1 - grown;
      ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    });
  }
}
