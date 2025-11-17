import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',

  // Database
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    path: process.env.DB_PATH || './data/squirrel-nvr.db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'squirrel_nvr',
  },

  // Storage
  storage: {
    path: process.env.STORAGE_PATH || './recordings',
    maxStorageGB: parseInt(process.env.MAX_STORAGE_GB || '500'),
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
  },

  // Streaming
  streaming: {
    rtmpPort: parseInt(process.env.RTMP_PORT || '1935'),
    rtspPort: parseInt(process.env.RTSP_PORT || '8554'),
    httpStreamPort: parseInt(process.env.HTTP_STREAM_PORT || '8000'),
  },

  // AI Services
  ai: {
    codeprojectUrl: process.env.CODEPROJECT_AI_URL || 'http://localhost:32168',
    frigateUrl: process.env.FRIGATE_URL || 'http://localhost:5000',
    frigateMqttHost: process.env.FRIGATE_MQTT_HOST || 'localhost',
    frigateMqttPort: parseInt(process.env.FRIGATE_MQTT_PORT || '1883'),
  },

  // Email
  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    smtpFrom: process.env.SMTP_FROM || '',
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret',
  },

  // GPU
  gpu: {
    type: process.env.GPU_TYPE || 'nvidia',
    hardwareAccel: process.env.HARDWARE_ACCEL || 'cuda',
  },

  // Features
  features: {
    enableMotionDetection: process.env.ENABLE_MOTION_DETECTION !== 'false',
    enableAIDetection: process.env.ENABLE_AI_DETECTION !== 'false',
    enableLPR: process.env.ENABLE_LPR !== 'false',
    enableAudio: process.env.ENABLE_AUDIO !== 'false',
  },

  // Performance
  performance: {
    maxConcurrentStreams: parseInt(process.env.MAX_CONCURRENT_STREAMS || '32'),
    motionDetectionFps: parseInt(process.env.MOTION_DETECTION_FPS || '5'),
    aiDetectionFps: parseInt(process.env.AI_DETECTION_FPS || '2'),
    recordingQuality: process.env.RECORDING_QUALITY || 'high',
  },
};

export default config;
