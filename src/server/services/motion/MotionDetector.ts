import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { Camera } from '../../database/entities';
import { StreamType } from '../../../shared/types';

interface MotionSession {
  cameraId: string;
  camera: Camera;
  process?: FfmpegCommand;
  lastMotionAt: number;
  stopped: boolean;
  restartTimer?: NodeJS.Timeout;
  threshold: number;
}

// Minimum gap between two emitted motion events for the same camera. Prevents a
// burst of high-score frames from producing a flood of events/alarms.
const MOTION_COOLDOWN_MS = 2000;
// Delay before re-spawning the analysis process after it exits/errors.
const RESTART_DELAY_MS = 5000;

/**
 * Software motion detection.
 *
 * Runs a low-FPS FFmpeg analysis process per camera using the `scdet` (scene
 * change detection) filter and parses the per-frame change score from FFmpeg's
 * stderr. When the score exceeds a sensitivity-derived threshold we emit a
 * `motion` event, which the recording engine and alarm coordinator consume.
 *
 * This is intentionally lightweight (no OpenCV dependency) and works against
 * any RTSP/RTMP/HTTP source FFmpeg can read.
 */
export class MotionDetector extends EventEmitter {
  private sessions: Map<string, MotionSession> = new Map();
  private fps: number;

  constructor() {
    super();
    const parsed = parseInt(process.env.MOTION_DETECTION_FPS || '5', 10);
    this.fps = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }

  /**
   * Begin monitoring a camera for motion. No-op if motion is disabled for the
   * camera or it is already being monitored.
   */
  start(camera: Camera): void {
    if (!camera.motionEnabled) {
      return;
    }
    if (this.sessions.has(camera.id)) {
      return;
    }

    const sensitivity = Math.min(100, Math.max(0, camera.motionSensitivity ?? 50));
    // Higher sensitivity => a smaller scene change is enough to trigger.
    // scdet scores are percentages (0-100); typical surveillance motion is a
    // few percent, a full scene cut approaches 100.
    const threshold = Math.min(50, Math.max(0.5, (100 - sensitivity) / 10));

    const session: MotionSession = {
      cameraId: camera.id,
      camera,
      lastMotionAt: 0,
      stopped: false,
      threshold,
    };

    this.sessions.set(camera.id, session);
    this.spawn(session);
    logger.info(
      `[Motion] Monitoring ${camera.name} (sensitivity ${sensitivity}, ` +
      `trigger >= ${threshold.toFixed(1)}% change @ ${this.fps}fps)`
    );
  }

  /**
   * Build the stream URL with embedded credentials (mirrors StreamManager).
   */
  private buildUrl(camera: Camera): string {
    let url = camera.streamUrl;
    if (
      (camera.streamType === StreamType.RTSP || camera.streamType === StreamType.RTMP) &&
      camera.username &&
      camera.password
    ) {
      const hasCredentials = /@/.test(url.split('://')[1]?.split('/')[0] || '');
      if (!hasCredentials) {
        url = url.replace(/^(rtsp|rtmp):\/\//, `$1://${camera.username}:${camera.password}@`);
      }
    }
    return url;
  }

  private spawn(session: MotionSession): void {
    const { camera } = session;
    const url = this.buildUrl(camera);

    const command = ffmpeg(url)
      .inputOptions(['-rtsp_transport tcp', '-timeout 5000000'])
      .outputOptions([
        '-an', // no audio
        // Sample at a low FPS and compute a scene-change score per frame.
        `-vf fps=${this.fps},scdet=threshold=0,metadata=print`,
        '-f null',
      ])
      .output('-')
      .on('stderr', (line: string) => this.parseLine(session, line))
      .on('error', (err) => {
        if (session.stopped) {
          return;
        }
        logger.warn(`[Motion] Analysis error for ${camera.name}: ${err.message}`);
        this.scheduleRestart(session);
      })
      .on('end', () => {
        if (session.stopped) {
          return;
        }
        // Stream ended (camera offline / network blip) — retry.
        this.scheduleRestart(session);
      });

    session.process = command;
    try {
      command.run();
    } catch (error) {
      logger.warn(`[Motion] Failed to launch analysis for ${camera.name}:`, error);
      this.scheduleRestart(session);
    }
  }

  /**
   * Parse a single FFmpeg stderr line for a scene-change score. The metadata
   * key name has varied across FFmpeg versions (scd / scdet, score / scene),
   * so we match all known variants.
   */
  private parseLine(session: MotionSession, line: string): void {
    const match = line.match(/lavfi\.(?:scd(?:et)?\.score|scene_score)=([0-9]+(?:\.[0-9]+)?)/);
    if (!match) {
      return;
    }

    const score = parseFloat(match[1]);
    if (!Number.isFinite(score) || score < session.threshold) {
      return;
    }

    const now = Date.now();
    if (now - session.lastMotionAt < MOTION_COOLDOWN_MS) {
      return;
    }
    session.lastMotionAt = now;

    logger.debug(
      `[Motion] Detected on ${session.camera.name} ` +
      `(score ${score.toFixed(2)} >= ${session.threshold.toFixed(1)})`
    );
    this.emit('motion', session.cameraId, score);
  }

  private scheduleRestart(session: MotionSession): void {
    if (session.stopped || session.restartTimer) {
      return;
    }
    session.restartTimer = setTimeout(() => {
      session.restartTimer = undefined;
      if (!session.stopped) {
        this.spawn(session);
      }
    }, RESTART_DELAY_MS);
  }

  /**
   * Stop monitoring a camera and tear down its analysis process.
   */
  stop(cameraId: string): void {
    const session = this.sessions.get(cameraId);
    if (!session) {
      return;
    }

    session.stopped = true;
    if (session.restartTimer) {
      clearTimeout(session.restartTimer);
    }
    if (session.process) {
      try {
        session.process.kill('SIGKILL');
      } catch {
        // already gone
      }
    }
    this.sessions.delete(cameraId);
    logger.info(`[Motion] Stopped monitoring ${session.camera.name}`);
  }

  stopAll(): void {
    for (const id of Array.from(this.sessions.keys())) {
      this.stop(id);
    }
  }

  isMonitoring(cameraId: string): boolean {
    return this.sessions.has(cameraId);
  }
}

export default new MotionDetector();
