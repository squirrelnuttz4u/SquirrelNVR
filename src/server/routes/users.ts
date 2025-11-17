import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { In } from 'typeorm';
import { AppDataSource } from '../database';
import { User, UserGroup } from '../database/entities';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import permissionService from '../services/auth/PermissionService';
import logger from '../utils/logger';

const router = Router();

// Get all users
router.get('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      relations: ['groups'],
      order: { username: 'ASC' },
    });

    // Remove password from response
    const sanitizedUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json(sanitizedUsers);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Users can only view their own profile unless admin
    if (req.user!.role !== 'admin' && req.user!.id !== req.params.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.params.id },
      relations: ['groups'],
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role, enabled, groupIds, allowedCameraIds, allCamerasAccess } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password required' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);

    // Check if username or email already exists
    const existing = await userRepo.findOne({
      where: [{ username }, { email }],
    });

    if (existing) {
      res.status(400).json({ error: 'Username or email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = userRepo.create({
      username,
      email,
      password: hashedPassword,
      role: role || 'user',
      enabled: enabled !== undefined ? enabled : true,
      allowedCameraIds: JSON.stringify(allowedCameraIds || []),
      allCamerasAccess: allCamerasAccess || false,
    });

    // Add groups if provided
    if (groupIds && groupIds.length > 0) {
      const groupRepo = AppDataSource.getRepository(UserGroup);
      user.groups = await groupRepo.find({ where: { id: In(groupIds) } });
    }

    await userRepo.save(user);

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Users can only update their own profile unless admin
    const isOwnProfile = req.user!.id === req.params.id;
    const isAdmin = req.user!.role === 'admin';

    if (!isAdmin && !isOwnProfile) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.params.id },
      relations: ['groups'],
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { password, role, groupIds, allowedCameraIds, allCamerasAccess, ...updateData } = req.body;

    // Non-admins cannot change role or permissions
    if (isAdmin) {
      if (role !== undefined) user.role = role;
      if (allowedCameraIds !== undefined) user.allowedCameraIds = JSON.stringify(allowedCameraIds);
      if (allCamerasAccess !== undefined) user.allCamerasAccess = allCamerasAccess;

      // Update groups
      if (groupIds !== undefined) {
        const groupRepo = AppDataSource.getRepository(UserGroup);
        user.groups = await groupRepo.find({ where: { id: In(groupIds) } });
      }
    }

    // Update allowed fields
    Object.assign(user, updateData);

    // Update password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await userRepo.save(user);

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    // Cannot delete yourself
    if (req.user!.id === req.params.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.params.id } });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await userRepo.remove(user);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get user permissions
router.get('/:id/permissions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Users can only view their own permissions unless admin
    if (req.user!.role !== 'admin' && req.user!.id !== req.params.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const permissions = await permissionService.getUserPermissions(req.params.id);
    res.json(permissions);
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

export default router;
