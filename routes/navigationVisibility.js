import express from 'express';
import { getSettings, updateSettings, upsertEntry } from '../Controller/navigationVisibilityController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('', getSettings);
router.get('/entry', getSettings);
router.put('', authenticateToken, requireAdmin, updateSettings);
router.patch('/entry', authenticateToken, requireAdmin, upsertEntry);

export default router;
