import axios, { AxiosInstance } from 'axios';
import logger from '../../utils/logger';

/**
 * Reolink Camera API Service
 * Supports Reolink's proprietary HTTP API for advanced camera control
 */

export interface ReolinkDeviceInfo {
  name: string;
  model: string;
  hardwareVersion: string;
  firmwareVersion: string;
  serial: string;
}

export interface ReolinkStreamInfo {
  name: string;
  channel: number;
  enabled: boolean;
  mainStream: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
  subStream: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
  };
}

export interface ReolinkPTZPosition {
  pan: number;
  tilt: number;
  zoom: number;
}

export class ReolinkService {
  private client: AxiosInstance;
  private token?: string;
  private ip: string;
  private username: string;
  private password: string;

  constructor(ip: string, username: string = 'admin', password: string = '') {
    this.ip = ip;
    this.username = username;
    this.password = password;

    this.client = axios.create({
      baseURL: `http://${ip}/api.cgi`,
      timeout: 10000,
    });
  }

  /**
   * Login to Reolink camera and get token
   */
  async login(): Promise<boolean> {
    try {
      const response = await this.client.post('', [{
        cmd: 'Login',
        action: 0,
        param: {
          User: {
            userName: this.username,
            password: this.password,
          },
        },
      }]);

      if (response.data[0]?.code === 0) {
        this.token = response.data[0].value.Token.name;
        logger.info(`Logged in to Reolink camera at ${this.ip}`);
        return true;
      }

      logger.error('Reolink login failed:', response.data);
      return false;
    } catch (error) {
      logger.error('Reolink login error:', error);
      return false;
    }
  }

