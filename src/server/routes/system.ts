import { Router, Response } from 'express';
import os from 'os';
import { AppDataSource } from '../database';
import { SystemSettings, Camera, Recording, AIDetection } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import storageManager from '../services/storage/StorageManager';
import notificationService from '../services/notification/NotificationService';
import logger from '../utils/logger';
import { MoreThan } from 'typeorm';

const router = Router();

// Get system statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cameraRepo = AppDataSource.getRepository(Camera);
    const recordingRepo = AppDataSource.getRepository(Recording);
    const detectionRepo = AppDataSource.getRepository(AIDetection);

    const totalCameras = await cameraRepo.count();
    const activeCameras = await cameraRepo.count({ where: { enabled: true } });
    const recordingsCount = await recordingRepo.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const detectionsToday = await detectionRepo.count({
      where: { timestamp: MoreThan(today) },
    });

    const storageStats = await storageManager.getStats();

    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    res.json({
      cpuUsage,
      memoryUsage,
      diskUsage: storageStats.usagePercent,
      storageUsed: storageStats.usedGB,
      storageTotal: storageStats.totalGB,
      activeCameras,
      totalCameras,
      recordingsCount,
      detectionsToday,
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// Get system settings
router.get('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    let settings = await settingsRepo.findOne({ where: {} });

    if (!settings) {
      settings = settingsRepo.create({});
      await settingsRepo.save(settings);
    }

    // Don't send sensitive data to non-admin users
    if (req.user!.role !== 'admin') {
      const { smtpPassword, ...publicSettings } = settings as any;
      res.json(publicSettings);
    } else {
      res.json(settings);
    }
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system settings
router.put('/settings', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const settingsRepo = AppDataSource.getRepository(SystemSettings);
    let settings = await settingsRepo.findOne({ where: {} });

    if (!settings) {
      settings = await settingsRepo.save(settingsRepo.create(req.body)) as SystemSettings;
    } else {
      Object.assign(settings, req.body);
      settings = await settingsRepo.save(settings) as SystemSettings;
    }

    // Reload notification service if email settings changed
    if (req.body.smtpHost || req.body.smtpPort || req.body.smtpUser || req.body.smtpPassword) {
      await notificationService.reloadSettings();
    }

    // Update storage path if changed
    if (req.body.storagePath) {
      await storageManager.updateStoragePath(req.body.storagePath);
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test email settings
router.post('/test-email', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email address required' });
      return;
    }

    const success = await notificationService.sendTestEmail(email);

    if (success) {
      res.json({ message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email' });
    }
  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Get storage statistics
router.get('/storage', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await storageManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching storage stats:', error);
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

// Trigger storage cleanup
router.post('/storage/cleanup', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await storageManager.performCleanup();
    res.json({ message: 'Storage cleanup completed' });
  } catch (error) {
    logger.error('Error performing storage cleanup:', error);
    res.status(500).json({ error: 'Failed to perform storage cleanup' });
  }
});

// Get system logs
router.get('/logs', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const logsDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logsDir, 'combined.log');

    if (!fs.existsSync(logFile)) {
      res.json({ logs: [] });
      return;
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const logs = lines.slice(-100).reverse().map((line: string) => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line };
      }
    });

    res.json({ logs });
  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
