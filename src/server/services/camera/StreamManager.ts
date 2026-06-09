import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger';
import { Camera } from '../../database/entities';
import { StreamType, CameraStatus } from '../../../shared/types';
import config from '../../config';

// Allow operators to point at a specific FFmpeg/FFprobe binary. fluent-ffmpeg
// also honours these env vars implicitly, but setting them explicitly makes
// the behaviour obvious and works regardless of how the process was launched.
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

export interface StreamSession {
  cameraId: string;
  camera: Camera;
  ffmpegProcess?: FfmpegCommand;
  status: CameraStatus;
  viewers: number;
  startTime: Date;
  connectionTimeout?: NodeJS.Timeout;
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
   * Verify that FFmpeg is installed and reachable. Logs a clear warning rather
   * than throwing, so the management UI/API stays up even if FFmpeg is missing
   * (streaming, snapshots and recording simply won't work until it's fixed).
   */
  async checkFfmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          logger.error(
            '✗ FFmpeg not found or not runnable. Streaming, snapshots and recording will be unavailable. ' +
            'Install FFmpeg and ensure it is on PATH, or set FFMPEG_PATH/FFPROBE_PATH.'
          );
          resolve(false);
        } else {
          logger.info('✓ FFmpeg is available');
          resolve(true);
        }
      });
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

    // Build video filters
    const videoFilters = this.buildVideoFilters(camera);
    const hasFilters = videoFilters.length > 0;

    if (hasFilters) {
      logger.info(`[StreamManager] Applying video filters for ${camera.name}: ${videoFilters.join(', ')}`);
    }

    // Output options - use encoding if filters are applied, otherwise copy
    const outputOptions = [
      hasFilters ? '-c:v libx264' : '-c:v copy', // Encode if filters, otherwise copy
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
    ];

    // Add encoding options if using filters
    if (hasFilters) {
      outputOptions.push('-preset ultrafast'); // Fast encoding
      outputOptions.push('-tune zerolatency'); // Low latency
      outputOptions.push(`-vf ${videoFilters.join(',')}`); // Apply filters
    }

    // Output to HLS
    command
      .outputOptions(outputOptions)
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
          // Clear connection timeout since we're now online
          if (session.connectionTimeout) {
            clearTimeout(session.connectionTimeout);
            session.connectionTimeout = undefined;
          }
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

      // Set connection timeout - if not ONLINE within 30 seconds, mark as ERROR
      session.connectionTimeout = setTimeout(() => {
        if (session.status === CameraStatus.CONNECTING) {
          logger.error(`[StreamManager] Connection timeout for camera ${camera.name} - failed to connect within 30 seconds`);
          session.status = CameraStatus.ERROR;
          this.emit('stream:error', camera.id, new Error('Connection timeout'));

          // Kill the FFmpeg process
          if (session.ffmpegProcess) {
            session.ffmpegProcess.kill('SIGKILL');
          }
        }
      }, 30000);
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

    // Add codec parameters for Axis cameras if not already present
    if (camera.streamType === StreamType.RTSP && url.includes('axis-media/media.amp')) {
      // Check if URL already has parameters
      if (!url.includes('?')) {
        // Add h264 codec and resolution parameters for better compatibility
        url += '?videocodec=h264&resolution=1920x1080';
        logger.info(`[StreamManager] Added Axis camera parameters: videocodec=h264&resolution=1920x1080`);
      }
    }

    return url;
  }

  /**
   * Build video filter string from camera settings
   */
  private buildVideoFilters(camera: Camera): string[] {
    const filters: string[] = [];

    // Rotation
    if (camera.rotation === 90) {
      filters.push('transpose=1');
    } else if (camera.rotation === 180) {
      filters.push('transpose=1,transpose=1');
    } else if (camera.rotation === 270) {
      filters.push('transpose=2');
    }

    // Flip
    if (camera.flipHorizontal) {
      filters.push('hflip');
    }
    if (camera.flipVertical) {
      filters.push('vflip');
    }

    // Brightness, contrast, saturation (only if not default)
    const brightness = camera.brightness ?? 1.0;
    const contrast = camera.contrast ?? 1.0;
    const saturation = camera.saturation ?? 1.0;

    if (brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0) {
      filters.push(`eq=brightness=${brightness - 1}:contrast=${contrast}:saturation=${saturation}`);
    }

    return filters;
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

    // Clear connection timeout
    if (session.connectionTimeout) {
      clearTimeout(session.connectionTimeout);
      session.connectionTimeout = undefined;
    }

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
   * Test camera connection without starting full stream
   */
  async testConnection(camera: Camera): Promise<{ success: boolean; message: string; details?: any }> {
    logger.info(`[StreamManager] Testing connection for camera: ${camera.name}`);

    const streamUrl = this.buildStreamUrl(camera);
    const maskedUrl = streamUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1$2:****@');
    logger.info(`[StreamManager] Testing URL: ${maskedUrl}`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.error(`[StreamManager] Connection test timeout for ${camera.name}`);
        resolve({
          success: false,
          message: 'Connection timeout - camera not responding after 15 seconds',
          details: { timeout: true }
        });
      }, 15000);

      let errorDetails: any = null;

      const command = ffmpeg(streamUrl)
        .inputOptions([
          '-rtsp_transport tcp',
          // Socket I/O timeout in microseconds. (`-stimeout` was removed in
          // FFmpeg 5+; `-timeout` is the supported option for the RTSP demuxer.)
          '-timeout 5000000'
        ])
        .outputOptions([
          '-vframes 1',
          '-f null'
        ])
        .output('-')
        .on('start', (cmd) => {
          logger.info(`[StreamManager] Test connection command: ${cmd.substring(0, 200)}...`);
        })
        .on('error', (err, stdout, stderr) => {
          clearTimeout(timeout);

          const errorMsg = err.message || 'Unknown error';
          logger.error(`[StreamManager] Connection test failed for ${camera.name}:`, errorMsg);

          if (stderr) {
            logger.error(`[StreamManager] FFmpeg stderr:`, stderr.substring(0, 500));
          }

          // Parse common errors
          let message = 'Failed to connect to camera';
          if (errorMsg.includes('5XX Server Error') || stderr?.includes('5XX Server Error')) {
            message = 'Camera returned 5XX error - wrong stream path or camera overloaded';
            errorDetails = { errorType: '5XX', suggestion: 'Try alternative stream paths or reduce camera load' };
          } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            message = 'Authentication failed - check username and password';
            errorDetails = { errorType: 'auth', suggestion: 'Verify camera credentials' };
          } else if (errorMsg.includes('timed out') || errorMsg.includes('timeout')) {
            message = 'Connection timeout - camera not reachable';
            errorDetails = { errorType: 'timeout', suggestion: 'Check camera IP address and network connectivity' };
          } else if (errorMsg.includes('Connection refused')) {
            message = 'Connection refused - check port and RTSP is enabled';
            errorDetails = { errorType: 'refused', suggestion: 'Verify RTSP port and service is running' };
          }

          resolve({
            success: false,
            message,
            details: { error: errorMsg, stderr: stderr?.substring(0, 200), ...errorDetails }
          });
        })
        .on('end', () => {
          clearTimeout(timeout);
          logger.info(`[StreamManager] ✓ Connection test successful for ${camera.name}`);
          resolve({
            success: true,
            message: 'Successfully connected to camera',
            details: { url: maskedUrl }
          });
        });

      try {
        command.run();
      } catch (error) {
        clearTimeout(timeout);
        logger.error(`[StreamManager] Failed to run connection test:`, error);
        resolve({
          success: false,
          message: 'Failed to start connection test',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });
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
