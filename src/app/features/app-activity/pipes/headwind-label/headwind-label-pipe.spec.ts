import { HeadwindLabelPipe } from './headwind-label-pipe';

describe('HeadwindLabelPipe', () => {
  const pipe = new HeadwindLabelPipe();

  it('labels positive values as Gegenwind', () => {
    expect(pipe.transform(12.4)).toBe('Gegenwind');
  });

  it('labels negative values as Rückenwind', () => {
    expect(pipe.transform(-8.1)).toBe('Rückenwind');
  });

  it('labels a near-zero average as neutral instead of Rückenwind', () => {
    // Tritt bei jeder Rundfahrt auf: Hin- und Rückweg heben sich auf. Vorher wurde
    // hier "Rückenwind" behauptet, was schlicht falsch war.
    expect(pipe.transform(0)).toBe('Wind neutral');
    expect(pipe.transform(0.2)).toBe('Wind neutral');
    expect(pipe.transform(-0.3)).toBe('Wind neutral');
  });

  it('treats missing values as neutral', () => {
    expect(pipe.transform(null)).toBe('Wind neutral');
    expect(pipe.transform(undefined)).toBe('Wind neutral');
  });
});
