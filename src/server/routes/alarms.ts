import { Router, Response } from 'express';
import { AppDataSource } from '../database';
import { Alarm, AlarmEvent } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import alarmCoordinator from '../services/alarm/AlarmCoordinator';
import logger from '../utils/logger';

const router = Router();

// Get all alarms
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const alarmRepo = AppDataSource.getRepository(Alarm);
    const alarms = await alarmRepo.find({ order: { name: 'ASC' } });

    res.json(alarms);
  } catch (error) {
    logger.error('Error fetching alarms:', error);
    res.status(500).json({ error: 'Failed to fetch alarms' });
  }
});

// Create alarm
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const alarmRepo = AppDataSource.getRepository(Alarm);
    const alarm = alarmRepo.create(req.body);
    await alarmRepo.save(alarm);

    res.status(201).json(alarm);
  } catch (error) {
    logger.error('Error creating alarm:', error);
    res.status(500).json({ error: 'Failed to create alarm' });
  }
});

// Update alarm
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const alarmRepo = AppDataSource.getRepository(Alarm);
    const alarm = await alarmRepo.findOne({ where: { id: req.params.id } });

    if (!alarm) {
      res.status(404).json({ error: 'Alarm not found' });
      return;
    }

    Object.assign(alarm, req.body);
    await alarmRepo.save(alarm);

    res.json(alarm);
  } catch (error) {
    logger.error('Error updating alarm:', error);
    res.status(500).json({ error: 'Failed to update alarm' });
  }
});

// Delete alarm
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const alarmRepo = AppDataSource.getRepository(Alarm);
    const alarm = await alarmRepo.findOne({ where: { id: req.params.id } });

    if (!alarm) {
      res.status(404).json({ error: 'Alarm not found' });
      return;
    }

    await alarmRepo.remove(alarm);

    res.json({ message: 'Alarm deleted successfully' });
  } catch (error) {
    logger.error('Error deleting alarm:', error);
    res.status(500).json({ error: 'Failed to delete alarm' });
  }
});

// Test alarm
router.post('/:id/test', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const success = await alarmCoordinator.testAlarm(req.params.id);

    if (success) {
      res.json({ message: 'Alarm test triggered successfully' });
    } else {
      res.status(400).json({ error: 'Failed to test alarm' });
    }
  } catch (error) {
    logger.error('Error testing alarm:', error);
    res.status(500).json({ error: 'Failed to test alarm' });
  }
});

// Get alarm events
router.get('/events', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { alarmId, acknowledged, limit = 50, offset = 0 } = req.query;

    const where: any = {};

    if (alarmId) {
      where.alarmId = alarmId;
    }

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    const eventRepo = AppDataSource.getRepository(AlarmEvent);
    const [events, total] = await eventRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      take: Number(limit),
      skip: Number(offset),
      relations: ['alarm', 'camera'],
    });

    res.json({
      events,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    logger.error('Error fetching alarm events:', error);
    res.status(500).json({ error: 'Failed to fetch alarm events' });
  }
});

// Acknowledge alarm event
router.post('/events/:id/acknowledge', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const success = await alarmCoordinator.acknowledgeEvent(req.params.id, req.user!.id);

    if (success) {
      res.json({ message: 'Alarm event acknowledged' });
    } else {
      res.status(404).json({ error: 'Alarm event not found' });
    }
  } catch (error) {
    logger.error('Error acknowledging alarm event:', error);
    res.status(500).json({ error: 'Failed to acknowledge alarm event' });
  }
});

export default router;
