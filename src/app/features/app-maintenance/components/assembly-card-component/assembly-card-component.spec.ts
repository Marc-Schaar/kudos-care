import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AssemblyCardComponent } from './assembly-card-component';
import { BikeAssembly, ComponentSlotList, WarnStatus } from '../../models/maintenance.models';

function makeSlot(id: number, overrides: Partial<ComponentSlotList> = {}): ComponentSlotList {
  return {
    id,
    bike: 1,
    template: 100,
    template_detail: {
      id: 100,
      name: 'Reifen vorne',
      category: 'wheels',
      category_display: 'Laufräder',
      applicable_bike_types: [],
      warn_km: 5000,
      warn_hours: null,
      warn_days: null,
      is_system: true,
      supports_condition_estimate: false,
      maintenance_kind: 'part',
      default_in_group: true,
      notes: '',
      group: 10,
      group_name: 'Laufrad vorne',
    },
    display_name: 'Reifen vorne',
    category: 'wheels',
    category_display: 'Laufräder',
    warn_status: 'ok',
    mounted_component: null,
    ...overrides,
  } as ComponentSlotList;
}

function makeAssembly(overrides: Partial<BikeAssembly> = {}): BikeAssembly {
  return {
    id: 1,
    bike: 1,
    group: 10,
    group_detail: {
      id: 10,
      name: 'Laufrad vorne',
      notes: '',
      category: 'wheels',
      category_display: 'Laufräder',
      applicable_bike_types: [],
      sort_order: 30,
      recommended: true,
      is_system: true,
      parts: [],
      consumables: [],
    },
    name: '',
    display_name: 'Laufrad vorne',
    installed_at: null,
    retired_at: null,
    is_active: true,
    is_parked: false,
    last_used_at: null,
    slots: [],
    intervals: [],
    assembly_km: 0,
    worst_status: 'ok' as WarnStatus,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as BikeAssembly;
}

describe('AssemblyCardComponent', () => {
  let component: AssemblyCardComponent;
  let fixture: ComponentFixture<AssemblyCardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssemblyCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyCardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('assembly', makeAssembly());
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Expansion Panel — Default-Zustand', () => {
    it('startet zugeklappt, wenn der Status ok ist', () => {
      fixture.componentRef.setInput('assembly', makeAssembly({ worst_status: 'ok' }));
      fixture.detectChanges();
      expect(component.expanded()).toBe(false);
    });

    it('startet aufgeklappt, wenn der Status warn/critical ist', () => {
      fixture.componentRef.setInput('assembly', makeAssembly({ worst_status: 'critical' }));
      fixture.detectChanges();
      expect(component.expanded()).toBe(true);
    });

    it('toggleExpanded() kehrt den aktuellen Zustand um', () => {
      fixture.componentRef.setInput('assembly', makeAssembly({ worst_status: 'ok' }));
      fixture.detectChanges();
      expect(component.expanded()).toBe(false);

      component.toggleExpanded();
      expect(component.expanded()).toBe(true);

      component.toggleExpanded();
      expect(component.expanded()).toBe(false);
    });

    it('ein hervorgehobener Slot klappt auch gegen einen manuellen Zuklapp-Override auf', () => {
      fixture.componentRef.setInput(
        'assembly',
        makeAssembly({ worst_status: 'critical', slots: [makeSlot(42)] }),
      );
      fixture.detectChanges();
      component.toggleExpanded(); // manuell zuklappen
      expect(component.expanded()).toBe(false);

      fixture.componentRef.setInput('highlightedSlotId', 42);
      fixture.detectChanges();
      expect(component.expanded()).toBe(true);
    });

    it('ignoriert highlightedSlotId, wenn er zu keinem Slot dieser Baugruppe gehört', () => {
      fixture.componentRef.setInput(
        'assembly',
        makeAssembly({ worst_status: 'ok', slots: [makeSlot(1)] }),
      );
      fixture.componentRef.setInput('highlightedSlotId', 999);
      fixture.detectChanges();
      expect(component.expanded()).toBe(false);
    });
  });

  describe('Löschen', () => {
    it('zeigt erst nach requestDelete() eine Bestätigung', () => {
      expect(component.confirmingDelete()).toBe(false);
      component.requestDelete();
      expect(component.confirmingDelete()).toBe(true);
    });

    it('cancelDelete() bricht ohne HTTP-Aufruf ab', () => {
      component.requestDelete();
      component.cancelDelete();
      expect(component.confirmingDelete()).toBe(false);
      httpMock.expectNone(() => true);
    });

    it('confirmDeleteNow() ruft DELETE auf und emittiert deleted bei Erfolg', () => {
      fixture.componentRef.setInput('assembly', makeAssembly({ id: 7 }));
      fixture.detectChanges();

      let deletedId: number | null = null;
      component.deleted.subscribe((id) => (deletedId = id));

      component.confirmDeleteNow();
      const req = httpMock.expectOne(
        (r) => r.method === 'DELETE' && r.url.includes('/assemblies/7/'),
      );
      req.flush(null);

      expect(deletedId).toBe(7);
    });

    it('confirmDeleteNow() setzt bei Fehlschlag zurück auf den Löschen-Button', () => {
      component.requestDelete();
      component.confirmDeleteNow();
      const req = httpMock.expectOne((r) => r.method === 'DELETE');
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(component.deleting()).toBe(false);
      expect(component.confirmingDelete()).toBe(false);
    });
  });
});
