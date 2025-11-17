import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import modelRegistry from '../services/ai/ModelRegistry';
import logger from '../utils/logger';

const router = Router();

// Get all AI models
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const models = modelRegistry.getAllModels();
    res.json({ models });
  } catch (error) {
    logger.error('Error fetching AI models:', error);
    res.status(500).json({ error: 'Failed to fetch AI models' });
  }
});

// Get enabled AI models
router.get('/enabled', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const models = modelRegistry.getEnabledModels();
    res.json({ models });
  } catch (error) {
    logger.error('Error fetching enabled AI models:', error);
    res.status(500).json({ error: 'Failed to fetch enabled AI models' });
  }
});

// Get detection classes
router.get('/classes', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const classes = modelRegistry.getAllClasses();
    res.json({ classes });
  } catch (error) {
    logger.error('Error fetching detection classes:', error);
    res.status(500).json({ error: 'Failed to fetch detection classes' });
  }
});

// Get classes for a specific model
router.get('/:modelId/classes', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const classes = modelRegistry.getClassesForModel(req.params.modelId);
    res.json({ classes });
  } catch (error) {
    logger.error('Error fetching model classes:', error);
    res.status(500).json({ error: 'Failed to fetch model classes' });
  }
});

// Add custom AI model
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, endpoint, supportedClasses, config } = req.body;

    if (!name || !endpoint || !supportedClasses) {
      res.status(400).json({ error: 'Name, endpoint, and supported classes required' });
      return;
    }

    const model = modelRegistry.addCustomModel(
      name,
      description || '',
      endpoint,
      supportedClasses,
      config
    );

    res.status(201).json({ model });
  } catch (error) {
    logger.error('Error adding custom AI model:', error);
    res.status(500).json({ error: 'Failed to add custom AI model' });
  }
});

// Enable/disable model
router.patch('/:modelId/enabled', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;

    if (enabled === undefined) {
      res.status(400).json({ error: 'Enabled status required' });
      return;
    }

    const success = modelRegistry.setModelEnabled(req.params.modelId, enabled);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Model not found' });
    }
  } catch (error) {
    logger.error('Error updating model status:', error);
    res.status(500).json({ error: 'Failed to update model status' });
  }
});

// Test model availability
router.post('/:modelId/test', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const available = await modelRegistry.testModel(req.params.modelId);
    res.json({ available });
  } catch (error) {
    logger.error('Error testing AI model:', error);
    res.status(500).json({ error: 'Failed to test AI model' });
  }
});

// Delete custom model
router.delete('/:modelId', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const success = modelRegistry.removeModel(req.params.modelId);

    if (success) {
      res.json({ success: true, message: 'Model deleted' });
    } else {
      res.status(400).json({ error: 'Cannot delete built-in model or model not found' });
    }
  } catch (error) {
    logger.error('Error deleting AI model:', error);
    res.status(500).json({ error: 'Failed to delete AI model' });
  }
});

// Get model statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const stats = modelRegistry.getStatistics();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching model statistics:', error);
    res.status(500).json({ error: 'Failed to fetch model statistics' });
  }
});

export default router;
