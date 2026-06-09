import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { AppDataSource } from '../../database';
import { SystemSettings, Recording, Camera } from '../../database/entities';
import { LessThan } from 'typeorm';

export interface StorageStats {
  // Logical budget (recordings vs. the configured maxStorageGB cap)
  totalGB: number;
  usedGB: number;
  availableGB: number;
  usagePercent: number;
  recordingsCount: number;
  oldestRecording?: Date;
  newestRecording?: Date;
  // Physical disk for the storage volume (from statfs)
  diskTotalGB: number;
  diskFreeGB: number;
  diskUsedPercent: number;
}

export class StorageManager extends EventEmitter {
  private cleanupInterval?: NodeJS.Timeout;
  private storagePath: string = '';

  constructor() {
    super();
  }

  /**
   * Initialize storage manager
   */
  async initialize(): Promise<void> {
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    const settings = await settingsRepo.findOne({ where: {} });

    if (settings) {
      this.storagePath = settings.storagePath;
    }

    // Ensure storage directories exist
    this.ensureDirectories();

    // Start cleanup interval (every hour)
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 3600000); // 1 hour

    // Perform initial cleanup
    await this.performCleanup();

    logger.info('✓ Storage manager initialized');
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.storagePath,
      path.join(this.storagePath, 'recordings'),
      path.join(this.storagePath, 'snapshots'),
      path.join(this.storagePath, 'thumbnails'),
      path.join(this.storagePath, 'hls'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    const settings = await settingsRepo.findOne({ where: {} });

    const recordingRepo = AppDataSource.getRepository(Recording);
    const recordings = await recordingRepo.find({
      order: { createdAt: 'ASC' },
    });

    let usedBytes = 0;
    for (const recording of recordings) {
      usedBytes += Number(recording.fileSize);
    }

    const usedGB = usedBytes / (1024 ** 3);
    const totalGB = settings?.maxStorageGB || 500;
    const availableGB = totalGB - usedGB;
    const usagePercent = (usedGB / totalGB) * 100;

    const disk = await this.getDiskUsage();

    return {
      totalGB,
      usedGB,
      availableGB,
      usagePercent,
      recordingsCount: recordings.length,
      oldestRecording: recordings[0]?.createdAt,
      newestRecording: recordings[recordings.length - 1]?.createdAt,
      diskTotalGB: disk.totalGB,
      diskFreeGB: disk.freeGB,
      diskUsedPercent: disk.usedPercent,
    };
  }

  /**
   * Physical free space for the volume backing the storage path. Returns zeros
   * if statfs is unavailable so callers can fall back to the logical budget.
   */
  private async getDiskUsage(): Promise<{ totalGB: number; freeGB: number; usedPercent: number }> {
    try {
      const target = this.storagePath && fs.existsSync(this.storagePath) ? this.storagePath : process.cwd();
      // fs.statfs is available on Node >= 18.15.
      const statfs = (fs.promises as any).statfs as
        | ((p: string) => Promise<{ bsize: number; blocks: number; bavail: number }>)
        | undefined;

      if (!statfs) {
        return { totalGB: 0, freeGB: 0, usedPercent: 0 };
      }

      const s = await statfs(target);
      const totalBytes = s.blocks * s.bsize;
      const freeBytes = s.bavail * s.bsize;
      const usedBytes = totalBytes - freeBytes;
      const totalGB = totalBytes / (1024 ** 3);
      const freeGB = freeBytes / (1024 ** 3);
      const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
      return { totalGB, freeGB, usedPercent };
    } catch (error) {
      logger.warn('Unable to read physical disk usage:', error);
      return { totalGB: 0, freeGB: 0, usedPercent: 0 };
    }
  }

  /**
   * Perform storage cleanup
   */
  async performCleanup(): Promise<void> {
    logger.info('Starting storage cleanup...');

    try {
      await this.deleteOldRecordings();
      await this.enforceStorageLimit();
      await this.cleanupOrphanedFiles();

      logger.info('✓ Storage cleanup completed');
      this.emit('cleanup:completed');
    } catch (error) {
      logger.error('Storage cleanup failed:', error);
      this.emit('cleanup:failed', error);
    }
  }

