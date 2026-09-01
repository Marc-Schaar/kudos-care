import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AssemblyChecklistComponent } from './assembly-checklist-component';
import { ComponentGroupCatalog, ComponentSlotList, ComponentTemplate } from '../../models/maintenance.models';

function makeTemplate(overrides: Partial<ComponentTemplate> = {}): ComponentTemplate {
  return {
    id: 1,
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
    ...overrides,
  } as ComponentTemplate;
}

function makeGroup(parts: ComponentTemplate[]): ComponentGroupCatalog {
  return {
    id: 10,
    name: 'Laufrad vorne',
    notes: '',
    category: 'wheels',
    category_display: 'Laufräder',
    applicable_bike_types: [],
    sort_order: 30,
    recommended: true,
    is_system: true,
    parts,
    consumables: [],
    has_active_instance: false,
  } as ComponentGroupCatalog;
}

function makeUngroupedSlot(templateId: number, overrides: Partial<ComponentSlotList> = {}): ComponentSlotList {
  return {
    id: 99,
    bike: 1,
    template: templateId,
    template_detail: makeTemplate({ id: templateId }),
    display_name: 'Reifen vorne',
    category: 'wheels',
    category_display: 'Laufräder',
    warn_status: 'ok',
    mounted_component: {
      id: 500,
      brand: 'Schwalbe',
      model_name: 'Marathon',
      installed_at: '2026-01-01',
      condition_pct: null,
      wear_km: 42,
      wear_days: 30,
      effective_warn_km: 5000,
      effective_warn_days: null,
      warn_status_overall: 'ok',
    },
    ...overrides,
  } as ComponentSlotList;
}

describe('AssemblyChecklistComponent', () => {
  let component: AssemblyChecklistComponent;
  let fixture: ComponentFixture<AssemblyChecklistComponent>;
  const tireTemplate = makeTemplate({ id: 1 });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssemblyChecklistComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyChecklistComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('bikeId', 1);
    fixture.componentRef.setInput('group', makeGroup([tireTemplate]));
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('vorhandene Komponente übernehmen', () => {
    it('schlägt einen passenden ungruppierten Slot automatisch als Übernahme vor', () => {
      fixture.componentRef.setInput('ungroupedSlots', [makeUngroupedSlot(1)]);
      fixture.detectChanges();

      expect(component.partRows.length).toBe(1);
      expect(component.partRows[0].existingSlot?.id).toBe(99);
      expect(component.partRows[0].reuseExisting).toBe(true);
    });

    it('bietet ohne passendes Template keine Übernahme an', () => {
      fixture.componentRef.setInput('ungroupedSlots', [makeUngroupedSlot(999)]);
      fixture.detectChanges();

      expect(component.partRows[0].existingSlot).toBeNull();
      expect(component.partRows[0].reuseExisting).toBe(false);
    });

    it('ignoriert ungruppierte Slots ohne montiertes Teil', () => {
      fixture.componentRef.setInput('ungroupedSlots', [
        makeUngroupedSlot(1, { mounted_component: null }),
      ]);
      fixture.detectChanges();

      expect(component.partRows[0].existingSlot).toBeNull();
    });

    it('sendet existing_slot_id statt brand/model, wenn übernommen wird', () => {
      fixture.componentRef.setInput('ungroupedSlots', [makeUngroupedSlot(1)]);
      fixture.detectChanges();

      const payload = component.buildPayload();
      expect(payload.parts).toEqual([{ template_id: 1, include: true, existing_slot_id: 99 }]);
    });

    it('sendet brand/model, wenn die Übernahme abgewählt wird', () => {
      fixture.componentRef.setInput('ungroupedSlots', [makeUngroupedSlot(1)]);
      fixture.detectChanges();

      component.partRows[0].reuseExisting = false;
      component.partRows[0].brand = 'Continental';

      const payload = component.buildPayload();
      expect(payload.parts[0].template_id).toBe(1);
      expect(payload.parts[0].brand).toBe('Continental');
      expect(payload.parts[0].existing_slot_id).toBeUndefined();
    });
  });
});
