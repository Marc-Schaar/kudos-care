export interface WorkoutStep {
  label: string;
  durationS: number;
  /** Zielleistung am Anfang und Ende des Schritts in Watt; `null` = frei fahren. Ungleich = Rampe. */
  fromW: number | null;
  toW: number | null;
}

export interface Workout {
  name: string;
  steps: WorkoutStep[];
  totalS: number;
}

export type WorkoutStatus = 'none' | 'ready' | 'running' | 'done';
export type Compliance = 'none' | 'low' | 'ok' | 'high';

export function makeWorkout(name: string, steps: WorkoutStep[]): Workout {
  const usable = steps.filter((s) => s.durationS > 0);
  if (!usable.length) throw new Error('In der Datei stehen keine Trainingsschritte.');
  return { name, steps: usable, totalS: usable.reduce((sum, s) => sum + s.durationS, 0) };
}
