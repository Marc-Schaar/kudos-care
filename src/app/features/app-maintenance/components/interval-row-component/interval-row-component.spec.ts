import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntervalRowComponent } from './interval-row-component';

describe('IntervalRowComponent', () => {
  let component: IntervalRowComponent;
  let fixture: ComponentFixture<IntervalRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntervalRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IntervalRowComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
