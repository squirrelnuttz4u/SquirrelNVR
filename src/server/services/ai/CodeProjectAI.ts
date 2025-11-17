import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import logger from '../../utils/logger';
import config from '../../config';
import { DetectionType } from '../../../shared/types';

export interface AIDetectionResult {
  label: string;
  confidence: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface LPRResult {
  plate: string;
  confidence: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export class CodeProjectAIService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.ai.codeprojectUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Check if CodeProject.AI server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/status');
      return response.status === 200;
    } catch (error) {
      logger.debug('CodeProject.AI server not available:', error);
      return false;
    }
  }

  /**
   * Detect objects in an image
   */
  async detectObjects(imagePath: string): Promise<AIDetectionResult[]> {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      const response = await this.client.post('/v1/vision/detection', formData, {
        headers: formData.getHeaders(),
      });

      if (response.data.success && response.data.predictions) {
        return response.data.predictions.map((pred: any) => ({
          label: pred.label,
          confidence: pred.confidence,
          x_min: pred.x_min,
          y_min: pred.y_min,
          x_max: pred.x_max,
          y_max: pred.y_max,
        }));
      }

      return [];
    } catch (error) {
      logger.error('CodeProject.AI object detection failed:', error);
      return [];
    }
  }

  /**
   * Detect faces in an image
   */
  async detectFaces(imagePath: string): Promise<AIDetectionResult[]> {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      const response = await this.client.post('/v1/vision/face', formData, {
        headers: formData.getHeaders(),
      });

      if (response.data.success && response.data.predictions) {
        return response.data.predictions.map((pred: any) => ({
          label: 'face',
          confidence: pred.confidence,
          x_min: pred.x_min,
          y_min: pred.y_min,
          x_max: pred.x_max,
          y_max: pred.y_max,
        }));
      }

      return [];
    } catch (error) {
      logger.error('CodeProject.AI face detection failed:', error);
      return [];
    }
  }

  /**
   * Recognize license plates in an image
   */
  async recognizeLicensePlate(imagePath: string): Promise<LPRResult[]> {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      const response = await this.client.post('/v1/image/alpr', formData, {
        headers: formData.getHeaders(),
      });

      if (response.data.success && response.data.predictions) {
        return response.data.predictions.map((pred: any) => ({
          plate: pred.plate,
          confidence: pred.confidence,
          x_min: pred.x_min || 0,
          y_min: pred.y_min || 0,
          x_max: pred.x_max || 0,
          y_max: pred.y_max || 0,
        }));
      }

      return [];
    } catch (error) {
      logger.error('CodeProject.AI license plate recognition failed:', error);
      return [];
    }
  }

  /**
   * Perform custom model inference
   */
  async customDetection(imagePath: string, modelName: string): Promise<AIDetectionResult[]> {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('model', modelName);

      const response = await this.client.post('/v1/vision/custom', formData, {
        headers: formData.getHeaders(),
      });

      if (response.data.success && response.data.predictions) {
        return response.data.predictions.map((pred: any) => ({
          label: pred.label,
          confidence: pred.confidence,
          x_min: pred.x_min,
          y_min: pred.y_min,
          x_max: pred.x_max,
          y_max: pred.y_max,
        }));
      }

      return [];
    } catch (error) {
      logger.error(`CodeProject.AI custom detection (${modelName}) failed:`, error);
      return [];
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/v1/models');
      if (response.data.success && response.data.models) {
        return response.data.models.map((m: any) => m.name);
      }
      return [];
    } catch (error) {
      logger.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Map detection label to detection type
   */
  mapLabelToType(label: string): DetectionType {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes('person') || lowerLabel.includes('human')) {
      return DetectionType.PERSON;
    } else if (lowerLabel.includes('car') || lowerLabel.includes('truck') ||
               lowerLabel.includes('vehicle') || lowerLabel.includes('bus')) {
      return DetectionType.VEHICLE;
    } else if (lowerLabel.includes('dog') || lowerLabel.includes('cat') ||
               lowerLabel.includes('animal')) {
      return DetectionType.ANIMAL;
    } else if (lowerLabel.includes('package') || lowerLabel.includes('box')) {
      return DetectionType.PACKAGE;
    } else if (lowerLabel.includes('face')) {
      return DetectionType.FACE;
    }

    return DetectionType.CUSTOM;
  }
}

export default new CodeProjectAIService();