  /**
   * Delete recordings older than retention period
   */
  private async deleteOldRecordings(): Promise<void> {
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    const settings = await settingsRepo.findOne({ where: {} });

    if (!settings || !settings.autoDeleteOldRecordings) {
      return;
    }

    // Get cameras with their individual retention settings
    const cameraRepo = AppDataSource.getRepository(Camera);
    const cameras = await cameraRepo.find();

    const recordingRepo = AppDataSource.getRepository(Recording);

    for (const camera of cameras) {
      const retentionDays = camera.retentionDays || settings.defaultRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const oldRecordings = await recordingRepo.find({
        where: {
          cameraId: camera.id,
          createdAt: LessThan(cutoffDate),
        },
      });

      for (const recording of oldRecordings) {
        await this.deleteRecording(recording);
      }

      if (oldRecordings.length > 0) {
        logger.info(`Deleted ${oldRecordings.length} old recordings for camera ${camera.name}`);
      }
    }
  }

  /**
   * Enforce storage limit by deleting oldest recordings
   */
  private async enforceStorageLimit(): Promise<void> {
    let stats = await this.getStats();

    // Pressure is whichever is higher: the logical budget (cap) or the actual
    // disk. This prevents filling the underlying volume even when maxStorageGB
    // is set larger than the disk.
    const pressure = (s: StorageStats) => Math.max(s.usagePercent, s.diskUsedPercent);

    if (pressure(stats) < 90) {
      return; // Below the high-water mark on both measures
    }

    logger.warn(
      `Storage pressure high (budget ${stats.usagePercent.toFixed(1)}%, ` +
      `disk ${stats.diskUsedPercent.toFixed(1)}%), enforcing limits...`
    );

    const recordingRepo = AppDataSource.getRepository(Recording);
    const recordings = await recordingRepo.find({
      order: { createdAt: 'ASC' },
    });

    // Delete oldest recordings until we're back below the 80% low-water mark.
    for (const recording of recordings) {
      if (pressure(stats) < 80) {
        break;
      }
      await this.deleteRecording(recording);
      stats = await this.getStats();
    }

    logger.info(
      `Storage pressure reduced (budget ${stats.usagePercent.toFixed(1)}%, ` +
      `disk ${stats.diskUsedPercent.toFixed(1)}%)`
    );
  }

  /**
   * Delete a recording and its associated files
   */
  async deleteRecording(recording: Recording): Promise<void> {
    const recordingRepo = AppDataSource.getRepository(Recording);

    try {
      // Delete video file
      if (fs.existsSync(recording.filePath)) {
        fs.unlinkSync(recording.filePath);
      }

      // Delete thumbnail
      if (recording.thumbnailPath && fs.existsSync(recording.thumbnailPath)) {
        fs.unlinkSync(recording.thumbnailPath);
      }

      // Delete from database
      await recordingRepo.remove(recording);

      logger.debug(`Deleted recording: ${recording.filePath}`);
    } catch (error) {
      logger.error(`Failed to delete recording ${recording.id}:`, error);
    }
  }

  /**
   * Clean up orphaned files (files without database entries)
   */
  private async cleanupOrphanedFiles(): Promise<void> {
    const recordingsDir = path.join(this.storagePath, 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      return;
    }

    const recordingRepo = AppDataSource.getRepository(Recording);
    const allRecordings = await recordingRepo.find();
    const validPaths = new Set(allRecordings.map(r => r.filePath));

    // Recursively find all video files
    const findVideoFiles = (dir: string): string[] => {
      let files: string[] = [];

      if (!fs.existsSync(dir)) {
        return files;
      }

      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          files = files.concat(findVideoFiles(fullPath));
        } else if (item.endsWith('.mp4') || item.endsWith('.mkv') || item.endsWith('.avi')) {
          files.push(fullPath);
        }
      }

      return files;
    };

    const allVideoFiles = findVideoFiles(recordingsDir);
    let orphanedCount = 0;

    for (const file of allVideoFiles) {
      if (!validPaths.has(file)) {
        try {
          fs.unlinkSync(file);
          orphanedCount++;
          logger.debug(`Deleted orphaned file: ${file}`);
        } catch (error) {
          logger.error(`Failed to delete orphaned file ${file}:`, error);
        }
      }
    }

    if (orphanedCount > 0) {
      logger.info(`Cleaned up ${orphanedCount} orphaned files`);
    }
  }

  /**
   * Get storage path
   */
  getStoragePath(): string {
    return this.storagePath;
  }

  /**
   * Update storage path
   */
  async updateStoragePath(newPath: string): Promise<void> {
    this.storagePath = newPath;
    this.ensureDirectories();
  }

  /**
   * Stop storage manager
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    logger.info('Storage manager stopped');
  }
}

export default new StorageManager();
