import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssemblyChecklistComponent } from './assembly-checklist-component';

describe('AssemblyChecklistComponent', () => {
  let component: AssemblyChecklistComponent;
  let fixture: ComponentFixture<AssemblyChecklistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssemblyChecklistComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyChecklistComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
