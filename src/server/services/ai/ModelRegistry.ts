import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import codeProjectAI from './CodeProjectAI';
import { DetectionType } from '../../../shared/types';

export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: 'codeproject' | 'frigate' | 'custom';
  modelType: 'object_detection' | 'face_detection' | 'license_plate' | 'custom';
  endpoint?: string; // For custom models
  supportedClasses: string[];
  enabled: boolean;
  config?: Record<string, any>;
}

export interface DetectionClass {
  name: string;
  type: DetectionType;
  description?: string;
}

/**
 * AI Model Registry
 * Manages available AI models and their capabilities
 */
export class ModelRegistry extends EventEmitter {
  private models: Map<string, AIModel> = new Map();
  private detectionClasses: Map<string, DetectionClass> = new Map();

  constructor() {
    super();
    this.initializeDefaultModels();
    this.initializeDetectionClasses();
  }

  /**
   * Initialize default AI models
   */
  private initializeDefaultModels(): void {
    // CodeProject.AI Models
    this.registerModel({
      id: 'codeproject-yolo',
      name: 'YOLO Object Detection',
      description: 'YOLOv5/v8 object detection with 80 COCO classes',
      provider: 'codeproject',
      modelType: 'object_detection',
      endpoint: '/v1/vision/detection',
      supportedClasses: [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
        'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
        'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
        'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
        'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
        'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
        'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
        'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
        'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
        'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
      ],
      enabled: true,
    });

    this.registerModel({
      id: 'codeproject-face',
      name: 'Face Detection',
      description: 'Detect human faces in images',
      provider: 'codeproject',
      modelType: 'face_detection',
      endpoint: '/v1/vision/face',
      supportedClasses: ['face'],
      enabled: true,
    });

    this.registerModel({
      id: 'codeproject-alpr',
      name: 'License Plate Recognition',
      description: 'Automatic License Plate Recognition',
      provider: 'codeproject',
      modelType: 'license_plate',
      endpoint: '/v1/image/alpr',
      supportedClasses: ['license_plate'],
      enabled: true,
    });

    // Frigate Models
    this.registerModel({
      id: 'frigate-default',
      name: 'Frigate Default Model',
      description: 'Frigate optimized model for security cameras',
      provider: 'frigate',
      modelType: 'object_detection',
      supportedClasses: ['person', 'car', 'dog', 'cat', 'bird', 'bicycle', 'motorcycle', 'truck', 'bus'],
      enabled: true,
    });

    logger.info('✓ Default AI models registered');
  }

  /**
   * Initialize detection class mappings
   */
  private initializeDetectionClasses(): void {
    const classes: DetectionClass[] = [
      // People
      { name: 'person', type: DetectionType.PERSON, description: 'Human person' },
      { name: 'face', type: DetectionType.FACE, description: 'Human face' },

      // Vehicles
      { name: 'car', type: DetectionType.VEHICLE, description: 'Car or automobile' },
      { name: 'truck', type: DetectionType.VEHICLE, description: 'Truck or lorry' },
      { name: 'bus', type: DetectionType.VEHICLE, description: 'Bus' },
      { name: 'motorcycle', type: DetectionType.VEHICLE, description: 'Motorcycle' },
      { name: 'bicycle', type: DetectionType.VEHICLE, description: 'Bicycle' },
      { name: 'license_plate', type: DetectionType.LICENSE_PLATE, description: 'Vehicle license plate' },

      // Animals
      { name: 'dog', type: DetectionType.ANIMAL, description: 'Dog' },
      { name: 'cat', type: DetectionType.ANIMAL, description: 'Cat' },
      { name: 'bird', type: DetectionType.ANIMAL, description: 'Bird' },
      { name: 'horse', type: DetectionType.ANIMAL, description: 'Horse' },

      // Objects
      { name: 'backpack', type: DetectionType.PACKAGE, description: 'Backpack or bag' },
      { name: 'suitcase', type: DetectionType.PACKAGE, description: 'Suitcase or luggage' },
      { name: 'handbag', type: DetectionType.PACKAGE, description: 'Handbag or purse' },
    ];

    classes.forEach(cls => {
      this.detectionClasses.set(cls.name, cls);
    });
  }

