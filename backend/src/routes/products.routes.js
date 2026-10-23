import { Router } from 'express';
import * as controller from '../controllers/products.controller.js';

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id/stock', controller.adjustStock);
router.delete('/:id', controller.remove);

export default router;
