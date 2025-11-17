import { DataSource } from 'typeorm';
import path from 'path';
import * as entities from './entities';

export const AppDataSource = new DataSource({
  type: process.env.DB_TYPE === 'postgres' ? 'postgres' : 'sqlite',
  database: process.env.DB_TYPE === 'postgres'
    ? process.env.DB_NAME || 'squirrel_nvr'
    : process.env.DB_PATH || path.join(__dirname, '../../../data/squirrel-nvr.db'),

  // PostgreSQL specific
  ...(process.env.DB_TYPE === 'postgres' && {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }),

  entities: Object.values(entities),
  synchronize: true, // Set to false in production, use migrations
  logging: process.env.NODE_ENV === 'development',
});

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✓ Database initialized successfully');

    // Create data directory if using SQLite
    if (process.env.DB_TYPE !== 'postgres') {
      const fs = require('fs');
      const dataDir = path.join(__dirname, '../../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    // Initialize default settings if none exist
    const settingsRepo = AppDataSource.getRepository(entities.SystemSettings);
    const settings = await settingsRepo.findOne({ where: {} });
    if (!settings) {
      const defaultSettings = settingsRepo.create({
        storagePath: process.env.STORAGE_PATH || './recordings',
        maxStorageGB: parseInt(process.env.MAX_STORAGE_GB || '500'),
        defaultRetentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
        autoDeleteOldRecordings: true,
        maxConcurrentStreams: 32,
        motionDetectionFps: 5,
        aiDetectionFps: 2,
        gpuType: (process.env.GPU_TYPE as any) || 'nvidia',
        hardwareAccel: process.env.HARDWARE_ACCEL || 'cuda',
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
        smtpFrom: process.env.SMTP_FROM || '',
      });
      await settingsRepo.save(defaultSettings);
      console.log('✓ Default system settings created');
    }

    // Create default admin user if none exist
    const userRepo = AppDataSource.getRepository(entities.User);
    const userCount = await userRepo.count();
    if (userCount === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin', 10);
      const adminUser = userRepo.create({
        username: 'admin',
        email: 'admin@squirrelnvr.local',
        password: hashedPassword,
        role: 'admin',
        enabled: true,
      });
      await userRepo.save(adminUser);
      console.log('✓ Default admin user created (username: admin, password: admin)');
      console.log('⚠ Please change the default password after first login!');
    }

  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}

export { entities };
