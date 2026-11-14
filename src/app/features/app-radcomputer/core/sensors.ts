import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { CrankData, cadenceFrom, parseHeartRate, parsePower, uuid16 } from './ble-parsers';
import { SensorState } from './models';
import { Ticker } from './ticker';
import { Toasts } from './toasts';

export type SensorKey = 'pwr' | 'hr';

interface SensorDef {
  name: string;
  short: string;
  service: string;
  characteristic: string;
}

export const SENSOR_DEFS: Record<SensorKey, SensorDef> = {
  pwr: {
    name: 'Powermeter',
    short: 'PWR',
    service: uuid16(0x1818),
    characteristic: uuid16(0x2a63),
  },
  hr: { name: 'Pulsgurt', short: 'HF', service: uuid16(0x180d), characteristic: uuid16(0x2a37) },
};

/** Ein Sensorwert gilt nach dieser Zeit ohne neue Daten als veraltet. */
const STALE_MS = 4000;

interface Sample {
  value: number;
  at: number;
}

/** Powermeter und Pulsgurt über Web Bluetooth (auf dem iPhone nur im Bluefy-Browser). */
@Injectable({ providedIn: 'root' })
export class Sensors {
  private readonly ticker = inject(Ticker);
  private readonly toasts = inject(Toasts);

  readonly supported = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  /** Im Demo-Modus kommen die Werte aus der Simulation. */
  simulated = false;

  private readonly stateSignals: Record<SensorKey, ReturnType<typeof signal<SensorState>>> = {
    pwr: signal<SensorState>('off'),
    hr: signal<SensorState>('off'),
  };
  private readonly devices: Record<SensorKey, BluetoothDevice | null> = { pwr: null, hr: null };
  private readonly retries: Record<SensorKey, number> = { pwr: 0, hr: 0 };

  private readonly powerSample = signal<Sample | null>(null);
  private readonly hrSample = signal<Sample | null>(null);
  private readonly cadenceValue = signal<number | null>(null);
  private readonly power3sValue = signal<number | null>(null);
  private window: Sample[] = [];
  private crank: CrankData | null = null;
  private crankAt = 0;

  readonly power = computed(() => this.fresh(this.powerSample()));
  readonly hr = computed(() => this.fresh(this.hrSample()));
  readonly cadence = this.cadenceValue.asReadonly();
  /** Mittel der letzten drei Sekunden */
  readonly power3s = this.power3sValue.asReadonly();

  constructor() {
    this.ticker.onTick((now) => {
      this.updateWindow(now);
      // Keine neue Kurbelumdrehung mehr: 0 anzeigen, solange das Powermeter noch sendet.
      if (this.cadenceValue() != null && now - this.crankAt > 3000) {
        const sample = this.powerSample();
        this.cadenceValue.set(sample && now - sample.at < STALE_MS ? 0 : null);
      }
    });
  }

  state(key: SensorKey): Signal<SensorState> {
    return this.stateSignals[key].asReadonly();
  }

  setState(key: SensorKey, state: SensorState): void {
    this.stateSignals[key].set(state);
  }

  handlePower(dv: DataView): void {
    const now = Date.now();
    const m = parsePower(dv);
    const watts = Math.max(0, m.power);
    this.powerSample.set({ value: watts, at: now });
    this.window.push({ value: watts, at: now });
    this.updateWindow(now);
    if (m.crank) {
      if (this.crank) {
        const rpm = cadenceFrom(this.crank, m.crank);
        if (rpm != null) {
          this.cadenceValue.set(rpm);
          this.crankAt = now;
        }
      } else {
        this.crankAt = now;
      }
      this.crank = m.crank;
    }
  }

  handleHeartRate(dv: DataView): void {
    this.hrSample.set({ value: parseHeartRate(dv), at: Date.now() });
  }

  async connect(key: SensorKey): Promise<void> {
    const def = SENSOR_DEFS[key];
    const state = this.stateSignals[key];
    if (this.simulated) {
      this.toasts.show('Demo-Modus: Sensoren sind simuliert.');
      return;
    }
    if (state() === 'on') {
      this.toasts.show(`${def.name} verbunden: ${this.devices[key]?.name || 'ohne Namen'}`);
      return;
    }
    if (state() === 'busy') return;
    if (!navigator.bluetooth) {
      this.toasts.show(
        'Dieser Browser kann kein Web Bluetooth. Auf dem iPhone die Seite in Bluefy öffnen.',
      );
      return;
    }
    try {
      state.set('busy');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [def.service] }],
      });
      this.devices[key] = device;
      this.retries[key] = 0;
      device.addEventListener('gattserverdisconnected', () => this.onLost(key, device));
      await this.open(key, device);
      this.toasts.show(`${def.name} verbunden: ${device.name || 'ohne Namen'}`);
    } catch (err) {
      state.set('off');
      // NotFoundError: Auswahl abgebrochen. Das ist kein Fehler.
      if (!(err instanceof Error) || err.name !== 'NotFoundError') {
        this.toasts.show(
          `${def.name} nicht verbunden: ${err instanceof Error ? err.message : 'unbekannter Fehler'}`,
        );
      }
    }
  }

  private async open(key: SensorKey, device: BluetoothDevice): Promise<void> {
    const def = SENSOR_DEFS[key];
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(def.service);
    const characteristic = await service.getCharacteristic(def.characteristic);
    characteristic.addEventListener('characteristicvaluechanged', () => {
      const value = characteristic.value;
      if (!value) return;
      if (key === 'pwr') this.handlePower(value);
      else this.handleHeartRate(value);
    });
    await characteristic.startNotifications();
    this.retries[key] = 0;
    this.stateSignals[key].set('on');
  }

  private onLost(key: SensorKey, device: BluetoothDevice): void {
    if (this.devices[key] !== device) return; // inzwischen ein anderes Gerät gewählt
    const def = SENSOR_DEFS[key];
    if (this.retries[key] >= 8) {
      this.stateSignals[key].set('off');
      this.toasts.show(`${def.name} getrennt. Zum Verbinden ${def.short} antippen.`);
      return;
    }
    this.stateSignals[key].set('busy');
    this.retries[key] += 1;
    setTimeout(
      () => {
        this.open(key, device).catch(() => this.onLost(key, device));
      },
      Math.min(1000 * 2 ** this.retries[key], 15000),
    );
  }

  private fresh(sample: Sample | null): number | null {
    return sample && this.ticker.now() - sample.at < STALE_MS ? sample.value : null;
  }

  private updateWindow(now: number): void {
    this.window = this.window.filter((s) => now - s.at <= 3000);
    const n = this.window.length;
    this.power3sValue.set(n ? this.window.reduce((sum, s) => sum + s.value, 0) / n : null);
  }
}
