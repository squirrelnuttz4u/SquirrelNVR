import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import moment from 'moment';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { Camera, Recording } from '../../database/entities';
import { RecordingMode, CameraStatus } from '../../../shared/types';
import config from '../../config';
import streamManager from '../camera/StreamManager';

export interface RecordingSession {
  cameraId: string;
  camera: Camera;
  recording: Recording;
  ffmpegProcess?: FfmpegCommand;
  startTime: Date;
  filePath: string;
  isMotionTriggered: boolean;
  shouldStop: boolean;
}

export class RecordingEngine extends EventEmitter {
  private sessions: Map<string, RecordingSession> = new Map();
  private recordingsDir: string;
  private thumbnailsDir: string;
  private motionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.recordingsDir = path.join(config.storage.path, 'recordings');
    this.thumbnailsDir = path.join(config.storage.path, 'thumbnails');

    // Create directories
    [this.recordingsDir, this.thumbnailsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Start recording for a camera based on its recording mode
   */
  async startRecording(camera: Camera, isMotionTriggered: boolean = false): Promise<void> {
    // Check if already recording
    if (this.sessions.has(camera.id)) {
      logger.debug(`Camera ${camera.name} is already recording`);
      return;
    }

    // Check if recording is scheduled
    if (!isMotionTriggered && !this.isRecordingScheduled(camera)) {
      logger.debug(`Recording not scheduled for camera ${camera.name}`);
      return;
    }

    logger.info(`Starting recording for camera ${camera.name} (motion: ${isMotionTriggered})`);

    const startTime = new Date();
    const filePath = this.generateFilePath(camera, startTime);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create recording entry in database
    const recordingRepo = AppDataSource.getRepository(Recording);
    const recording = recordingRepo.create({
      cameraId: camera.id,
      startTime,
      endTime: startTime, // Will be updated when recording stops
      duration: 0,
      fileSize: 0,
      filePath,
      recordingType: isMotionTriggered ? 'motion' : camera.recordingMode,
      hasMotion: isMotionTriggered,
      hasAI: false,
    });
    await recordingRepo.save(recording);

    const session: RecordingSession = {
      cameraId: camera.id,
      camera,
      recording,
      startTime,
      filePath,
      isMotionTriggered,
      shouldStop: false,
    };

    this.sessions.set(camera.id, session);

    try {
      await this.initializeRecording(session);
      this.emit('recording:started', camera.id, recording.id);
    } catch (error) {
      logger.error(`Failed to start recording for camera ${camera.name}:`, error);
      this.sessions.delete(camera.id);
      await recordingRepo.remove(recording);
      this.emit('recording:error', camera.id, error);
    }
  }

  /**
   * Initialize FFmpeg recording process
   */
  private async initializeRecording(session: RecordingSession): Promise<void> {
    const { camera, filePath } = session;
    const streamUrl = this.buildStreamUrl(camera);

    // Determine video quality settings
    const qualitySettings = this.getQualitySettings(camera.recordingQuality);

    let command = ffmpeg(streamUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-timeout 5000000',
        '-reconnect 1',
        '-reconnect_streamed 1',
        '-reconnect_delay_max 2',
      ]);

    // Add hardware acceleration
    command = this.addHardwareAcceleration(command);

    // Apply pre-record buffer if configured
    if (camera.preRecordSeconds > 0) {
      // Note: This is simplified. True pre-record requires a circular buffer
      logger.debug(`Pre-record buffer: ${camera.preRecordSeconds}s`);
    }

    command
      .outputOptions([
        `-c:v ${qualitySettings.codec}`,
        `-b:v ${qualitySettings.bitrate}`,
        `-r ${camera.recordingFps}`,
        '-c:a aac',
        '-b:a 128k',
        '-f mp4',
        '-movflags +faststart', // Enable streaming playback
      ])
      .output(filePath)
      .on('start', (commandLine) => {
        logger.debug(`FFmpeg recording command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        // Update recording duration periodically
        if (progress.timemark) {
          logger.debug(`Recording progress for ${camera.name}: ${progress.timemark}`);
        }
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`FFmpeg recording error for camera ${camera.name}:`, err.message);
        logger.debug('FFmpeg stderr:', stderr);
        this.handleRecordingError(session, err);
      })
      .on('end', () => {
        logger.info(`Recording ended for camera ${camera.name}`);
        this.finalizeRecording(session);
      });

    session.ffmpegProcess = command;
    command.run();
  }

  /**
   * Build stream URL with authentication
   */
  private buildStreamUrl(camera: Camera): string {
    let url = camera.streamUrl;

    if (camera.username && camera.password) {
      const urlPattern = /^(rtsp|rtmp):\/\//;
      if (urlPattern.test(url)) {
        url = url.replace(urlPattern, `$1://${camera.username}:${camera.password}@`);
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
        command.inputOptions(['-hwaccel cuda']);
      } else if (gpuType === 'intel' && hwaccel === 'qsv') {
        command.inputOptions(['-hwaccel qsv']);
      } else if (gpuType === 'amd' && hwaccel === 'amf') {
        command.inputOptions(['-hwaccel amf']);
      }
    } catch (error) {
      logger.warn(`Failed to enable hardware acceleration: ${error}`);
    }

    return command;
  }

  /**
   * Get quality settings based on recording quality
   */
  private getQualitySettings(quality: string): { codec: string; bitrate: string } {
    const settings = {
      low: { codec: 'h264', bitrate: '1M' },
      medium: { codec: 'h264', bitrate: '2M' },
      high: { codec: 'h264', bitrate: '4M' },
      ultra: { codec: 'h264', bitrate: '8M' },
    };

    // Use GPU encoder if available
    const gpuType = config.gpu.type;
    if (gpuType === 'nvidia') {
      settings.low.codec = 'h264_nvenc';
      settings.medium.codec = 'h264_nvenc';
      settings.high.codec = 'h264_nvenc';
      settings.ultra.codec = 'h264_nvenc';
    } else if (gpuType === 'intel') {
      settings.low.codec = 'h264_qsv';
      settings.medium.codec = 'h264_qsv';
      settings.high.codec = 'h264_qsv';
      settings.ultra.codec = 'h264_qsv';
    }

    return settings[quality as keyof typeof settings] || settings.high;
  }

  /**
   * Generate file path for recording
   */
  private generateFilePath(camera: Camera, startTime: Date): string {
    const date = moment(startTime);
    const yearMonth = date.format('YYYY-MM');
    const day = date.format('DD');
    const filename = `${camera.id}_${date.format('YYYY-MM-DD_HH-mm-ss')}.mp4`;

    return path.join(this.recordingsDir, camera.id, yearMonth, day, filename);
  }

  /**
   * Check if recording is currently scheduled
   */
  private isRecordingScheduled(camera: Camera): boolean {
    if (!camera.recordingSchedule) {
      return camera.recordingMode === RecordingMode.CONTINUOUS;
    }

    try {
      const schedules = JSON.parse(camera.recordingSchedule);
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = moment(now).format('HH:mm');

      return schedules.some((schedule: any) => {
        if (!schedule.enabled) return false;
        if (!schedule.dayOfWeek.includes(currentDay)) return false;

        return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
      });
    } catch (error) {
      logger.error('Failed to parse recording schedule:', error);
      return camera.recordingMode === RecordingMode.CONTINUOUS;
    }
  }

  /**
   * Stop recording for a camera
   */
  async stopRecording(cameraId: string, immediate: boolean = false): Promise<void> {
    const session = this.sessions.get(cameraId);
    if (!session) {
      return;
    }

    logger.info(`Stopping recording for camera ${session.camera.name}`);

    // Handle post-record delay
    if (!immediate && session.camera.postRecordSeconds > 0 && session.isMotionTriggered) {
      session.shouldStop = true;
      setTimeout(() => {
        this.stopRecordingImmediate(cameraId);
      }, session.camera.postRecordSeconds * 1000);
      return;
    }

    await this.stopRecordingImmediate(cameraId);
  }

  /**
   * Stop recording immediately
   */
  private async stopRecordingImmediate(cameraId: string): Promise<void> {
    const session = this.sessions.get(cameraId);
    if (!session) {
      return;
    }

    if (session.ffmpegProcess) {
      session.ffmpegProcess.kill('SIGINT'); // Graceful stop
    } else {
      await this.finalizeRecording(session);
    }
  }

  /**
   * Finalize recording (update database, generate thumbnail)
   */
  private async finalizeRecording(session: RecordingSession): Promise<void> {
    const { recording, filePath, startTime } = session;

    try {
      // Get file stats
      const stats = fs.statSync(filePath);
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(filePath, recording.id);

      // Update recording in database
      const recordingRepo = AppDataSource.getRepository(Recording);
      recording.endTime = endTime;
      recording.duration = duration;
      recording.fileSize = stats.size;
      recording.thumbnailPath = thumbnailPath;
      await recordingRepo.save(recording);

      logger.info(`Recording finalized: ${filePath} (${duration}s, ${stats.size} bytes)`);
      this.emit('recording:completed', session.cameraId, recording.id);
    } catch (error) {
      logger.error('Failed to finalize recording:', error);
    } finally {
      this.sessions.delete(session.cameraId);
    }
  }

  /**
   * Handle recording error
   */
  private async handleRecordingError(session: RecordingSession, error: Error): Promise<void> {
    logger.error(`Recording error for camera ${session.camera.name}:`, error);

    // Remove recording from database if file wasn't created
    if (!fs.existsSync(session.filePath)) {
      const recordingRepo = AppDataSource.getRepository(Recording);
      await recordingRepo.remove(session.recording);
    }

    this.sessions.delete(session.cameraId);
    this.emit('recording:error', session.cameraId, error);
  }

  /**
   * Generate thumbnail from recording
   */
  private async generateThumbnail(videoPath: string, recordingId: string): Promise<string> {
    const thumbnailPath = path.join(this.thumbnailsDir, `${recordingId}.jpg`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          count: 1,
          filename: `${recordingId}.jpg`,
          folder: this.thumbnailsDir,
          size: '320x240',
        })
        .on('end', () => {
          resolve(thumbnailPath);
        })
        .on('error', (err) => {
          logger.error('Failed to generate thumbnail:', err);
          reject(err);
        });
    });
  }

  /**
   * Handle motion detection event
   */
  onMotionDetected(cameraId: string): void {
    const session = this.sessions.get(cameraId);

    // Clear existing motion timer
    const existingTimer = this.motionTimers.get(cameraId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Start recording if not already recording
    if (!session) {
      AppDataSource.getRepository(Camera)
        .findOne({ where: { id: cameraId } })
        .then(camera => {
          if (camera && camera.motionEnabled &&
              (camera.recordingMode === RecordingMode.MOTION ||
               camera.recordingMode === RecordingMode.MOTION_AND_SCHEDULED)) {
            this.startRecording(camera, true);
          }
        });
    } else if (session.isMotionTriggered) {
      // Reset the shouldStop flag if motion continues
      session.shouldStop = false;
    }

    // Set timer to stop recording after motion ends
    const timer = setTimeout(() => {
      this.stopRecording(cameraId);
    }, 30000); // 30 seconds after last motion

    this.motionTimers.set(cameraId, timer);
  }

  /**
   * Check if camera is currently recording
   */
  isRecording(cameraId: string): boolean {
    return this.sessions.has(cameraId);
  }

  /**
   * Get active recording session
   */
  getSession(cameraId: string): RecordingSession | undefined {
    return this.sessions.get(cameraId);
  }

  /**
   * Stop all recordings
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all recordings...');
    const promises = Array.from(this.sessions.keys()).map(id =>
      this.stopRecording(id, true)
    );
    await Promise.all(promises);
  }
}

export default new RecordingEngine();
