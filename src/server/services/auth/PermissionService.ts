import { AppDataSource } from '../../database';
import { User, UserGroup } from '../../database/entities';
import logger from '../../utils/logger';

export interface UserPermissions {
  canViewLive: boolean;
  canViewRecordings: boolean;
  canDownloadRecordings: boolean;
  canManageCameras: boolean;
  canManageRecordings: boolean;
  canManageAlarms: boolean;
  canManageUsers: boolean;
  canManageSystem: boolean;
  canControlPTZ: boolean;
  canViewAIDetections: boolean;
  canExportData: boolean;
  allowedCameraIds: string[];
  allCamerasAccess: boolean;
}

export class PermissionService {
  /**
   * Get user permissions (combined from role, groups, and individual permissions)
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['groups'],
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        return {
          canViewLive: true,
          canViewRecordings: true,
          canDownloadRecordings: true,
          canManageCameras: true,
          canManageRecordings: true,
          canManageAlarms: true,
          canManageUsers: true,
          canManageSystem: true,
          canControlPTZ: true,
          canViewAIDetections: true,
          canExportData: true,
          allowedCameraIds: [],
          allCamerasAccess: true,
        };
      }

      // Combine permissions from all groups
      let permissions: UserPermissions = {
        canViewLive: false,
        canViewRecordings: false,
        canDownloadRecordings: false,
        canManageCameras: false,
        canManageRecordings: false,
        canManageAlarms: false,
        canManageUsers: false,
        canManageSystem: false,
        canControlPTZ: false,
        canViewAIDetections: false,
        canExportData: false,
        allowedCameraIds: [],
        allCamerasAccess: user.allCamerasAccess,
      };

      // Merge group permissions (OR logic - if any group has permission, user has it)
      const cameraIdSet = new Set<string>();

      for (const group of user.groups || []) {
        permissions.canViewLive = permissions.canViewLive || group.canViewLive;
        permissions.canViewRecordings = permissions.canViewRecordings || group.canViewRecordings;
        permissions.canDownloadRecordings = permissions.canDownloadRecordings || group.canDownloadRecordings;
        permissions.canManageCameras = permissions.canManageCameras || group.canManageCameras;
        permissions.canManageRecordings = permissions.canManageRecordings || group.canManageRecordings;
        permissions.canManageAlarms = permissions.canManageAlarms || group.canManageAlarms;
        permissions.canManageUsers = permissions.canManageUsers || group.canManageUsers;
        permissions.canManageSystem = permissions.canManageSystem || group.canManageSystem;
        permissions.canControlPTZ = permissions.canControlPTZ || group.canControlPTZ;
        permissions.canViewAIDetections = permissions.canViewAIDetections || group.canViewAIDetections;
        permissions.canExportData = permissions.canExportData || group.canExportData;
        permissions.allCamerasAccess = permissions.allCamerasAccess || group.allCamerasAccess;

        // Collect allowed camera IDs from groups
        try {
          const groupCameras = JSON.parse(group.allowedCameraIds || '[]');
          groupCameras.forEach((id: string) => cameraIdSet.add(id));
        } catch (error) {
          logger.error('Error parsing group camera IDs:', error);
        }
      }

      // Add user's direct camera permissions
      try {
        const userCameras = JSON.parse(user.allowedCameraIds || '[]');
        userCameras.forEach((id: string) => cameraIdSet.add(id));
      } catch (error) {
        logger.error('Error parsing user camera IDs:', error);
      }

      permissions.allowedCameraIds = Array.from(cameraIdSet);

      return permissions;
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user can access a specific camera
   */
  async canAccessCamera(userId: string, cameraId: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);

      // If user has access to all cameras
      if (permissions.allCamerasAccess) {
        return true;
      }

      // Check if camera is in allowed list
      return permissions.allowedCameraIds.includes(cameraId);
    } catch (error) {
      logger.error('Error checking camera access:', error);
      return false;
    }
  }

  /**
   * Filter cameras based on user permissions
   */
  async filterAllowedCameras(userId: string, cameraIds: string[]): Promise<string[]> {
    try {
      const permissions = await this.getUserPermissions(userId);

      if (permissions.allCamerasAccess) {
        return cameraIds;
      }

      return cameraIds.filter(id => permissions.allowedCameraIds.includes(id));
    } catch (error) {
      logger.error('Error filtering cameras:', error);
      return [];
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: keyof UserPermissions): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return !!permissions[permission];
    } catch (error) {
      logger.error('Error checking permission:', error);
      return false;
    }
  }
}

export default new PermissionService();
