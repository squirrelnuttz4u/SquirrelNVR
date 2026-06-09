import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Known placeholder/example values that must never be trusted as real secrets
// (these ship in .env.example, so a large fraction of installs would otherwise
// run with a publicly known secret).
const INSECURE_DEFAULTS = new Set([
  'change-this-secret',
  'change-this-to-a-random-secret-key',
  'change-this-to-another-random-secret',
]);

/**
 * Resolve a cryptographic secret.
 *
 * Order of precedence:
 *   1. A real value provided via environment variable.
 *   2. A previously generated value persisted under data/ (so tokens/sessions
 *      survive restarts).
 *   3. A freshly generated random value, persisted for reuse.
 *
 * This guarantees installs are never silently protected by a public default
 * secret. A loud warning is emitted in production if a value is missing.
 */
function resolveSecret(envValue: string | undefined, fileName: string, label: string): string {
  if (envValue && !INSECURE_DEFAULTS.has(envValue)) {
    return envValue;
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `⚠ ${label} is not set (or uses the insecure default). ` +
      `Generating a persisted random secret. Set ${label} explicitly for multi-instance deployments.`
    );
  }

  try {
    const dataDir = path.join(__dirname, '../../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const secretPath = path.join(dataDir, fileName);
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing) {
        return existing;
      }
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch (error) {
    // If we cannot persist, fall back to an in-memory random secret. Tokens
    // will not survive a restart, but the install is still secure.
    console.warn(`⚠ Could not persist ${label}; using an ephemeral in-memory secret.`, error);
    return crypto.randomBytes(48).toString('hex');
  }
}

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
    jwtSecret: resolveSecret(process.env.JWT_SECRET, '.jwt-secret', 'JWT_SECRET'),
    sessionSecret: resolveSecret(process.env.SESSION_SECRET, '.session-secret', 'SESSION_SECRET'),
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
