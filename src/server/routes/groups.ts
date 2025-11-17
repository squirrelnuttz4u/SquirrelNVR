import { Router, Response } from 'express';
import { AppDataSource } from '../database';
import { UserGroup, User } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Get all groups
router.get('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);
    const groups = await groupRepo.find({
      relations: ['users'],
      order: { name: 'ASC' },
    });

    res.json(groups);
  } catch (error) {
    logger.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group by ID
router.get('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);
    const group = await groupRepo.findOne({
      where: { id: req.params.id },
      relations: ['users'],
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    res.json(group);
  } catch (error) {
    logger.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Create group
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);

    // Check if group name already exists
    const existing = await groupRepo.findOne({ where: { name: req.body.name } });
    if (existing) {
      res.status(400).json({ error: 'Group name already exists' });
      return;
    }

    const group = groupRepo.create({
      ...req.body,
      allowedCameraIds: JSON.stringify(req.body.allowedCameraIds || []),
    });

    await groupRepo.save(group);

    res.status(201).json(group);
  } catch (error) {
    logger.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);
    const group = await groupRepo.findOne({ where: { id: req.params.id } });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const { allowedCameraIds, ...updateData } = req.body;

    Object.assign(group, updateData);

    if (allowedCameraIds !== undefined) {
      group.allowedCameraIds = JSON.stringify(allowedCameraIds);
    }

    await groupRepo.save(group);

    res.json(group);
  } catch (error) {
    logger.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);
    const group = await groupRepo.findOne({
      where: { id: req.params.id },
      relations: ['users'],
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Remove group from all users
    if (group.users && group.users.length > 0) {
      const userRepo = AppDataSource.getRepository(User);
      for (const user of group.users) {
        user.groups = user.groups.filter(g => g.id !== group.id);
        await userRepo.save(user);
      }
    }

    await groupRepo.remove(group);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    logger.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Add users to group
router.post('/:id/users', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ error: 'User IDs array required' });
      return;
    }

    const groupRepo = AppDataSource.getRepository(UserGroup);
    const userRepo = AppDataSource.getRepository(User);

    const group = await groupRepo.findOne({
      where: { id: req.params.id },
      relations: ['users'],
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const users = await userRepo.findByIds(userIds);

    // Add new users to group (avoid duplicates)
    const existingUserIds = new Set(group.users.map(u => u.id));
    const newUsers = users.filter(u => !existingUserIds.has(u.id));

    group.users = [...group.users, ...newUsers];
    await groupRepo.save(group);

    res.json(group);
  } catch (error) {
    logger.error('Error adding users to group:', error);
    res.status(500).json({ error: 'Failed to add users to group' });
  }
});

// Remove user from group
router.delete('/:id/users/:userId', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const groupRepo = AppDataSource.getRepository(UserGroup);
    const group = await groupRepo.findOne({
      where: { id: req.params.id },
      relations: ['users'],
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    group.users = group.users.filter(u => u.id !== req.params.userId);
    await groupRepo.save(group);

    res.json(group);
  } catch (error) {
    logger.error('Error removing user from group:', error);
    res.status(500).json({ error: 'Failed to remove user from group' });
  }
});

export default router;