  /**
   * Register a new AI model
   */
  registerModel(model: AIModel): void {
    this.models.set(model.id, model);
    logger.info(`AI model registered: ${model.name}`);
    this.emit('model:registered', model);
  }

  /**
   * Add custom AI model
   */
  addCustomModel(
    name: string,
    description: string,
    endpoint: string,
    supportedClasses: string[],
    config?: Record<string, any>
  ): AIModel {
    const model: AIModel = {
      id: `custom-${Date.now()}`,
      name,
      description,
      provider: 'custom',
      modelType: 'custom',
      endpoint,
      supportedClasses,
      enabled: true,
      config,
    };

    this.registerModel(model);
    return model;
  }

  /**
   * Get all registered models
   */
  getAllModels(): AIModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get enabled models
   */
  getEnabledModels(): AIModel[] {
    return Array.from(this.models.values()).filter(m => m.enabled);
  }

  /**
   * Get model by ID
   */
  getModel(id: string): AIModel | undefined {
    return this.models.get(id);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): AIModel[] {
    return Array.from(this.models.values()).filter(m => m.provider === provider);
  }

  /**
   * Get all detection classes
   */
  getAllClasses(): DetectionClass[] {
    return Array.from(this.detectionClasses.values());
  }

  /**
   * Get classes for a specific model
   */
  getClassesForModel(modelId: string): DetectionClass[] {
    const model = this.models.get(modelId);
    if (!model) return [];

    return model.supportedClasses
      .map(className => this.detectionClasses.get(className))
      .filter(cls => cls !== undefined) as DetectionClass[];
  }

  /**
   * Check if a class should be filtered
   */
  shouldFilterClass(className: string, allowedClasses: string[]): boolean {
    if (allowedClasses.length === 0) return false; // No filter = allow all
    return !allowedClasses.includes(className);
  }

  /**
   * Map class name to detection type
   */
  getDetectionType(className: string): DetectionType {
    const cls = this.detectionClasses.get(className);
    return cls?.type || DetectionType.CUSTOM;
  }

  /**
   * Enable/disable model
   */
  setModelEnabled(id: string, enabled: boolean): boolean {
    const model = this.models.get(id);
    if (!model) return false;

    model.enabled = enabled;
    this.emit('model:updated', model);
    return true;
  }

  /**
   * Remove custom model
   */
  removeModel(id: string): boolean {
    const model = this.models.get(id);
    if (!model || model.provider !== 'custom') {
      return false; // Can't remove built-in models
    }

    this.models.delete(id);
    this.emit('model:removed', id);
    return true;
  }

  /**
   * Test model availability
   */
  async testModel(id: string): Promise<boolean> {
    const model = this.models.get(id);
    if (!model) return false;

    try {
      if (model.provider === 'codeproject') {
        return await codeProjectAI.isAvailable();
      }
      // Add other provider tests here
      return true;
    } catch (error) {
      logger.error(`Model test failed for ${id}:`, error);
      return false;
    }
  }

  /**
   * Get model statistics
   */
  getStatistics(): any {
    const models = this.getAllModels();
    const enabledCount = models.filter(m => m.enabled).length;

    return {
      total: models.length,
      enabled: enabledCount,
      disabled: models.length - enabledCount,
      byProvider: {
        codeproject: models.filter(m => m.provider === 'codeproject').length,
        frigate: models.filter(m => m.provider === 'frigate').length,
        custom: models.filter(m => m.provider === 'custom').length,
      },
      totalClasses: this.detectionClasses.size,
    };
  }
}

export default new ModelRegistry();
