import { EventEmitter } from 'events';
import path from 'path';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { Alarm, AlarmEvent, Camera, AIDetection } from '../../database/entities';
import { AlarmSeverity } from '../../../shared/types';
import notificationService from '../notification/NotificationService';
import streamManager from '../camera/StreamManager';
import recordingEngine from '../recording/RecordingEngine';
import aiDetectionCoordinator from '../ai/AIDetectionCoordinator';

export class AlarmCoordinator extends EventEmitter {
  private isInitialized: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize alarm coordinator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Listen to AI detection events
    aiDetectionCoordinator.on('detection', async (data) => {
      await this.handleDetection(data.cameraId, data.detection);
    });

    // Motion events are delivered via onMotion() (wired from the motion
    // detector at the server level) rather than inferred from recording state.

    this.isInitialized = true;
    logger.info('✓ Alarm coordinator initialized');
  }

  /**
   * Handle AI detection event
   */
  private async handleDetection(cameraId: string, detection: any): Promise<void> {
    try {
      const alarmRepo = AppDataSource.getRepository(Alarm);
      const alarms = await alarmRepo.find({ where: { enabled: true } });

      for (const alarm of alarms) {
        // Check if this camera is monitored by this alarm
        const cameraIds = JSON.parse(alarm.cameraIds || '[]');
        if (!cameraIds.includes(cameraId)) {
          continue;
        }

        // Check if alarm is triggered by AI
        if (!alarm.triggerOnAI) {
          continue;
        }

        // Check detection type
        const triggerTypes = JSON.parse(alarm.triggerDetectionTypes || '[]');
        if (triggerTypes.length > 0 && !triggerTypes.includes(detection.type)) {
          continue;
        }

        // Check confidence threshold
        if (detection.confidence < alarm.minimumConfidence) {
          continue;
        }

        // Check schedule
        if (!this.isAlarmScheduled(alarm)) {
          continue;
        }

        // Trigger alarm
        await this.triggerAlarm(alarm, cameraId, detection);
      }
    } catch (error) {
      logger.error('Error handling AI detection for alarms:', error);
    }
  }

  /**
   * Entry point for motion events from the motion detector.
   */
  async onMotion(cameraId: string): Promise<void> {
    await this.handleMotionDetection(cameraId);
  }

  /**
   * Handle motion detection event
   */
  private async handleMotionDetection(cameraId: string): Promise<void> {
    try {
      const alarmRepo = AppDataSource.getRepository(Alarm);
      const alarms = await alarmRepo.find({ where: { enabled: true } });

      for (const alarm of alarms) {
        const cameraIds = JSON.parse(alarm.cameraIds || '[]');
        if (!cameraIds.includes(cameraId)) {
          continue;
        }

        if (!alarm.triggerOnMotion) {
          continue;
        }

        if (!this.isAlarmScheduled(alarm)) {
          continue;
        }

        await this.triggerAlarm(alarm, cameraId);
      }
    } catch (error) {
      logger.error('Error handling motion detection for alarms:', error);
    }
  }

  /**
   * Trigger an alarm
   */
  private async triggerAlarm(
    alarm: Alarm,
    cameraId: string,
    detection?: any
  ): Promise<void> {
    try {
      const cameraRepo = AppDataSource.getRepository(Camera);
      const camera = await cameraRepo.findOne({ where: { id: cameraId } });

      if (!camera) {
        logger.error(`Camera ${cameraId} not found`);
        return;
      }

      logger.info(`Alarm triggered: ${alarm.name} for camera ${camera.name}`);

      let snapshotPath: string | undefined;
      let videoPath: string | undefined;

      // Take snapshot if configured
      if (alarm.takeSnapshot) {
        try {
          snapshotPath = await streamManager.captureSnapshot(camera);
        } catch (error) {
          logger.error('Failed to capture snapshot for alarm:', error);
        }
      }

      // Get video path if recording
      if (alarm.recordVideo) {
        const recordingSession = recordingEngine.getSession(cameraId);
        if (recordingSession) {
          videoPath = recordingSession.filePath;
        } else {
          // Start recording if not already recording
          await recordingEngine.startRecording(camera, true);
        }
      }

      // Create alarm event
      const eventRepo = AppDataSource.getRepository(AlarmEvent);
      const alarmEvent = eventRepo.create({
        alarmId: alarm.id,
        cameraId,
        timestamp: new Date(),
        severity: alarm.severity,
        message: this.buildAlarmMessage(alarm, camera, detection),
        acknowledged: false,
        snapshotPath: snapshotPath || detection?.snapshotPath,
        videoPath,
      });

      await eventRepo.save(alarmEvent);

      // Send notifications
      await notificationService.sendAlarmNotification(alarm, alarmEvent, camera);

      this.emit('alarm:triggered', {
        alarm,
        event: alarmEvent,
        camera,
      });
    } catch (error) {
      logger.error('Failed to trigger alarm:', error);
    }
  }

  /**
   * Build alarm message
   */
  private buildAlarmMessage(alarm: Alarm, camera: Camera, detection?: any): string {
    let message = `Alarm "${alarm.name}" triggered on camera "${camera.name}"`;

    if (detection) {
      message += ` - ${detection.label} detected (${(detection.confidence * 100).toFixed(1)}% confidence)`;
    }

    return message;
  }

  /**
   * Check if alarm is currently scheduled
   */
  private isAlarmScheduled(alarm: Alarm): boolean {
    if (!alarm.schedule) {
      return true; // No schedule means always active
    }

    try {
      const schedules = JSON.parse(alarm.schedule);
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().substring(0, 5); // HH:mm

      return schedules.some((schedule: any) => {
        if (!schedule.enabled) return false;
        if (!schedule.dayOfWeek.includes(currentDay)) return false;

        return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
      });
    } catch (error) {
      logger.error('Failed to parse alarm schedule:', error);
      return true;
    }
  }

  /**
   * Acknowledge an alarm event
   */
  async acknowledgeEvent(eventId: string, userId: string): Promise<boolean> {
    try {
      const eventRepo = AppDataSource.getRepository(AlarmEvent);
      const event = await eventRepo.findOne({ where: { id: eventId } });

      if (!event) {
        return false;
      }

      event.acknowledged = true;
      event.acknowledgedAt = new Date();
      event.acknowledgedBy = userId;

      await eventRepo.save(event);

      logger.info(`Alarm event ${eventId} acknowledged by user ${userId}`);
      this.emit('alarm:acknowledged', event);

      return true;
    } catch (error) {
      logger.error('Failed to acknowledge alarm event:', error);
      return false;
    }
  }

  /**
   * Test an alarm
   */
  async testAlarm(alarmId: string): Promise<boolean> {
    try {
      const alarmRepo = AppDataSource.getRepository(Alarm);
      const alarm = await alarmRepo.findOne({ where: { id: alarmId } });

      if (!alarm) {
        return false;
      }

      const cameraIds = JSON.parse(alarm.cameraIds || '[]');
      if (cameraIds.length === 0) {
        return false;
      }

      const cameraRepo = AppDataSource.getRepository(Camera);
      const camera = await cameraRepo.findOne({ where: { id: cameraIds[0] } });

      if (!camera) {
        return false;
      }

      logger.info(`Testing alarm: ${alarm.name}`);

      await this.triggerAlarm(alarm, camera.id, {
        type: 'test',
        label: 'Test Detection',
        confidence: 1.0,
      });

      return true;
    } catch (error) {
      logger.error('Failed to test alarm:', error);
      return false;
    }
  }
}

export default new AlarmCoordinator();
