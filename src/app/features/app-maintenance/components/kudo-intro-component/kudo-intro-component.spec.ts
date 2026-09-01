import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { KudoIntroComponent } from './kudo-intro-component';
import { BikeService } from '../../services/bike-service/bike-service';
import { KudoSetupSuggestion } from '../../models/maintenance.models';

/**
 * Deckt genau die neue Weiche ab: mit Modell direkt zur Setup-Vorbelegung (keine
 * Modellsuche mehr dazwischen), ohne Modell weiterhin die bisherige Modellsuche.
 */
describe('KudoIntroComponent', () => {
  let component: KudoIntroComponent;
  let fixture: ComponentFixture<KudoIntroComponent>;
  let bikeService: { fetchKudoModels: ReturnType<typeof vi.fn>; fetchKudoSetup: ReturnType<typeof vi.fn> };

  const suggestion: KudoSetupSuggestion = {
    manufacturer: 'Canyon',
    model: 'Grail CF SL 7',
    year: 2022,
    groups: [],
  };

  beforeEach(async () => {
    bikeService = {
      fetchKudoModels: vi.fn(),
      fetchKudoSetup: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [KudoIntroComponent],
      providers: [{ provide: BikeService, useValue: bikeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(KudoIntroComponent);
    fixture.componentRef.setInput('bikeId', 42);
    fixture.componentRef.setInput('bikeType', 'gravel');
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires a manufacturer before submitting either path', () => {
    component.manufacturer = '';
    component.model = 'Grail';

    component.submitAsk();

    expect(bikeService.fetchKudoModels).not.toHaveBeenCalled();
    expect(bikeService.fetchKudoSetup).not.toHaveBeenCalled();
    expect(component.error()).toContain('Hersteller');
  });

  it('skips the model search and goes straight to setup when a model is given', () => {
    bikeService.fetchKudoSetup.mockReturnValue(of(suggestion));
    component.manufacturer = 'Canyon';
    component.model = 'Grail CF SL 7';
    component.year = 2022;

    component.submitAsk();

    expect(bikeService.fetchKudoModels).not.toHaveBeenCalled();
    expect(bikeService.fetchKudoSetup).toHaveBeenCalledWith(42, 'Canyon', 'Grail CF SL 7', 2022);
  });

  it('emits the suggestion once the direct setup request resolves', () => {
    bikeService.fetchKudoSetup.mockReturnValue(of(suggestion));
    const emitted: KudoSetupSuggestion[] = [];
    component.suggested.subscribe((value) => emitted.push(value));

    component.manufacturer = 'Canyon';
    component.model = 'Grail CF SL 7';
    component.submitAsk();

    expect(emitted).toEqual([suggestion]);
    expect(component.phase()).toBe('building');
  });

  it('falls back to the model phase (custom field prefilled) if the direct setup request fails', () => {
    bikeService.fetchKudoSetup.mockReturnValue(throwError(() => new Error('boom')));
    component.manufacturer = 'Canyon';
    component.model = 'Grail CF SL 7';

    component.submitAsk();

    expect(component.phase()).toBe('models');
    expect(component.customModel).toBe('Grail CF SL 7');
    expect(component.error()).toBeTruthy();
  });

  it('runs the model search when no model is given', () => {
    bikeService.fetchKudoModels.mockReturnValue(
      of({ models: [{ model: 'Grail', year_range: '2018-2024', note: '' }] }),
    );
    component.manufacturer = 'Canyon';
    component.model = '';

    component.submitAsk();

    expect(bikeService.fetchKudoSetup).not.toHaveBeenCalled();
    expect(bikeService.fetchKudoModels).toHaveBeenCalledWith('Canyon', null, 'gravel');
    expect(component.phase()).toBe('models');
    expect(component.models().length).toBe(1);
  });

  it('trims whitespace-only model input and still runs the model search', () => {
    bikeService.fetchKudoModels.mockReturnValue(of({ models: [] }));
    component.manufacturer = 'Canyon';
    component.model = '   ';

    component.submitAsk();

    expect(bikeService.fetchKudoModels).toHaveBeenCalled();
    expect(bikeService.fetchKudoSetup).not.toHaveBeenCalled();
  });
});
