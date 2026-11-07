import { Router } from 'express';
import * as licorController from '../controllers/licorController.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.get('/', licorController.getLicores);
router.post('/', upload.single('image'), licorController.postLicor);

export default router;