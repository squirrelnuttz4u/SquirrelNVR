import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  CAMERA_VENDOR_PRESETS,
  buildStreamUrl,
  getAllVendors,
  getVendorsByName
} from '../../shared/types/cameraVendors';
import ReolinkService from '../services/camera/ReolinkService';
import logger from '../utils/logger';

const router = Router();

// Get all vendor presets
router.get('/presets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      vendors: getAllVendors(),
      presets: CAMERA_VENDOR_PRESETS,
    });
  } catch (error) {
    logger.error('Error fetching vendor presets:', error);
    res.status(500).json({ error: 'Failed to fetch vendor presets' });
  }
});

// Get presets for specific vendor
router.get('/presets/:vendor', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { vendor } = req.params;
    const presets = getVendorsByName(vendor);

    if (presets.length === 0) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    res.json({ vendor, presets });
  } catch (error) {
    logger.error('Error fetching vendor presets:', error);
    res.status(500).json({ error: 'Failed to fetch vendor presets' });
  }
});

// Build stream URL from preset
router.post('/build-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { vendor, model, ip, username, password, useSubStream } = req.body;

    if (!vendor || !ip) {
      res.status(400).json({ error: 'Vendor and IP address required' });
      return;
    }

    const presets = getVendorsByName(vendor);
    const preset = model
      ? presets.find(p => p.model === model)
      : presets[0];

    if (!preset) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    const streamUrl = buildStreamUrl(preset, ip, username, password, useSubStream);

    res.json({
      streamUrl,
      preset,
      onvifUrl: preset.supportsOnvif ? `http://${ip}:${preset.onvifPort}${preset.streamPath}` : null,
    });
  } catch (error) {
    logger.error('Error building stream URL:', error);
    res.status(500).json({ error: 'Failed to build stream URL' });
  }
});

// Reolink-specific endpoints

// Test Reolink connection
router.post('/reolink/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip, username, password } = req.body;

    if (!ip) {
      res.status(400).json({ error: 'IP address required' });
      return;
    }

    const reolink = new ReolinkService(ip, username || 'admin', password || '');
    const isConnected = await reolink.testConnection();

    if (isConnected) {
      const deviceInfo = await reolink.getDeviceInfo();
      const streamInfo = await reolink.getStreamInfo(0);
      const rtspUrls = reolink.getRTSPUrls(0);

      await reolink.logout();

      res.json({
        success: true,
        deviceInfo,
        streamInfo,
        rtspUrls,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to connect to Reolink camera'
      });
    }
  } catch (error) {
    logger.error('Reolink test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Reolink connection'
    });
  }
});

// Get Reolink device info
router.post('/reolink/info', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip, username, password } = req.body;

    const reolink = new ReolinkService(ip, username || 'admin', password || '');
    await reolink.login();

    const deviceInfo = await reolink.getDeviceInfo();
    const streamInfo = await reolink.getStreamInfo(0);

    await reolink.logout();

    res.json({
      deviceInfo,
      streamInfo,
    });
  } catch (error) {
    logger.error('Reolink info error:', error);
    res.status(500).json({ error: 'Failed to get Reolink info' });
  }
});

// Auto-detect Reolink RTSP URL
router.post('/reolink/detect-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip, username, password, channel } = req.body;

    const reolink = new ReolinkService(ip, username || 'admin', password || '');
    await reolink.login();

    const mainUrl = await reolink.detectBestRTSPUrl(channel || 0);
    const rtspUrls = reolink.getRTSPUrls(channel || 0);
    const altUrls = reolink.getAlternativeRTSPUrls(channel || 0);

    await reolink.logout();

    res.json({
      detected: mainUrl,
      allUrls: {
        standard: rtspUrls,
        alternative: altUrls,
      },
    });
  } catch (error) {
    logger.error('Reolink detect URL error:', error);
    res.status(500).json({ error: 'Failed to detect Reolink URL' });
  }
});

// Capture Reolink snapshot
router.post('/reolink/snapshot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip, username, password, channel } = req.body;

    const reolink = new ReolinkService(ip, username || 'admin', password || '');
    const snapshot = await reolink.captureSnapshot(channel || 0);

    res.set('Content-Type', 'image/jpeg');
    res.send(snapshot);
  } catch (error) {
    logger.error('Reolink snapshot error:', error);
    res.status(500).json({ error: 'Failed to capture snapshot' });
  }
});

export default router;
