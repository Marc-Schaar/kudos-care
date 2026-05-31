import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailBikeComponent } from './detail-bike-component';

describe('DetailBikeComponent', () => {
  let component: DetailBikeComponent;
  let fixture: ComponentFixture<DetailBikeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailBikeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailBikeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
