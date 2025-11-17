import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import config from './config';
import logger from './utils/logger';
import { initializeDatabase, AppDataSource } from './database';

// Import services
import streamManager from './services/camera/StreamManager';
import recordingEngine from './services/recording/RecordingEngine';
import aiDetectionCoordinator from './services/ai/AIDetectionCoordinator';
import alarmCoordinator from './services/alarm/AlarmCoordinator';
import notificationService from './services/notification/NotificationService';
import storageManager from './services/storage';

// Import routes
import authRoutes from './routes/auth';
import cameraRoutes from './routes/cameras';
import cameraVendorRoutes from './routes/camera-vendors';
import ptzRoutes from './routes/ptz';
import aiModelsRoutes from './routes/ai-models';
import recordingRoutes from './routes/recordings';
import detectionRoutes from './routes/detections';
import alarmRoutes from './routes/alarms';
import systemRoutes from './routes/system';
import { Camera } from './database/entities';

class SquirrelNVRServer {
  private app: Express;
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow inline scripts for HLS
    }));
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files
    this.app.use('/storage', express.static(path.join(config.storage.path)));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/cameras', cameraRoutes);
    this.app.use('/api/camera-vendors', cameraVendorRoutes);
    this.app.use('/api/ptz', ptzRoutes);
    this.app.use('/api/ai-models', aiModelsRoutes);
    this.app.use('/api/recordings', recordingRoutes);
    this.app.use('/api/detections', detectionRoutes);
    this.app.use('/api/alarms', alarmRoutes);
    this.app.use('/api/system', systemRoutes);

    // Serve HLS streams
    this.app.get('/stream/hls/:cameraId/*', (req: Request, res: Response) => {
      const { cameraId } = req.params;
      const filePath = path.join(config.storage.path, 'hls', cameraId, req.params[0]);
      res.sendFile(filePath);
    });

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });

    // Serve React app in production
    if (config.nodeEnv === 'production') {
      const clientBuildPath = path.join(__dirname, '../../client/build');
      this.app.use(express.static(clientBuildPath));

      this.app.get('*', (req: Request, res: Response) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/stream')) {
          res.sendFile(path.join(clientBuildPath, 'index.html'));
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      });
    }
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected');

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    // Broadcast events to all connected clients
    const broadcast = (event: string, data: any) => {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ event, data }));
        }
      });
    };

    // Setup event listeners
    streamManager.on('stream:started', (cameraId) => {
      broadcast('stream:started', { cameraId });
    });

    streamManager.on('stream:stopped', (cameraId) => {
      broadcast('stream:stopped', { cameraId });
    });

    recordingEngine.on('recording:started', (cameraId, recordingId) => {
      broadcast('recording:started', { cameraId, recordingId });
    });

    recordingEngine.on('recording:completed', (cameraId, recordingId) => {
      broadcast('recording:completed', { cameraId, recordingId });
    });

    aiDetectionCoordinator.on('detection', (data) => {
      broadcast('detection', data);
    });

    alarmCoordinator.on('alarm:triggered', (data) => {
      broadcast('alarm:triggered', data);
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      this.shutdown();
    });
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing services...');

    // Initialize database
    await initializeDatabase();

    // Initialize services
    await storageManager.initialize();
    await notificationService.initialize();
    await aiDetectionCoordinator.initialize();
    await alarmCoordinator.initialize();

    // DISABLED: Auto-starting cameras on server startup
    // This was causing memory issues. Cameras can be started manually from the UI.
    /*
    // Start cameras that are enabled
    const cameraRepo = AppDataSource.getRepository(Camera);
    const cameras = await cameraRepo.find({ where: { enabled: true } });

    for (const camera of cameras) {
      try {
        // Start streaming
        await streamManager.startStream(camera);

        // Start recording if continuous mode
        if (camera.recordingMode === 'continuous') {
          await recordingEngine.startRecording(camera);
        }

        // Start AI detection
        if (camera.aiEnabled) {
          await aiDetectionCoordinator.startDetection(camera);
        }

        logger.info(`✓ Started camera: ${camera.name}`);
      } catch (error) {
        logger.error(`Failed to start camera ${camera.name}:`, error);
      }
    }
    */

    logger.info('✓ All services initialized');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting SquirrelNVR server...');

      // Initialize services
      await this.initializeServices();

      // Start HTTP server
      this.httpServer.listen(config.port, config.host, () => {
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('  ___                  _         _   ___   ______ ');
        logger.info(' / __| __ _ _  _ _ _(_)_ _ _ _ ___ | | |\\ | | | |  _ \\');
        logger.info(' \\__ \\/ _` | || | \'_| | \' \\ \'_/ -_)| | | \\| | | | |_) |');
        logger.info(' |___/\\__, |\\_,_|_| |_|_||_|_| \\___||_| |_| \\_|_| |  _ <');
        logger.info('         |_|                                      |_| \\_\\');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`✓ Server running at http://${config.host}:${config.port}`);
        logger.info(`✓ Environment: ${config.nodeEnv}`);
        logger.info(`✓ Storage: ${config.storage.path}`);
        logger.info('═══════════════════════════════════════════════════════');
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down SquirrelNVR server...');

    try {
      // Stop all streams and recordings
      await streamManager.stopAll();
      await recordingEngine.stopAll();
      aiDetectionCoordinator.stopAll();

      // Close WebSocket connections
      this.wss.clients.forEach((client) => {
        client.close();
      });

      // Close HTTP server
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connection
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
        logger.info('Database connection closed');
      }

      logger.info('✓ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new SquirrelNVRServer();
server.start();

export default server;
