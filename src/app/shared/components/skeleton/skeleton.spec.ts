import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  let component: Skeleton;
  let fixture: ComponentFixture<Skeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Skeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(Skeleton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render one skeleton block by default', () => {
    fixture.detectChanges();
    const blocks = fixture.nativeElement.parentElement.querySelectorAll('.skeleton');
    expect(blocks.length).toBe(1);
  });

  it('should render `count` skeleton blocks', () => {
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();
    const blocks = fixture.nativeElement.parentElement.querySelectorAll('.skeleton');
    expect(blocks.length).toBe(3);
  });
});
