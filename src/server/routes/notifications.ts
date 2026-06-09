import { Router, Response } from 'express';
import { AppDataSource } from '../database';
import { PushSubscription } from '../database/entities';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import notificationService from '../services/notification/NotificationService';
import logger from '../utils/logger';

const router = Router();

// Public VAPID key for the browser to create a push subscription.
router.get('/vapid-public-key', authenticateToken, async (_req: AuthRequest, res: Response) => {
  const key = notificationService.getVapidPublicKey();
  if (!key) {
    res.status(503).json({ error: 'Push notifications are not configured' });
    return;
  }
  res.json({ publicKey: key });
});

// Register (or refresh) a Web Push subscription for the current user/device.
router.post('/subscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription payload' });
      return;
    }

    const repo = AppDataSource.getRepository(PushSubscription);
    const existing = await repo.findOne({ where: { endpoint } });

    if (existing) {
      existing.userId = req.user!.id;
      existing.p256dh = keys.p256dh;
      existing.auth = keys.auth;
      existing.userAgent = req.headers['user-agent'];
      await repo.save(existing);
    } else {
      await repo.save(repo.create({
        userId: req.user!.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'],
      }));
    }

    res.status(201).json({ message: 'Subscribed' });
  } catch (error) {
    logger.error('Error registering push subscription:', error);
    res.status(500).json({ error: 'Failed to register subscription' });
  }
});

// Remove a subscription (e.g. when the user opts out on a device).
router.post('/unsubscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      res.status(400).json({ error: 'endpoint required' });
      return;
    }
    await AppDataSource.getRepository(PushSubscription).delete({ endpoint });
    res.json({ message: 'Unsubscribed' });
  } catch (error) {
    logger.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Send a test push to all registered devices.
router.post('/test', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const sent = await notificationService.sendPush({
      title: 'SquirrelNVR',
      body: 'Test push notification — notifications are working!',
      data: { url: '/' },
    });
    res.json({ message: `Test push sent to ${sent} device(s)`, sent });
  } catch (error) {
    logger.error('Error sending test push:', error);
    res.status(500).json({ error: 'Failed to send test push' });
  }
});

export default router;
