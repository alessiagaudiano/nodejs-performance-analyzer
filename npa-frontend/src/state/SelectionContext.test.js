import { downsampleSeries } from './SelectionContext';

describe('downsampleSeries', () => {
  it('returns original when below threshold', () => {
    const arr = Array.from({ length: 10 }, (_, i) => ({ t: i, v: i }));
    expect(downsampleSeries(arr, 100)).toBe(arr);
  });

  it('downsamples by stride when above threshold', () => {
    const arr = Array.from({ length: 100 }, (_, i) => ({ t: i, v: i }));
    const out = downsampleSeries(arr, 10);
    expect(out.length).toBeLessThanOrEqual(10);
    // Ensure first element preserved
    expect(out[0]).toEqual(arr[0]);
  });
});

