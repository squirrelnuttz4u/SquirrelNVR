import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import permissionService, { UserPermissions } from '../services/auth/PermissionService';
import logger from '../utils/logger';

/**
 * Extend AuthRequest to include permissions
 */
export interface PermissionRequest extends AuthRequest {
  permissions?: UserPermissions;
}

/**
 * Load user permissions middleware
 */
export const loadPermissions = async (
  req: PermissionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const permissions = await permissionService.getUserPermissions(req.user.id);
    req.permissions = permissions;
    next();
  } catch (error) {
    logger.error('Error loading permissions:', error);
    res.status(500).json({ error: 'Failed to load permissions' });
  }
};

/**
 * Require specific permission middleware
 */
export const requirePermission = (...requiredPermissions: (keyof UserPermissions)[]) => {
  return async (req: PermissionRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Admin bypasses all permission checks
      if (req.user.role === 'admin') {
        next();
        return;
      }

      if (!req.permissions) {
        req.permissions = await permissionService.getUserPermissions(req.user.id);
      }

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(
        permission => req.permissions![permission] === true
      );

      if (!hasAllPermissions) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermissions,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Check camera access middleware
 */
export const requireCameraAccess = async (
  req: PermissionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admin has access to all cameras
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const cameraId = req.params.cameraId || req.params.id || req.body.cameraId;

    if (!cameraId) {
      res.status(400).json({ error: 'Camera ID required' });
      return;
    }

    const hasAccess = await permissionService.canAccessCamera(req.user.id, cameraId);

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied to this camera' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Camera access check error:', error);
    res.status(500).json({ error: 'Access check failed' });
  }
};
