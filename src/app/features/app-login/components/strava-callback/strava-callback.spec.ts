import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StravaCallback } from './strava-callback';

describe('StravaCallback', () => {
  let component: StravaCallback;
  let fixture: ComponentFixture<StravaCallback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StravaCallback],
    }).compileComponents();

    fixture = TestBed.createComponent(StravaCallback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
