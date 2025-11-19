import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger';
import { Camera } from '../../database/entities';
import { StreamType, CameraStatus } from '../../../shared/types';
import config from '../../config';

export interface StreamSession {
  cameraId: string;
  camera: Camera;
  ffmpegProcess?: FfmpegCommand;
  status: CameraStatus;
  viewers: number;
  startTime: Date;
  stats: {
    fps: number;
    bitrate: number;
    resolution: string;
    codec: string;
  };
}

export class StreamManager extends EventEmitter {
  private sessions: Map<string, StreamSession> = new Map();
  private hlsDir: string;
  private snapshotDir: string;

  constructor() {
    super();
    this.hlsDir = path.join(config.storage.path, 'hls');
    this.snapshotDir = path.join(config.storage.path, 'snapshots');

    // Create directories
    [this.hlsDir, this.snapshotDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Start streaming from a camera
   */
  async startStream(camera: Camera): Promise<void> {
    logger.info(`[StreamManager] startStream called for camera: ${camera.name}`);
    logger.info(`[StreamManager] Camera details:`, {
      id: camera.id,
      name: camera.name,
      streamUrl: camera.streamUrl,
      streamType: camera.streamType,
      username: camera.username || 'none',
      hasPassword: !!camera.password
    });

    if (this.sessions.has(camera.id)) {
      logger.info(`Stream already active for camera ${camera.name}`);
      return;
    }

    logger.info(`Starting stream for camera ${camera.name} (${camera.streamType})`);

    const session: StreamSession = {
      cameraId: camera.id,
      camera,
      status: CameraStatus.CONNECTING,
      viewers: 0,
      startTime: new Date(),
      stats: {
        fps: 0,
        bitrate: 0,
        resolution: '',
        codec: '',
      },
    };

    this.sessions.set(camera.id, session);
    logger.info(`[StreamManager] Session created and added to sessions map`);

    try {
      logger.info(`[StreamManager] Calling initializeStream...`);
      await this.initializeStream(session);
      // Note: Status will be set to ONLINE by the progress event handler
      // when FFmpeg actually starts receiving data
      this.emit('stream:started', camera.id);
      logger.info(`Stream initialization complete for camera ${camera.name}`);
    } catch (error) {
      logger.error(`Failed to start stream for camera ${camera.name}:`, error);
      logger.error(`Error details:`, error instanceof Error ? error.stack : error);
      session.status = CameraStatus.ERROR;
      this.emit('stream:error', camera.id, error);
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Initialize FFmpeg stream process
   */
  private async initializeStream(session: StreamSession): Promise<void> {
    const { camera } = session;
    const hlsPath = path.join(this.hlsDir, camera.id);

    // Create HLS directory for this camera
    if (!fs.existsSync(hlsPath)) {
      fs.mkdirSync(hlsPath, { recursive: true });
      logger.info(`Created HLS directory: ${hlsPath}`);
    }

    const playlistPath = path.join(hlsPath, 'playlist.m3u8');
    const streamUrl = this.buildStreamUrl(camera);

    // Log the stream URL (mask password for security)
    const maskedUrl = streamUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1$2:****@');
    logger.info(`Stream URL for ${camera.name}: ${maskedUrl}`);
    logger.info(`HLS playlist will be saved to: ${playlistPath}`);

    // Build FFmpeg command
    let command = ffmpeg(streamUrl)
      .inputOptions([
        '-rtsp_transport tcp', // More reliable than UDP
        '-timeout 5000000', // 5 second timeout
        '-reconnect 1',
        '-reconnect_streamed 1',
        '-reconnect_delay_max 2',
      ]);

    // Add hardware acceleration
    command = this.addHardwareAcceleration(command);

    // Output to HLS
    command
      .outputOptions([
        '-c:v copy', // Copy video codec for low latency
        '-c:a aac', // Audio codec
        '-ac 1', // Mono audio to reduce processing
        '-ar 22050', // Lower audio sample rate
        '-f hls',
        '-hls_time 2', // 2 second segments
        '-hls_list_size 10',
        '-hls_flags delete_segments+append_list',
        '-map 0:v:0', // Map first video stream
        '-map 0:a:0?', // Map first audio stream if present (optional)
        '-ignore_unknown', // Ignore unknown streams
        `-hls_segment_filename ${path.join(hlsPath, 'segment_%03d.ts')}`,
      ])
      .output(playlistPath)
      .on('start', (commandLine) => {
        logger.info(`Starting FFmpeg for camera ${camera.name}`);
        logger.info(`FFmpeg command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        if (progress.currentFps) {
          session.stats.fps = progress.currentFps;
        }
        if (progress.currentKbps) {
          session.stats.bitrate = progress.currentKbps * 1000;
        }
        // Log first progress update to confirm stream is working
        if (session.status === CameraStatus.CONNECTING) {
          logger.info(`✓ Stream connected for camera ${camera.name} (${progress.currentFps || 0} fps)`);
          session.status = CameraStatus.ONLINE;
        }
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`✗ FFmpeg error for camera ${camera.name}:`, err.message);
        if (stderr) {
          logger.error(`FFmpeg stderr: ${stderr.substring(0, 500)}`);
        }
        session.status = CameraStatus.ERROR;
        this.emit('stream:error', camera.id, err);
      })
      .on('end', () => {
        logger.info(`Stream ended for camera ${camera.name}`);
        session.status = CameraStatus.OFFLINE;
        this.emit('stream:ended', camera.id);
      });

    session.ffmpegProcess = command;
    logger.info(`[StreamManager] Starting FFmpeg process for camera ${camera.name}...`);

    try {
      command.run();
      logger.info(`[StreamManager] FFmpeg process launched successfully for camera ${camera.name}`);
    } catch (error) {
      logger.error(`[StreamManager] Failed to launch FFmpeg for camera ${camera.name}:`, error);
      session.status = CameraStatus.ERROR;
      throw error;
    }
  }

  /**
   * Build stream URL with authentication
   */
  private buildStreamUrl(camera: Camera): string {
    let url = camera.streamUrl;

    // Add credentials for RTSP/RTMP if needed
    if ((camera.streamType === StreamType.RTSP || camera.streamType === StreamType.RTMP) &&
        camera.username && camera.password) {
      // Check if URL already contains credentials (user:pass@)
      const hasCredentials = /@/.test(url.split('://')[1]?.split('/')[0] || '');

      if (!hasCredentials) {
        // Parse URL and inject credentials only if not already present
        const urlPattern = /^(rtsp|rtmp):\/\//;
        if (urlPattern.test(url)) {
          url = url.replace(urlPattern, `$1://${camera.username}:${camera.password}@`);
        }
      }
    }

    return url;
  }

  /**
   * Add hardware acceleration based on GPU type
   */
  private addHardwareAcceleration(command: FfmpegCommand): FfmpegCommand {
    const gpuType = config.gpu.type;
    const hwaccel = config.gpu.hardwareAccel;

    if (gpuType === 'none') {
      return command;
    }

    try {
      if (gpuType === 'nvidia' && hwaccel === 'cuda') {
        command.inputOptions(['-hwaccel cuda', '-hwaccel_output_format cuda']);
      } else if (gpuType === 'intel' && hwaccel === 'qsv') {
        command.inputOptions(['-hwaccel qsv', '-hwaccel_output_format qsv']);
      } else if (gpuType === 'amd' && hwaccel === 'amf') {
        command.inputOptions(['-hwaccel amf']);
      }
    } catch (error) {
      logger.warn(`Failed to enable hardware acceleration: ${error}`);
    }

    return command;
  }

  /**
   * Stop streaming from a camera
   */
  async stopStream(cameraId: string): Promise<void> {
    const session = this.sessions.get(cameraId);
    if (!session) {
      return;
    }

    logger.info(`Stopping stream for camera ${session.camera.name}`);

    if (session.ffmpegProcess) {
      session.ffmpegProcess.kill('SIGKILL');
    }

    this.sessions.delete(cameraId);
    this.emit('stream:stopped', cameraId);

    // Clean up HLS files
    const hlsPath = path.join(this.hlsDir, cameraId);
    if (fs.existsSync(hlsPath)) {
      fs.rmSync(hlsPath, { recursive: true, force: true });
    }
  }

  /**
   * Get HLS playlist URL for a camera
   */
  getHLSUrl(cameraId: string): string | null {
    const session = this.sessions.get(cameraId);
    if (!session) {
      logger.debug(`[StreamManager] getHLSUrl: No session found for camera ${cameraId}`);
      return null;
    }
    if (session.status !== CameraStatus.ONLINE) {
      logger.debug(`[StreamManager] getHLSUrl: Camera ${cameraId} status is ${session.status}, not ONLINE`);
      return null;
    }

    return `/stream/hls/${cameraId}/playlist.m3u8`;
  }

  /**
   * Capture snapshot from camera
   */
  async captureSnapshot(camera: Camera, outputPath?: string): Promise<string> {
    const snapshotPath = outputPath || path.join(
      this.snapshotDir,
      `${camera.id}_${Date.now()}.jpg`
    );

    const streamUrl = this.buildStreamUrl(camera);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(streamUrl)
        .inputOptions(['-rtsp_transport tcp', '-timeout 5000000']);

      command = this.addHardwareAcceleration(command);

      command
        .outputOptions([
          '-vframes 1', // Capture 1 frame
          '-q:v 2', // Quality
        ])
        .output(snapshotPath)
        .on('end', () => {
          logger.debug(`Snapshot captured: ${snapshotPath}`);
          resolve(snapshotPath);
        })
        .on('error', (err) => {
          logger.error(`Failed to capture snapshot:`, err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Get active stream session
   */
  getSession(cameraId: string): StreamSession | undefined {
    return this.sessions.get(cameraId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): StreamSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if stream is active
   */
  isStreamActive(cameraId: string): boolean {
    const session = this.sessions.get(cameraId);
    return session?.status === CameraStatus.ONLINE;
  }

  /**
   * Increment viewer count
   */
  addViewer(cameraId: string): void {
    const session = this.sessions.get(cameraId);
    if (session) {
      session.viewers++;
      this.emit('viewers:changed', cameraId, session.viewers);
    }
  }

  /**
   * Decrement viewer count
   */
  removeViewer(cameraId: string): void {
    const session = this.sessions.get(cameraId);
    if (session && session.viewers > 0) {
      session.viewers--;
      this.emit('viewers:changed', cameraId, session.viewers);
    }
  }

  /**
   * Stop all streams
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all streams...');
    const promises = Array.from(this.sessions.keys()).map(id => this.stopStream(id));
    await Promise.all(promises);
  }
}

export default new StreamManager();
