/**
 * Pure helpers for motion detection — extracted so they can be unit tested
 * without spawning FFmpeg.
 */

/**
 * Map a 0-100 sensitivity to a scene-change trigger threshold (percent).
 * Higher sensitivity => smaller change required to trigger. Result is clamped
 * to a sane 0.5%-50% range.
 */
export function motionThreshold(sensitivity: number | undefined): number {
  const s = Math.min(100, Math.max(0, sensitivity ?? 50));
  return Math.min(50, Math.max(0.5, (100 - s) / 10));
}

/**
 * Parse a scene-change score from a single FFmpeg stderr line. The metadata
 * key name has varied across FFmpeg versions (scd / scdet / scene_score), so
 * all known variants are matched. Returns null when the line has no score.
 */
export function parseSceneScore(line: string): number | null {
  const match = line.match(/lavfi\.(?:scd(?:et)?\.score|scene_score)=([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const score = parseFloat(match[1]);
  return Number.isFinite(score) ? score : null;
}
