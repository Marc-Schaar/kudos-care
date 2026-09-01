import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SwitchAssemblyDialogComponent } from './switch-assembly-dialog-component';
import { BikeAssembly } from '../../models/maintenance.models';

function makeAssembly(overrides: Partial<BikeAssembly> = {}): BikeAssembly {
  return {
    id: 1,
    bike: 10,
    group: 100,
    group_detail: {
      id: 100,
      name: 'Laufrad vorne',
      category: 'wheels',
      parts: [],
      consumables: [],
    },
    name: '',
    display_name: 'Sommer-LRS',
    installed_at: null,
    retired_at: null,
    is_active: true,
    is_parked: false,
    last_used_at: null,
    slots: [],
    intervals: [],
    assembly_km: 0,
    worst_status: 'ok',
    created_at: '',
    updated_at: '',
    ...overrides,
  } as BikeAssembly;
}

describe('SwitchAssemblyDialogComponent', () => {
  let component: SwitchAssemblyDialogComponent;
  let fixture: ComponentFixture<SwitchAssemblyDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchAssemblyDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SwitchAssemblyDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('assembly', makeAssembly());
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('bietet nur geparkte Sätze derselben Baugruppe an', () => {
    fixture.componentRef.setInput('parked', [
      makeAssembly({ id: 2, group: 100, display_name: 'Winter-LRS', is_active: false }),
      makeAssembly({ id: 3, group: 200, display_name: 'Ersatz-Antrieb', is_active: false }),
    ]);
    expect(component.alternatives().map((a) => a.id)).toEqual([2]);
  });

  it('zeigt keine Alternativen, wenn es nur einen Satz gibt', () => {
    fixture.componentRef.setInput('parked', []);
    expect(component.alternatives()).toEqual([]);
  });
});
