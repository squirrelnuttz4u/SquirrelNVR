// Shared types between server and client

export enum CameraStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

export enum StreamType {
  RTSP = 'rtsp',
  RTMP = 'rtmp',
  HLS = 'hls',
  MJPEG = 'mjpeg',
  ONVIF = 'onvif'
}

export enum RecordingMode {
  CONTINUOUS = 'continuous',
  MOTION = 'motion',
  SCHEDULED = 'scheduled',
  MOTION_AND_SCHEDULED = 'motion_and_scheduled'
}

export enum AIProvider {
  CODEPROJECT = 'codeproject',
  FRIGATE = 'frigate',
  BOTH = 'both'
}

export enum DetectionType {
  PERSON = 'person',
  VEHICLE = 'vehicle',
  ANIMAL = 'animal',
  PACKAGE = 'package',
  LICENSE_PLATE = 'license_plate',
  FACE = 'face',
  CUSTOM = 'custom'
}

export enum AlarmSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  PUSH = 'push'
}

export interface Camera {
  id: string;
  name: string;
  description?: string;
  streamUrl: string;
  streamType: StreamType;
  username?: string;
  password?: string;
  status: CameraStatus;
  enabled: boolean;

  // Recording settings
  recordingMode: RecordingMode;
  recordingQuality: 'low' | 'medium' | 'high' | 'ultra';
  recordingFps: number;
  preRecordSeconds: number;
  postRecordSeconds: number;

  // Motion detection
  motionEnabled: boolean;
  motionSensitivity: number; // 0-100
  motionZones?: MotionZone[];

  // AI detection
  aiEnabled: boolean;
  aiProvider: AIProvider;
  aiModels: string[];
  aiSensitivity: number;
  detectionZones?: DetectionZone[];

  // Schedule
  recordingSchedule?: Schedule[];

  // Storage
  retentionDays: number;
  maxStorageGB?: number;

  // Camera info
  manufacturer?: string;
  model?: string;
  firmware?: string;
  resolution?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface MotionZone {
  id: string;
  name: string;
  points: Point[];
  sensitivity: number;
}

export interface DetectionZone {
  id: string;
  name: string;
  points: Point[];
  detectionTypes: DetectionType[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Schedule {
  id: string;
  dayOfWeek: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string;
  enabled: boolean;
}

export interface Recording {
  id: string;
  cameraId: string;
  camera?: Camera;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  fileSize: number; // bytes
  filePath: string;
  thumbnailPath?: string;
  recordingType: 'continuous' | 'motion' | 'scheduled' | 'manual';
  hasAI: boolean;
  hasMotion: boolean;
  createdAt: Date;
}

export interface AIDetection {
  id: string;
  cameraId: string;
  camera?: Camera;
  recordingId?: string;
  recording?: Recording;
  timestamp: Date;
  detectionType: DetectionType;
  confidence: number;
  label: string;
  boundingBox?: BoundingBox;
  snapshotPath?: string;
  metadata?: Record<string, any>;
  provider: AIProvider;
  modelName: string;
  createdAt: Date;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LicensePlate {
  id: string;
  cameraId: string;
  camera?: Camera;
  detectionId: string;
  detection?: AIDetection;
  plateNumber: string;
  confidence: number;
  timestamp: Date;
  snapshotPath?: string;
  vehicleType?: string;
  vehicleColor?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Alarm {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  cameraIds: string[];

  // Trigger conditions
  triggerOnMotion: boolean;
  triggerOnAI: boolean;
  triggerDetectionTypes: DetectionType[];
  minimumConfidence: number;

  // Severity
  severity: AlarmSeverity;

  // Actions
  sendEmail: boolean;
  emailRecipients: string[];
  sendWebhook: boolean;
  webhookUrl?: string;
  recordVideo: boolean;
  takeSnapshot: boolean;

  // Schedule
  schedule?: Schedule[];

  createdAt: Date;
  updatedAt: Date;
}

export interface AlarmEvent {
  id: string;
  alarmId: string;
  alarm?: Alarm;
  cameraId: string;
  camera?: Camera;
  detectionId?: string;
  detection?: AIDetection;
  timestamp: Date;
  severity: AlarmSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  snapshotPath?: string;
  videoPath?: string;
  createdAt: Date;
}

export interface SystemSettings {
  id: string;

  // Storage
  storagePath: string;
  maxStorageGB: number;
  defaultRetentionDays: number;
  autoDeleteOldRecordings: boolean;

  // Performance
  maxConcurrentStreams: number;
  motionDetectionFps: number;
  aiDetectionFps: number;

  // GPU
  gpuType: 'nvidia' | 'intel' | 'amd' | 'none';
  hardwareAccel: string;

  // Email
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;

  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamStats {
  cameraId: string;
  fps: number;
  bitrate: number;
  resolution: string;
  codec: string;
  viewers: number;
  uptime: number;
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  storageUsed: number;
  storageTotal: number;
  activeCameras: number;
  totalCameras: number;
  recordingsCount: number;
  detectionsToday: number;
  uptime: number;
}
