import { Router, Response } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../database';
import { AIDetection, LicensePlate } from '../database/entities';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Get AI detections
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      cameraId,
      detectionType,
      startDate,
      endDate,
      minConfidence,
      limit = 50,
      offset = 0,
    } = req.query;

    const where: any = {};

    if (cameraId) {
      where.cameraId = cameraId;
    }

    if (detectionType) {
      where.detectionType = detectionType;
    }

    if (startDate && endDate) {
      where.timestamp = Between(new Date(startDate as string), new Date(endDate as string));
    }

    const detectionRepo = AppDataSource.getRepository(AIDetection);
    let query = detectionRepo.createQueryBuilder('detection')
      .leftJoinAndSelect('detection.camera', 'camera')
      .where(where)
      .orderBy('detection.timestamp', 'DESC')
      .take(Number(limit))
      .skip(Number(offset));

    if (minConfidence) {
      query = query.andWhere('detection.confidence >= :minConfidence', {
        minConfidence: Number(minConfidence),
      });
    }

    const [detections, total] = await query.getManyAndCount();

    res.json({
      detections,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    logger.error('Error fetching detections:', error);
    res.status(500).json({ error: 'Failed to fetch detections' });
  }
});

// Get detection snapshot
router.get('/:id/snapshot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const detectionRepo = AppDataSource.getRepository(AIDetection);
    const detection = await detectionRepo.findOne({ where: { id: req.params.id } });

    if (!detection || !detection.snapshotPath) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.sendFile(detection.snapshotPath);
  } catch (error) {
    logger.error('Error fetching detection snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

// Get license plates
router.get('/license-plates', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      cameraId,
      plateNumber,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const where: any = {};

    if (cameraId) {
      where.cameraId = cameraId;
    }

    if (plateNumber) {
      where.plateNumber = plateNumber;
    }

    if (startDate && endDate) {
      where.timestamp = Between(new Date(startDate as string), new Date(endDate as string));
    }

    const plateRepo = AppDataSource.getRepository(LicensePlate);
    const [plates, total] = await plateRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      take: Number(limit),
      skip: Number(offset),
      relations: ['camera'],
    });

    res.json({
      plates,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    logger.error('Error fetching license plates:', error);
    res.status(500).json({ error: 'Failed to fetch license plates' });
  }
});

// Search license plates
router.get('/license-plates/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query) {
      res.status(400).json({ error: 'Search query required' });
      return;
    }

    const plateRepo = AppDataSource.getRepository(LicensePlate);
    const plates = await plateRepo.createQueryBuilder('plate')
      .leftJoinAndSelect('plate.camera', 'camera')
      .where('plate.plateNumber LIKE :query', { query: `%${query}%` })
      .orderBy('plate.timestamp', 'DESC')
      .take(50)
      .getMany();

    res.json(plates);
  } catch (error) {
    logger.error('Error searching license plates:', error);
    res.status(500).json({ error: 'Failed to search license plates' });
  }
});

export default router;
