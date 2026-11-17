import { Injectable, inject, signal } from '@angular/core';

import { SettingsStore } from './settings-store';

export type Tone = 'tick' | 'go' | 'info' | 'alert';

interface ToneShape {
  hz: number;
  ms: number;
  gapMs: number;
  count: number;
}

const TONES: Record<Tone, ToneShape> = {
  tick: { hz: 880, ms: 90, gapMs: 0, count: 1 }, // Countdown
  go: { hz: 1320, ms: 420, gapMs: 0, count: 1 }, // Start, neuer Schritt
  info: { hz: 990, ms: 110, gapMs: 90, count: 2 }, // Hinweis
  alert: { hz: 440, ms: 160, gapMs: 90, count: 3 }, // Warnung
};

/**
 * Klingel: Grundton im Bereich, in dem Telefonlautsprecher am lautesten sind (2–4 kHz),
 * dazu unharmonische Teiltöne wie bei einer Glockenschale. Der leicht verstimmte zweite
 * Grundton lässt sie schwebend nachklingen statt wie ein Piepton.
 */
const BELL_HZ = 2100;
const BELL_PARTIALS = [
  { ratio: 1, gain: 0.5, decay: 1.4 },
  { ratio: 1.004, gain: 0.3, decay: 1.2 },
  { ratio: 2.32, gain: 0.25, decay: 0.7 },
  { ratio: 4.25, gain: 0.12, decay: 0.35 },
];

/**
 * Sprach- und Tonhinweise. Je nach Einstellung spricht die App (Sprachausgabe des
 * Browsers), piept nur oder bleibt still. Fehlt die Sprachausgabe, fällt sie auf Töne zurück.
 */
@Injectable({ providedIn: 'root' })
export class AudioFeedback {
  private readonly settings = inject(SettingsStore);
  private readonly synth: SpeechSynthesis | null =
    typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  private ctx: AudioContext | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private speechUnlocked = false;

  readonly speechSupported = this.synth != null;
  /** Letzter Hinweis als Text, unabhängig davon, ob er gesprochen oder gepiept wurde. */
  readonly lastMessage = signal('');

  /** Aus einem Tipp heraus aufrufen: iOS gibt Ton erst nach einer Nutzeraktion frei. */
  unlock(): void {
    if (this.settings.value().audio === 'off') return;
    this.context();
    if (this.synth && !this.speechUnlocked) {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0;
      this.synth.speak(silent);
      this.speechUnlocked = true;
    }
  }

  /** Spricht den Text oder spielt, wenn nur Töne gewünscht sind, den passenden Ton. */
  say(text: string, opts: { urgent?: boolean; tone?: Tone } = {}): void {
    const mode = this.settings.value().audio;
    if (mode === 'off') return;
    this.lastMessage.set(text);
    if (mode === 'speech' && this.synth) {
      if (opts.urgent) this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.05;
      const voice = this.germanVoice();
      if (voice) utterance.voice = voice;
      this.synth.speak(utterance);
      return;
    }
    this.play(opts.tone ?? 'info');
  }

  tone(kind: Tone): void {
    if (this.settings.value().audio !== 'off') this.play(kind);
  }

  /**
   * Fahrradklingel: zwei Anschläge einer Glocke. Klingelt auch, wenn die Hinweise aus sind,
   * denn sie ist ein Tipp, keine Ansage. Läuft über Web Audio und mischt sich deshalb mit
   * Musik, statt sie anzuhalten; auf dem iPhone bleibt sie dafür im Stummmodus still.
   */
  bell(): void {
    const ctx = this.context();
    if (!ctx) return;
    // Laut, aber ohne Übersteuern: mehrere Teiltöne addieren sich.
    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -12;
    out.ratio.value = 6;
    out.connect(ctx.destination);
    const start = ctx.currentTime + 0.01;
    for (const strike of [0, 0.16]) {
      for (const p of BELL_PARTIALS) {
        const at = start + strike;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = BELL_HZ * p.ratio;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(p.gain, at + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + p.decay);
        osc.connect(gain).connect(out);
        osc.start(at);
        osc.stop(at + p.decay + 0.05);
      }
    }
  }

  private germanVoice(): SpeechSynthesisVoice | null {
    // Stimmen laden manche Browser verzögert: so lange suchen, bis eine da ist.
    this.voice ??=
      this.synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith('de')) ?? null;
    return this.voice;
  }

  private context(): AudioContext | null {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private play(kind: Tone): void {
    const ctx = this.context();
    if (!ctx) return;
    const shape = TONES[kind];
    let at = ctx.currentTime + 0.02;
    for (let i = 0; i < shape.count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const end = at + shape.ms / 1000;
      osc.frequency.value = shape.hz;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(end + 0.02);
      at = end + shape.gapMs / 1000;
    }
  }
}
