import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RideRecorder } from './ride-recorder';

/** Ein frischer Recorder, als hätte der Browser den Tab neu geöffnet. */
function openTab(): RideRecorder {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.inject(RideRecorder);
}

function rideKeys(): string[] {
  return Object.keys(localStorage).filter((k) => k.startsWith('radcomputer.ride'));
}

describe('Fahrt zwischenspeichern', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('übersteht einen geschlossenen Tab, auch über mehrere Stücke', () => {
    const ride = openTab();
    ride.start();
    vi.advanceTimersByTime(700_000); // 700 Sekunden = drei Stücke à 300 Punkte

    const restored = openTab();

    expect(restored.status()).toBe('paused');
    expect(restored.trackLength()).toBe(700);
    expect(restored.stats().movingMs).toBe(ride.stats().movingMs);
  });

  it('verliert beim Schließen höchstens die letzten Sekunden', () => {
    const ride = openTab();
    ride.start();
    vi.advanceTimersByTime(63_000);

    // Kein pagehide: der Browser hat den Tab hart beendet.
    expect(openTab().trackLength()).toBeGreaterThanOrEqual(63 - 5);
  });

  it('schreibt fertige Stücke nicht jedes Mal neu', () => {
    const ride = openTab();
    ride.start();
    vi.advanceTimersByTime(310_000);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    vi.advanceTimersByTime(5_000);

    const written = setItem.mock.calls.map(([key]) => key);
    expect(written).toContain('radcomputer.ride.v3.1');
    expect(written).not.toContain('radcomputer.ride.v3.0');
    setItem.mockRestore();
  });

  it('übernimmt eine Fahrt im alten Format', () => {
    localStorage.setItem(
      'radcomputer.ride.v2',
      JSON.stringify({
        status: 'running',
        stats: { startedAt: 1, movingMs: 2000, distanceM: 10, ascentM: 0 },
        laps: [{ trackIdx: 0, t0: 0, d0: 0, pwrSum: 0, pwrN: 0, label: null }],
        track: [
          [1, null, null, null, 0, null, null, null],
          [2, null, null, null, 10, null, null, null],
        ],
      }),
    );

    const ride = openTab();

    expect(ride.trackLength()).toBe(2);
    expect(localStorage.getItem('radcomputer.ride.v2')).toBeNull();
    expect(openTab().trackLength()).toBe(2);
  });

  it('räumt nach dem Abschließen alles weg', () => {
    const ride = openTab();
    ride.start();
    vi.advanceTimersByTime(400_000);
    expect(rideKeys().length).toBeGreaterThan(1);

    ride.reset();

    expect(rideKeys()).toEqual([]);
    expect(openTab().status()).toBe('idle');
  });
});
