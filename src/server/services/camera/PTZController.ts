import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { Camera } from '../../database/entities';
import ReolinkService from './ReolinkService';
import OnvifService from './OnvifService';

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
  // Cameras controlled via the generic ONVIF protocol.
  private onvifCameras: Set<string> = new Set();

  /**
   * Initialize PTZ controller for a camera
   */
  async initializeCamera(camera: Camera): Promise<boolean> {
    try {
      // Check if camera supports PTZ (entity flag set by the operator).
      if (!camera.supportsPTZ) {
        logger.debug(`Camera ${camera.name} is not marked as PTZ-capable`);
        return false;
      }

      // Prefer the vendor-native protocol when we have one.
      if (camera.manufacturer?.toLowerCase() === 'reolink') {
        const ip = this.extractIPFromUrl(camera.streamUrl);
        if (ip) {
          const reolink = new ReolinkService(ip, camera.username, camera.password);
          const connected = await reolink.testConnection();

          if (connected) {
            this.reolinkServices.set(camera.id, reolink);
            logger.info(`PTZ (Reolink) initialized for camera ${camera.name}`);
            return true;
          }
        }
      }

      // Fall back to generic ONVIF PTZ, which most IP cameras support.
      try {
        await OnvifService.connect(camera);
        this.onvifCameras.add(camera.id);
        logger.info(`PTZ (ONVIF) initialized for camera ${camera.name}`);
        return true;
      } catch (error) {
        logger.warn(`ONVIF PTZ init failed for ${camera.name}: ${error instanceof Error ? error.message : error}`);
      }

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

      // Lazily initialize ONVIF if the camera is PTZ-capable but not yet set up.
      if (!this.onvifCameras.has(camera.id) && camera.supportsPTZ) {
        await this.initializeCamera(camera);
      }

      if (this.onvifCameras.has(camera.id)) {
        return await this.executeOnvifCommand(camera, command);
      }

      logger.warn(`No PTZ handler for camera ${camera.name}`);
      return false;
    } catch (error) {
      logger.error(`PTZ command failed for camera ${camera.name}:`, error);
      return false;
    }
  }

  /**
   * Execute an ONVIF PTZ command.
   */
  private async executeOnvifCommand(camera: Camera, command: PTZCommand): Promise<boolean> {
    // Normalize speed (0-100 from the UI) to ONVIF's -1..1 velocity range.
    const v = Math.min(1, Math.max(0.1, (command.speed || 50) / 100));

    switch (command.action) {
      case 'up':
        await OnvifService.continuousMove(camera, { y: v });
        break;
      case 'down':
        await OnvifService.continuousMove(camera, { y: -v });
        break;
      case 'left':
        await OnvifService.continuousMove(camera, { x: -v });
        break;
      case 'right':
        await OnvifService.continuousMove(camera, { x: v });
        break;
      case 'zoomIn':
        await OnvifService.continuousMove(camera, { zoom: v });
        break;
      case 'zoomOut':
        await OnvifService.continuousMove(camera, { zoom: -v });
        break;
      case 'stop':
        await OnvifService.stop(camera);
        break;
      case 'preset':
        if (command.presetId !== undefined) {
          await OnvifService.gotoPreset(camera, String(command.presetId));
        }
        break;
    }
    return true;
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

      if (this.onvifCameras.has(camera.id)) {
        const onvifPresets = await OnvifService.getPresets(camera);
        return onvifPresets.map((p, idx) => ({ id: Number(p.token) || idx, name: p.name }));
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

      if (this.onvifCameras.has(camera.id)) {
        await OnvifService.setPreset(camera, name || `Preset ${presetId}`);
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
    if (this.onvifCameras.has(cameraId)) {
      OnvifService.disconnect(cameraId);
      this.onvifCameras.delete(cameraId);
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
