import axios, { AxiosInstance } from 'axios';
import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import config from '../../config';
import { DetectionType } from '../../../shared/types';

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  score: number;
  box: [number, number, number, number]; // [x, y, width, height]
  area: number;
  ratio: number;
  region: [number, number, number, number];
  currentZones: string[];
  enteredZones: string[];
  thumbnail?: string;
  hasSnapshot: boolean;
  hasClip: boolean;
  startTime: number;
  endTime?: number;
}

export class FrigateService extends EventEmitter {
  private httpClient: AxiosInstance;
  private mqttClient?: mqtt.MqttClient;
  private baseUrl: string;
  private isConnected: boolean = false;

  constructor() {
    super();
    this.baseUrl = config.ai.frigateUrl;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Initialize Frigate connection
   */
  async initialize(): Promise<void> {
    try {
      // Check if Frigate is available
      const available = await this.isAvailable();
      if (!available) {
        logger.warn('Frigate server is not available');
        return;
      }

      // Connect to MQTT for real-time events
      await this.connectMQTT();

      this.isConnected = true;
      logger.info('✓ Frigate service initialized');
    } catch (error) {
      logger.error('Failed to initialize Frigate service:', error);
    }
  }

  /**
   * Connect to Frigate MQTT broker
   */
  private async connectMQTT(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const mqttUrl = `mqtt://${config.ai.frigateMqttHost}:${config.ai.frigateMqttPort}`;
        this.mqttClient = mqtt.connect(mqttUrl);

        this.mqttClient.on('connect', () => {
          logger.info('✓ Connected to Frigate MQTT broker');

          // Subscribe to all Frigate events
          this.mqttClient!.subscribe('frigate/events', (err) => {
            if (err) {
              logger.error('Failed to subscribe to Frigate events:', err);
            } else {
              logger.info('✓ Subscribed to Frigate events');
            }
          });

          // Subscribe to specific event types
          this.mqttClient!.subscribe('frigate/+/person/snapshot');
          this.mqttClient!.subscribe('frigate/+/car/snapshot');
          this.mqttClient!.subscribe('frigate/+/*/snapshot');

          resolve();
        });

        this.mqttClient.on('message', (topic, message) => {
          this.handleMQTTMessage(topic, message);
        });

        this.mqttClient.on('error', (error) => {
          logger.error('Frigate MQTT error:', error);
          reject(error);
        });

        this.mqttClient.on('close', () => {
          logger.warn('Frigate MQTT connection closed');
          this.isConnected = false;
        });
      } catch (error) {
        logger.error('Failed to connect to Frigate MQTT:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle MQTT messages from Frigate
   */
  private handleMQTTMessage(topic: string, message: Buffer): void {
    try {
      const parts = topic.split('/');

      // Handle event messages
      if (topic === 'frigate/events') {
        const event = JSON.parse(message.toString());
        this.emit('event', event);
        logger.debug(`Frigate event: ${event.type} - ${event.label} on ${event.camera}`);
      }

      // Handle snapshot messages
      if (topic.endsWith('/snapshot')) {
        const cameraName = parts[1];
        const label = parts[2];
        this.emit('snapshot', { camera: cameraName, label, image: message });
      }
    } catch (error) {
      logger.error('Error handling Frigate MQTT message:', error);
    }
  }

  /**
   * Check if Frigate server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/stats');
      return response.status === 200;
    } catch (error) {
      logger.debug('Frigate server not available:', error);
      return false;
    }
  }

  /**
   * Get Frigate configuration
   */
  async getConfig(): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/config');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Frigate config:', error);
      return null;
    }
  }

  /**
   * Get events from Frigate
   */
  async getEvents(params?: {
    camera?: string;
    label?: string;
    zone?: string;
    after?: number;
    before?: number;
    limit?: number;
  }): Promise<FrigateEvent[]> {
    try {
      const response = await this.httpClient.get('/api/events', { params });
      return response.data || [];
    } catch (error) {
      logger.error('Failed to get Frigate events:', error);
      return [];
    }
  }

  /**
   * Get event snapshot
   */
  async getEventSnapshot(eventId: string): Promise<Buffer | null> {
    try {
      const response = await this.httpClient.get(`/api/events/${eventId}/snapshot.jpg`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to get snapshot for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Get event clip
   */
  async getEventClip(eventId: string): Promise<Buffer | null> {
    try {
      const response = await this.httpClient.get(`/api/events/${eventId}/clip.mp4`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to get clip for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Get camera snapshot
   */
  async getCameraSnapshot(cameraName: string): Promise<Buffer | null> {
    try {
      const response = await this.httpClient.get(`/api/${cameraName}/latest.jpg`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to get snapshot for camera ${cameraName}:`, error);
      return null;
    }
  }

  /**
   * Get Frigate statistics
   */
  async getStats(): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/stats');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Frigate stats:', error);
      return null;
    }
  }

  /**
   * Map Frigate label to detection type
   */
  mapLabelToType(label: string): DetectionType {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel === 'person') {
      return DetectionType.PERSON;
    } else if (lowerLabel === 'car' || lowerLabel === 'truck' ||
               lowerLabel === 'bus' || lowerLabel === 'motorcycle') {
      return DetectionType.VEHICLE;
    } else if (lowerLabel === 'dog' || lowerLabel === 'cat' ||
               lowerLabel === 'bird' || lowerLabel === 'horse') {
      return DetectionType.ANIMAL;
    } else if (lowerLabel === 'package') {
      return DetectionType.PACKAGE;
    }

    return DetectionType.CUSTOM;
  }

  /**
   * Disconnect from Frigate
   */
  async disconnect(): Promise<void> {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.isConnected = false;
      logger.info('Disconnected from Frigate');
    }
  }

  /**
   * Check if connected
   */
  isConnectedToMQTT(): boolean {
    return this.isConnected && !!this.mqttClient?.connected;
  }
}

export default new FrigateService();
