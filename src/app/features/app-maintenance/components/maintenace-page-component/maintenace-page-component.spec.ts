import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaintenacePageComponent } from './maintenace-page-component';

describe('MaintenacePageComponent', () => {
  let component: MaintenacePageComponent;
  let fixture: ComponentFixture<MaintenacePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenacePageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenacePageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
