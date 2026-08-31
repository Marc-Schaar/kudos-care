import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssemblyCardComponent } from './assembly-card-component';

describe('AssemblyCardComponent', () => {
  let component: AssemblyCardComponent;
  let fixture: ComponentFixture<AssemblyCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssemblyCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