  /**
   * Execute Reolink API command
   */
  private async executeCommand(cmd: string, action: number = 0, param?: any): Promise<any> {
    if (!this.token) {
      const loggedIn = await this.login();
      if (!loggedIn) {
        throw new Error('Not authenticated with Reolink camera');
      }
    }

    try {
      const response = await this.client.post('', [{
        cmd,
        action,
        param: param || {},
        token: this.token,
      }]);

      if (response.data[0]?.code === 0) {
        return response.data[0].value;
      }

      throw new Error(`Command failed: ${response.data[0]?.error?.detail || 'Unknown error'}`);
    } catch (error) {
      logger.error(`Reolink command ${cmd} error:`, error);
      throw error;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<ReolinkDeviceInfo> {
    const result = await this.executeCommand('GetDevInfo');

    return {
      name: result.DevInfo.name,
      model: result.DevInfo.model,
      hardwareVersion: result.DevInfo.hardVer,
      firmwareVersion: result.DevInfo.firmVer,
      serial: result.DevInfo.serial,
    };
  }

  /**
   * Get stream information
   */
  async getStreamInfo(channel: number = 0): Promise<ReolinkStreamInfo> {
    const result = await this.executeCommand('GetEnc', 0, { channel });

    const enc = result.Enc;

    return {
      name: enc.name,
      channel,
      enabled: true,
      mainStream: {
        width: enc.mainStream.width,
        height: enc.mainStream.height,
        fps: enc.mainStream.frameRate,
        bitrate: enc.mainStream.bitRate,
      },
      subStream: {
        width: enc.subStream.width,
        height: enc.subStream.height,
        fps: enc.subStream.frameRate,
        bitrate: enc.subStream.bitRate,
      },
    };
  }

  /**
   * Get RTSP URLs for the camera
   */
  getRTSPUrls(channel: number = 0): { main: string; sub: string } {
    const base = `rtsp://${this.username}:${this.password}@${this.ip}:554`;

    // Determine stream paths based on camera model
    // Newer models use different paths
    return {
      main: `${base}/h264Preview_${String(channel + 1).padStart(2, '0')}_main`,
      sub: `${base}/h264Preview_${String(channel + 1).padStart(2, '0')}_sub`,
    };
  }

  /**
   * Get alternative RTSP URLs (for newer models)
   */
  getAlternativeRTSPUrls(channel: number = 0): { main: string; sub: string } {
    const base = `rtsp://${this.username}:${this.password}@${this.ip}:554`;

    return {
      main: `${base}/Preview_${String(channel + 1).padStart(2, '0')}_main`,
      sub: `${base}/Preview_${String(channel + 1).padStart(2, '0')}_sub`,
    };
  }

  /**
   * Capture snapshot
   */
  async captureSnapshot(channel: number = 0): Promise<Buffer> {
    try {
      const response = await axios.get(
        `http://${this.ip}/cgi-bin/api.cgi?cmd=Snap&channel=${channel}&rs=abc&user=${this.username}&password=${this.password}`,
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Reolink snapshot error:', error);
      throw error;
    }
  }

  /**
   * PTZ Control (for PTZ-enabled cameras)
   */
  async ptzControl(operation: 'Up' | 'Down' | 'Left' | 'Right' | 'ZoomIn' | 'ZoomOut' | 'Stop', speed: number = 32): Promise<void> {
    await this.executeCommand('PtzCtrl', 0, {
      channel: 0,
      op: operation,
      speed,
    });
  }

  /**
   * Get PTZ position
   */
  async getPTZPosition(): Promise<ReolinkPTZPosition> {
    const result = await this.executeCommand('GetPtzCurPos', 0, { channel: 0 });

    return {
      pan: result.pos.pan,
      tilt: result.pos.tilt,
      zoom: result.pos.zoom,
    };
  }

  /**
   * Set PTZ preset
   */
  async setPTZPreset(presetId: number, name?: string): Promise<void> {
    await this.executeCommand('SetPtzPreset', 0, {
      channel: 0,
      id: presetId,
      name: name || `Preset ${presetId}`,
    });
  }

  /**
   * Go to PTZ preset
   */
  async goToPTZPreset(presetId: number): Promise<void> {
    await this.executeCommand('PtzCtrl', 0, {
      channel: 0,
      op: 'ToPos',
      id: presetId,
    });
  }

  /**
   * Enable/disable motion detection
   */
  async setMotionDetection(enabled: boolean, channel: number = 0): Promise<void> {
    await this.executeCommand('SetMdAlarm', 0, {
      MdAlarm: {
        channel,
        enable: enabled ? 1 : 0,
      },
    });
  }

  /**
   * Get motion detection status
   */
  async getMotionDetection(channel: number = 0): Promise<boolean> {
    const result = await this.executeCommand('GetMdAlarm', 0, { channel });
    return result.MdAlarm.enable === 1;
  }

  /**
   * Enable/disable IR lights
   */
  async setIRLights(mode: 'Auto' | 'On' | 'Off', channel: number = 0): Promise<void> {
    await this.executeCommand('SetIrLights', 0, {
      IrLights: {
        channel,
        state: mode,
      },
    });
  }

  /**
   * Reboot camera
   */
  async reboot(): Promise<void> {
    await this.executeCommand('Reboot', 0);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.executeCommand('Logout', 0);
        this.token = undefined;
      } catch (error) {
        logger.error('Reolink logout error:', error);
      }
    }
  }

  /**
   * Test camera connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.login();
      await this.getDeviceInfo();
      return true;
    } catch (error) {
      logger.error('Reolink connection test failed:', error);
      return false;
    }
  }

  /**
   * Auto-detect best RTSP URL
   */
  async detectBestRTSPUrl(channel: number = 0): Promise<string> {
    const urls = [
      ...Object.values(this.getRTSPUrls(channel)),
      ...Object.values(this.getAlternativeRTSPUrls(channel)),
    ];

    // Try each URL to see which one works
    for (const url of urls) {
      try {
        // Simple test: try to connect with ffprobe
        const ffprobe = require('fluent-ffmpeg');
        await new Promise((resolve, reject) => {
          ffprobe.ffprobe(url, (err: any, metadata: any) => {
            if (err) reject(err);
            else resolve(metadata);
          });
        });

        logger.info(`Reolink: Found working RTSP URL: ${url}`);
        return url;
      } catch (error) {
        logger.debug(`Reolink: URL ${url} did not work, trying next...`);
      }
    }

    // If none work, return the default
    return this.getRTSPUrls(channel).main;
  }
}

export default ReolinkService;
