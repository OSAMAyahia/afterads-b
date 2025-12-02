import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import {
  getAllComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  bulkDeleteComponents,
  updateDisplayOrder
} from '../Controller/themecrdcontrooler.js';

const router = express.Router();

// ✅ إعداد Multer هنا في الـ Routes
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'uploads/components';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'component-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 13,
    fieldSize: 10 * 1024 * 1024,
    fieldNameSize: 200
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('يُسمح فقط بالصور (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ✅ استخدام upload كـ middleware في الـ routes
const uploadFields = upload.fields([
  { name: 'backgroundImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 12 }
]);

router.get('/', getAllComponents);
router.get('/:id', getComponentById);
router.post('/', uploadFields, createComponent); // ✅ هنا
router.put('/:id', uploadFields, updateComponent); // ✅ هنا
router.delete('/:id', deleteComponent);
router.post('/bulk-delete', bulkDeleteComponents);
router.patch('/update-order', updateDisplayOrder);

export default router;