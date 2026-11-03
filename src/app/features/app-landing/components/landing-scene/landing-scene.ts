import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  BAR,
  BB,
  CHAIN_PATH,
  CHAIN_PITCH,
  COG_R,
  CRANK_LENGTH,
  FORK,
  FRAME_TUBES,
  FRONT,
  GROUND_Y,
  HOOD,
  LOWER_PULLEY,
  REAR,
  RING_R,
  SADDLE,
  STEM,
  UPPER_PULLEY,
  VIEW_H,
  VIEW_W,
  ridge,
  spokes,
} from './bike-geometry';

const RIDGE_W = 2400;

/**
 * Eine Hälfte der Bühne: Höhenlinien, Fahrbahn, Rad, Leitpfosten und Wortmarke, im Stil einer
 * technischen Zeichnung. Die Seite stempelt sie zweimal (`dark` und `paper`) und schneidet die
 * obere an der Trennlinie ab. Die Komponente zeichnet nur; bewegt wird sie von `Landingpage`,
 * die die `data-*`-Elemente direkt ansteuert, ohne Change Detection pro Scroll-Frame.
 */
@Component({
  selector: 'app-landing-scene',
  templateUrl: './landing-scene.html',
  styleUrl: './landing-scene.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"skin-" + skin()' },
})
export class LandingScene {
  readonly skin = input.required<'dark' | 'paper'>();

  readonly view = `0 0 ${VIEW_W} ${VIEW_H}`;
  readonly ridgeView = `0 0 ${RIDGE_W} 400`;
  readonly ridges = [
    ridge(RIDGE_W, 150, 44, 0.4),
    ridge(RIDGE_W, 178, 40, 0.5),
    ridge(RIDGE_W, 208, 36, 0.62),
    ridge(RIDGE_W, 262, 30, 2.3),
    ridge(RIDGE_W, 290, 26, 2.42),
  ];

  readonly groundY = GROUND_Y;
  readonly rear = REAR;
  readonly front = FRONT;
  readonly bb = BB;
  readonly ringR = RING_R;
  readonly cogR = COG_R;
  readonly crankEnd = BB.x + CRANK_LENGTH;
  readonly upper = UPPER_PULLEY;
  readonly lower = LOWER_PULLEY;
  readonly chain = CHAIN_PATH;
  readonly pitch = CHAIN_PITCH;

  readonly tubes = FRAME_TUBES;
  readonly fork = FORK;
  readonly saddle = SADDLE;
  readonly stem = STEM;
  readonly bar = BAR;
  readonly hood = HOOD;

  readonly rearSpokes = spokes(REAR.x, REAR.y, 24, 0.72);
  readonly frontSpokes = spokes(FRONT.x, FRONT.y, 20, 0.52);
  readonly cogs = [58, 50, 42, 34, 28, 22];
  readonly chainringBolts = [0, 90, 180, 270];
  readonly posts = [0, 1, 2, 3];
}
