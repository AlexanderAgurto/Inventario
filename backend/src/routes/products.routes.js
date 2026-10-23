import { Router } from 'express';
import * as controller from '../controllers/products.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', asyncHandler(controller.create));
router.patch('/:id/stock', asyncHandler(controller.adjustStock));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
