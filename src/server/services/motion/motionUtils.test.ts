import { describe, it, expect } from 'vitest';
import { motionThreshold, parseSceneScore } from './motionUtils';

describe('motionThreshold', () => {
  it('maps higher sensitivity to a lower trigger threshold', () => {
    expect(motionThreshold(90)).toBeLessThan(motionThreshold(10));
  });

  it('uses the documented midpoint at sensitivity 50', () => {
    expect(motionThreshold(50)).toBeCloseTo(5, 5);
  });

  it('clamps out-of-range and missing input', () => {
    expect(motionThreshold(1000)).toBe(0.5); // capped low
    expect(motionThreshold(-50)).toBe(10); // treated as 0 sensitivity
    expect(motionThreshold(undefined)).toBeCloseTo(5, 5); // defaults to 50
  });

  it('never returns a value outside 0.5-50', () => {
    for (let s = 0; s <= 100; s += 7) {
      const t = motionThreshold(s);
      expect(t).toBeGreaterThanOrEqual(0.5);
      expect(t).toBeLessThanOrEqual(50);
    }
  });
});

describe('parseSceneScore', () => {
  it('parses the modern scdet key', () => {
    expect(parseSceneScore('[Parsed_metadata_2 @ 0x55] lavfi.scdet.score=12.34')).toBeCloseTo(12.34);
  });

  it('parses the legacy scd key', () => {
    expect(parseSceneScore('lavfi.scd.score=0.50')).toBeCloseTo(0.5);
  });

  it('parses the scene_score variant', () => {
    expect(parseSceneScore('frame:1 lavfi.scene_score=7')).toBe(7);
  });

  it('returns null for unrelated lines', () => {
    expect(parseSceneScore('frame=  10 fps=5 q=-1.0 size=N/A time=00:00:02.00')).toBeNull();
    expect(parseSceneScore('')).toBeNull();
  });
});
