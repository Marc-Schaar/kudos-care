import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlotCardComponent } from './slot-card-component';

describe('SlotCardComponent', () => {
  let component: SlotCardComponent;
  let fixture: ComponentFixture<SlotCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlotCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SlotCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
