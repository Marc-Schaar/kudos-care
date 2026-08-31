import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BikeSetupStepperComponent } from './bike-setup-stepper-component';

describe('BikeSetupStepperComponent', () => {
  let component: BikeSetupStepperComponent;
  let fixture: ComponentFixture<BikeSetupStepperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BikeSetupStepperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BikeSetupStepperComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
