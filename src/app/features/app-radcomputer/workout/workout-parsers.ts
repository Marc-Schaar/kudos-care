import { Workout, WorkoutStep, makeWorkout } from './workout-models';

/** Name für einen gleichmäßigen Block nach Anteil der FTP (übliche Leistungszonen). */
export function intensityLabel(fraction: number): string {
  if (fraction < 0.56) return 'Locker';
  if (fraction < 0.76) return 'Grundlage';
  if (fraction < 0.91) return 'Tempo';
  if (fraction < 1.06) return 'Schwelle';
  if (fraction < 1.21) return 'VO2max';
  return 'Sprint';
}

/**
 * Liest ein geplantes Training. enduco exportiert .zwo, .erg und .mrc
 * (Kalender → Start/Export → Weitere Optionen).
 */
export function parseWorkoutFile(fileName: string, content: string, ftp: number): Workout {
  const base = fileName.replace(/\.[^.]+$/, '') || 'Training';
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'fit')
    throw new Error(
      'FIT-Workouts kann die App noch nicht lesen. Wähle in enduco beim Export .zwo.',
    );
  if (ext === 'zwo' || content.trimStart().startsWith('<')) return parseZwo(content, ftp, base);
  if (ext === 'erg' || ext === 'mrc' || /\[COURSE HEADER\]/i.test(content))
    return parseErgMrc(content, ftp, base);
  throw new Error('Unbekanntes Format. Unterstützt werden .zwo, .erg und .mrc.');
}

/** Zwift-Workout: Leistungen als Anteil der FTP. */
export function parseZwo(xml: string, ftp: number, fallbackName = 'Training'): Workout {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Die ZWO-Datei ist beschädigt.');
  const root = doc.getElementsByTagName('workout')[0];
  if (!root) throw new Error('In der Datei steht kein Workout.');

  const attr = (el: Element, ...names: string[]): number | null => {
    for (const name of names) {
      const raw = el.getAttribute(name);
      if (raw != null && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
    }
    return null;
  };
  const watts = (fraction: number | null): number | null =>
    fraction == null ? null : Math.round(fraction * ftp);
  const steps: WorkoutStep[] = [];

  for (const el of Array.from(root.children)) {
    const durationS = attr(el, 'Duration') ?? 0;
    switch (el.tagName) {
      case 'Warmup':
      case 'Cooldown':
      case 'Ramp': {
        // Zwift schreibt den Startwert immer als PowerLow, auch beim Ausfahren.
        const from = attr(el, 'PowerLow', 'Power');
        const to = attr(el, 'PowerHigh', 'Power');
        const label =
          el.tagName === 'Warmup' ? 'Einfahren' : el.tagName === 'Cooldown' ? 'Ausfahren' : 'Rampe';
        steps.push({ label, durationS, fromW: watts(from), toW: watts(to) });
        break;
      }
      case 'SteadyState': {
        const low = attr(el, 'PowerLow');
        const high = attr(el, 'PowerHigh');
        const power =
          attr(el, 'Power') ?? (low != null && high != null ? (low + high) / 2 : (low ?? high));
        steps.push({
          label: power == null ? 'Freie Fahrt' : intensityLabel(power),
          durationS,
          fromW: watts(power),
          toW: watts(power),
        });
        break;
      }
      case 'IntervalsT': {
        const repeat = Math.max(1, Math.round(attr(el, 'Repeat') ?? 1));
        const on = watts(attr(el, 'OnPower', 'PowerOnHigh', 'PowerOnLow'));
        const off = watts(attr(el, 'OffPower', 'PowerOffHigh', 'PowerOffLow'));
        for (let i = 1; i <= repeat; i++) {
          steps.push({
            label: `Belastung ${i} von ${repeat}`,
            durationS: attr(el, 'OnDuration') ?? 0,
            fromW: on,
            toW: on,
          });
          steps.push({
            label: `Erholung ${i} von ${repeat}`,
            durationS: attr(el, 'OffDuration') ?? 0,
            fromW: off,
            toW: off,
          });
        }
        break;
      }
      case 'FreeRide':
      case 'MaxEffort':
        steps.push({
          label: el.tagName === 'MaxEffort' ? 'Maximal' : 'Freie Fahrt',
          durationS,
          fromW: null,
          toW: null,
        });
        break;
      default:
        break; // Texteinblendungen und Unbekanntes überspringen
    }
  }
  const name = doc.querySelector('workout_file > name')?.textContent?.trim() || fallbackName;
  return makeWorkout(name, steps);
}

/**
 * ERG (Watt) und MRC (Prozent der FTP): Stützpunkte „Minute Wert“, dazwischen linear.
 * Zwei Punkte zur selben Minute sind ein Sprung.
 */
export function parseErgMrc(text: string, ftp: number, fallbackName = 'Training'): Workout {
  let section: 'none' | 'header' | 'data' = 'none';
  let percent = false;
  let name = fallbackName;
  const points: [number, number][] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const upper = line.toUpperCase();
    if (upper === '[COURSE HEADER]') section = 'header';
    else if (upper === '[COURSE DATA]') section = 'data';
    else if (upper.startsWith('[END')) section = 'none';
    else if (section === 'header') {
      const kv = /^(DESCRIPTION|FILE NAME)\s*=\s*(.+)$/i.exec(line);
      if (kv && name === fallbackName) name = kv[2].trim().replace(/\.(erg|mrc)$/i, '');
      else if (/^MINUTES\s+PERCENT/i.test(line)) percent = true;
      else if (/^MINUTES\s+WATTS/i.test(line)) percent = false;
    } else if (section === 'data' && line) {
      const [minute, value] = line.split(/[\s,;]+/).map(Number);
      if (Number.isFinite(minute) && Number.isFinite(value)) points.push([minute, value]);
    }
  }
  if (points.length < 2) throw new Error('In der Datei stehen keine Trainingsdaten.');

  const watts = (v: number): number => Math.round(percent ? (v / 100) * ftp : v);
  const steps: WorkoutStep[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (t1 <= t0) continue;
    const fromW = watts(v0);
    const toW = watts(v1);
    const durationS = Math.round((t1 - t0) * 60);
    const last = steps[steps.length - 1];
    if (last && fromW === toW && last.fromW === fromW && last.toW === toW) {
      last.durationS += durationS; // gleichmäßige Abschnitte zusammenziehen
    } else {
      steps.push({
        label: fromW === toW ? intensityLabel(fromW / ftp) : 'Rampe',
        durationS,
        fromW,
        toW,
      });
    }
  }
  return makeWorkout(name, steps);
}
