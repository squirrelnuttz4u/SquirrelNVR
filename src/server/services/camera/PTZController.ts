import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { Camera } from '../../database/entities';
import ReolinkService from './ReolinkService';

export interface PTZCommand {
  action: 'up' | 'down' | 'left' | 'right' | 'zoomIn' | 'zoomOut' | 'stop' | 'preset';
  speed?: number;
  presetId?: number;
}

export interface PTZPreset {
  id: number;
  name: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

export class PTZController extends EventEmitter {
  private reolinkServices: Map<string, ReolinkService> = new Map();

  /**
   * Initialize PTZ controller for a camera
   */
  async initializeCamera(camera: Camera): Promise<boolean> {
    try {
      // Check if camera supports PTZ
      const metadata = camera.model ? JSON.parse(camera.model) : {};
      if (!metadata.supportsPTZ) {
        logger.debug(`Camera ${camera.name} does not support PTZ`);
        return false;
      }

      // Initialize based on vendor
      if (camera.manufacturer?.toLowerCase() === 'reolink') {
        const ip = this.extractIPFromUrl(camera.streamUrl);
        if (ip) {
          const reolink = new ReolinkService(ip, camera.username, camera.password);
          const connected = await reolink.testConnection();

          if (connected) {
            this.reolinkServices.set(camera.id, reolink);
            logger.info(`PTZ initialized for camera ${camera.name}`);
            return true;
          }
        }
      }

      // Add more PTZ protocols here (ONVIF, HTTP, etc.)

      return false;
    } catch (error) {
      logger.error(`Failed to initialize PTZ for camera ${camera.name}:`, error);
      return false;
    }
  }

  /**
   * Execute PTZ command
   */
  async executeCommand(camera: Camera, command: PTZCommand): Promise<boolean> {
    try {
      const reolink = this.reolinkServices.get(camera.id);

      if (reolink) {
        return await this.executeReolinkCommand(reolink, command);
      }

      // Add more PTZ protocol handlers here

      logger.warn(`No PTZ handler for camera ${camera.name}`);
      return false;
    } catch (error) {
      logger.error(`PTZ command failed for camera ${camera.name}:`, error);
      return false;
    }
  }

  /**
   * Execute Reolink PTZ command
   */
  private async executeReolinkCommand(reolink: ReolinkService, command: PTZCommand): Promise<boolean> {
    const speed = command.speed || 32;

    switch (command.action) {
      case 'up':
        await reolink.ptzControl('Up', speed);
        break;
      case 'down':
        await reolink.ptzControl('Down', speed);
        break;
      case 'left':
        await reolink.ptzControl('Left', speed);
        break;
      case 'right':
        await reolink.ptzControl('Right', speed);
        break;
      case 'zoomIn':
        await reolink.ptzControl('ZoomIn', speed);
        break;
      case 'zoomOut':
        await reolink.ptzControl('ZoomOut', speed);
        break;
      case 'stop':
        await reolink.ptzControl('Stop');
        break;
      case 'preset':
        if (command.presetId !== undefined) {
          await reolink.goToPTZPreset(command.presetId);
        }
        break;
    }

    return true;
  }

  /**
   * Get PTZ presets
   */
  async getPresets(camera: Camera): Promise<PTZPreset[]> {
    try {
      const reolink = this.reolinkServices.get(camera.id);

      if (reolink) {
        // Reolink typically supports 16 presets
        const presets: PTZPreset[] = [];
        for (let i = 0; i < 16; i++) {
          presets.push({
            id: i,
            name: `Preset ${i + 1}`,
          });
        }
        return presets;
      }

      return [];
    } catch (error) {
      logger.error('Failed to get PTZ presets:', error);
      return [];
    }
  }

  /**
   * Set PTZ preset
   */
  async setPreset(camera: Camera, presetId: number, name?: string): Promise<boolean> {
    try {
      const reolink = this.reolinkServices.get(camera.id);

      if (reolink) {
        await reolink.setPTZPreset(presetId, name);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to set PTZ preset:', error);
      return false;
    }
  }

  /**
   * Get current PTZ position
   */
  async getPosition(camera: Camera): Promise<any> {
    try {
      const reolink = this.reolinkServices.get(camera.id);

      if (reolink) {
        return await reolink.getPTZPosition();
      }

      return null;
    } catch (error) {
      logger.error('Failed to get PTZ position:', error);
      return null;
    }
  }

  /**
   * Extract IP from stream URL
   */
  private extractIPFromUrl(url: string): string | null {
    try {
      const match = url.match(/(?:rtsp|rtmp|http):\/\/(?:[^:@]+:[^:@]+@)?([^:\/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup camera PTZ service
   */
  async cleanupCamera(cameraId: string): Promise<void> {
    const reolink = this.reolinkServices.get(cameraId);
    if (reolink) {
      await reolink.logout();
      this.reolinkServices.delete(cameraId);
    }
  }

  /**
   * Cleanup all PTZ services
   */
  async cleanupAll(): Promise<void> {
    for (const [cameraId, reolink] of this.reolinkServices.entries()) {
      await reolink.logout();
    }
    this.reolinkServices.clear();
  }
}

export default new PTZController();
