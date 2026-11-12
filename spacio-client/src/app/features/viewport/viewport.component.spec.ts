import { TestBed } from '@angular/core/testing';
import { ViewportComponent } from './viewport.component';

describe('ViewportComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewportComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ViewportComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});