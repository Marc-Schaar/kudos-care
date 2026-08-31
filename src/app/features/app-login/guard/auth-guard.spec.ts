import { TestBed } from '@angular/core/testing';

import { authGuard } from './auth-guard';

describe('authGuard', () => {
  // authGuard nimmt bewusst keine Route/State-Argumente entgegen — das generierte
  // Scaffold reichte `...guardParameters` durch und brach dadurch den Build.
  const executeGuard = () => TestBed.runInInjectionContext(() => authGuard());

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
