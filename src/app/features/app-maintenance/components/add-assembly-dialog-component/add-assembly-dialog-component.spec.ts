import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAssemblyDialogComponent } from './add-assembly-dialog-component';

describe('AddAssemblyDialogComponent', () => {
  let component: AddAssemblyDialogComponent;
  let fixture: ComponentFixture<AddAssemblyDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAssemblyDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AddAssemblyDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
