import { computePaces, formatDuration, formatPace, parseTime, predictRace, vdotFromRace } from '../lib/vdot';

describe('vdot', () => {
  const marathon = 3 * 3600 + 23 * 60;

  it('derives a VDOT around 46 from a 3:23 marathon', () => {
    const v = vdotFromRace(42195, marathon);
    expect(v).toBeGreaterThan(45.5);
    expect(v).toBeLessThan(47.5);
  });

  it('predicts the input race back within a few seconds', () => {
    const v = vdotFromRace(42195, marathon);
    expect(Math.abs(predictRace(v, 42195) - marathon)).toBeLessThan(5);
  });

  it('predicts a faster 5k than 10k and sensible values', () => {
    const p = computePaces(marathon).predictions;
    expect(p['5k']).toBeLessThan(p['10k']);
    expect(p['10k']).toBeLessThan(p.half);
    expect(p.half).toBeLessThan(p.marathon);
    // ~21:00–22:00 5k for a 3:23 marathoner
    expect(p['5k']).toBeGreaterThan(20 * 60);
    expect(p['5k']).toBeLessThan(22.5 * 60);
  });

  it('orders zones from slow to fast', () => {
    const z = computePaces(marathon).zones;
    expect(z.recovery.min).toBeGreaterThan(z.easy.min);
    expect(z.easy.min).toBeGreaterThan(z.marathon.min);
    expect(z.marathon.min).toBeGreaterThan(z.threshold.min);
    expect(z.threshold.min).toBeGreaterThan(z.interval.min);
    expect(z.interval.min).toBeGreaterThan(z.repetition.min);
    // marathon pace zone should bracket the actual race pace (~4:49/km = 289 s)
    expect(z.marathon.min).toBeLessThan(289);
    expect(z.marathon.max).toBeGreaterThan(280);
  });

  it('formats and parses times', () => {
    expect(formatPace(289)).toBe('4:49');
    expect(formatDuration(marathon)).toBe('3:23:00');
    expect(formatDuration(21 * 60 + 5)).toBe('21:05');
    expect(parseTime('3:23:00')).toBe(marathon);
    expect(parseTime('21:05')).toBe(21 * 60 + 5);
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('3')).toBeNull();
  });
});
