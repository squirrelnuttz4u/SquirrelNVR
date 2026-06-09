import logger from '../../utils/logger';
import { Camera } from '../../database/entities';

// The `onvif` package ships no type declarations; load it untyped.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const onvif = require('onvif');

export interface DiscoveredDevice {
  hostname: string;
  port: number;
  xaddrs?: string;
  urn?: string;
  name?: string;
  hardware?: string;
}

export interface OnvifPreset {
  token: string;
  name: string;
}

/**
 * Thin promise-based wrapper around the `onvif` library for camera discovery,
 * stream-URI resolution and PTZ control. Connections are cached per camera.
 */
export class OnvifService {
  private static cams: Map<string, any> = new Map();

  /**
   * WS-Discovery probe for ONVIF cameras on the local network.
   */
  static discover(timeoutMs: number = 5000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const devices: DiscoveredDevice[] = [];
      let settled = false;

      const done = () => {
        if (settled) return;
        settled = true;
        resolve(devices);
      };

      try {
        const onDevice = (cam: any) => {
          try {
            const info = cam?.deviceInformation || {};
            devices.push({
              hostname: cam?.hostname || cam?.options?.hostname,
              port: cam?.port || cam?.options?.port || 80,
              xaddrs: Array.isArray(cam?.xaddrs) ? cam.xaddrs.join(',') : cam?.xaddrs,
              urn: cam?.urn,
              name: info.name,
              hardware: info.hardware,
            });
          } catch {
            /* ignore malformed device */
          }
        };

        onvif.Discovery.on('device', onDevice);
        onvif.Discovery.probe({ timeout: timeoutMs }, (err: any, cams: any[]) => {
          onvif.Discovery.removeListener('device', onDevice);
          if (err) {
            logger.warn('ONVIF discovery error:', err.message || err);
          } else if (Array.isArray(cams)) {
            for (const cam of cams) {
              onDevice(cam);
            }
          }
          // De-duplicate by hostname:port.
          const seen = new Set<string>();
          const unique = devices.filter((d) => {
            const key = `${d.hostname}:${d.port}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          devices.length = 0;
          devices.push(...unique);
          done();
        });
      } catch (error) {
        logger.warn('ONVIF discovery unavailable:', error);
        done();
      }

      // Safety net in case the library never invokes the callback.
      setTimeout(done, timeoutMs + 2000);
    });
  }

  private static extractHost(camera: Camera): { hostname: string; port: number } | null {
    try {
      const match = camera.streamUrl.match(/^[a-z]+:\/\/(?:[^@/]+@)?([^:/]+)(?::(\d+))?/i);
      if (!match) return null;
      return { hostname: match[1], port: match[2] ? parseInt(match[2], 10) : 80 };
    } catch {
      return null;
    }
  }

  static connect(camera: Camera): Promise<any> {
    const cached = this.cams.get(camera.id);
    if (cached) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
      const host = this.extractHost(camera);
      if (!host) {
        reject(new Error('Could not derive camera host from stream URL'));
        return;
      }

      const cam = new onvif.Cam(
        {
          hostname: host.hostname,
          username: camera.username,
          password: camera.password,
          port: host.port,
          timeout: 8000,
        },
        (err: any) => {
          if (err) {
            reject(err);
            return;
          }
          this.cams.set(camera.id, cam);
          resolve(cam);
        }
      );
    });
  }

  static async getStreamUri(camera: Camera): Promise<string> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.getStreamUri({ protocol: 'RTSP' }, (err: any, stream: any) => {
        if (err) reject(err);
        else resolve(stream?.uri);
      });
    });
  }

  static async continuousMove(
    camera: Camera,
    velocity: { x?: number; y?: number; zoom?: number }
  ): Promise<void> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.continuousMove(
        { x: velocity.x || 0, y: velocity.y || 0, zoom: velocity.zoom || 0 },
        (err: any) => (err ? reject(err) : resolve())
      );
    });
  }

  static async stop(camera: Camera): Promise<void> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.stop({ panTilt: true, zoom: true }, (err: any) => (err ? reject(err) : resolve()));
    });
  }

  static async gotoPreset(camera: Camera, presetToken: string): Promise<void> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.gotoPreset({ preset: presetToken }, (err: any) => (err ? reject(err) : resolve()));
    });
  }

  static async getPresets(camera: Camera): Promise<OnvifPreset[]> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.getPresets((err: any, presets: any) => {
        if (err) {
          reject(err);
          return;
        }
        // The library returns a token->name map.
        const list: OnvifPreset[] = Object.keys(presets || {}).map((name) => ({
          name,
          token: String((presets as any)[name]),
        }));
        resolve(list);
      });
    });
  }

  static async setPreset(camera: Camera, name: string): Promise<string> {
    const cam = await this.connect(camera);
    return new Promise((resolve, reject) => {
      cam.setPreset({ presetName: name }, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(String(result?.presetToken ?? ''));
      });
    });
  }

  static disconnect(cameraId: string): void {
    this.cams.delete(cameraId);
  }
}

export default OnvifService;
