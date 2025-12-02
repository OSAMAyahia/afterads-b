import Component from '../models/ThemeCard.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ إعداد Multer لدعم رفع صور متعددة
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
    fileSize: 5 * 1024 * 1024, // 5MB لكل صورة
    files: 13 // backgroundImage + 12 galleryImages
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
}).fields([
  { name: 'backgroundImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 12 }
]);

// ✅ GET All Components
export const getAllComponents = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 50, sortBy = 'displayOrder' } = req.query;
    
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const components = await Component.find(query)
      .sort({ [sortBy]: 1, orderNumber: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const count = await Component.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: components,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب العناصر',
      error: error.message
    });
  }
};

// ✅ GET Single Component
export const getComponentById = async (req, res) => {
  try {
    const component = await Component.findById(req.params.id);
    
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }
    
    res.status(200).json({
      success: true,
      data: component
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب العنصر',
      error: error.message
    });
  }
};

export const createComponent = async (req, res) => {
  try {
    console.log('📦 Body:', req.body);
    console.log('📁 Files:', req.files);

    // ✅ معالجة features و galleryImages
    let features = req.body.features || [];
    let galleryImages = req.body.galleryImages || [];
    
    if (typeof features === 'string') {
      try {
        features = JSON.parse(features);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'صيغة features غير صحيحة'
        });
      }
    }
    
    if (typeof galleryImages === 'string') {
      try {
        galleryImages = JSON.parse(galleryImages);
      } catch (e) {
        galleryImages = [];
      }
    }
    
    const requestedOrder = req.body.orderNumber;
    let safeOrderNumber;
    if (requestedOrder !== undefined && requestedOrder !== null) {
      const exists = await Component.exists({ orderNumber: requestedOrder });
      if (exists) {
        const maxDoc = await Component.findOne().sort({ orderNumber: -1 }).select('orderNumber');
        safeOrderNumber = ((maxDoc && maxDoc.orderNumber) ? maxDoc.orderNumber : 0) + 1;
      } else {
        safeOrderNumber = parseInt(requestedOrder);
      }
    } else {
      const maxDoc = await Component.findOne().sort({ orderNumber: -1 }).select('orderNumber');
      safeOrderNumber = ((maxDoc && maxDoc.orderNumber) ? maxDoc.orderNumber : 0) + 1;
    }
    if (!Number.isFinite(safeOrderNumber) || safeOrderNumber < 1) {
      safeOrderNumber = 1;
    }

    const componentData = {
      title: req.body.title,
      description: req.body.description,
      overlayText: req.body.overlayText || '',
      orderNumber: safeOrderNumber,
      features: features,
      category: req.body.category || 'عنصر متقدم',
      isActive: req.body.isActive !== 'false' && req.body.isActive !== false,
      displayOrder: req.body.displayOrder || 0,
      icon: req.body.icon || 'FaUser',
      galleryImages: Array.isArray(galleryImages) ? galleryImages : []
    };
    
    // ✅ إضافة الصورة الرئيسية
    if (req.files?.backgroundImage?.[0]) {
      componentData.backgroundImage = `/uploads/components/${req.files.backgroundImage[0].filename}`;
    }
    
    // ✅ إضافة صور المعرض
    if (req.files?.galleryImages?.length) {
      const uploadedGallery = req.files.galleryImages.map(file => 
        `/uploads/components/${file.filename}`
      );
      componentData.galleryImages = [...componentData.galleryImages, ...uploadedGallery];
    }
    
    const component = await Component.create(componentData);
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء العنصر بنجاح',
      data: component
    });
  } catch (error) {
    console.error('❌ Error:', error);
    
    // ✅ حذف الصور في حالة الخطأ
    if (req.files) {
      const allFiles = [
        ...(req.files.backgroundImage || []),
        ...(req.files.galleryImages || [])
      ];
      for (const file of allFiles) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    
    res.status(400).json({
      success: false,
      message: 'خطأ في إنشاء العنصر',
      error: error.message
    });
  }
};

export const updateComponent = async (req, res) => {
  try {
    const component = await Component.findById(req.params.id);
    
    if (!component) {
      if (req.files) {
        const allFiles = [
          ...(req.files.backgroundImage || []),
          ...(req.files.galleryImages || [])
        ];
        for (const file of allFiles) {
          await fs.unlink(file.path).catch(() => {});
        }
      }
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }
    
    const updateData = {
      title: req.body.title || component.title,
      description: req.body.description || component.description,
      overlayText: req.body.overlayText !== undefined ? req.body.overlayText : component.overlayText,
      orderNumber: req.body.orderNumber || component.orderNumber,
      category: req.body.category || component.category,
      displayOrder: req.body.displayOrder !== undefined ? req.body.displayOrder : component.displayOrder,
      isActive: req.body.isActive !== undefined ? (req.body.isActive === 'true' || req.body.isActive === true) : component.isActive,
      icon: req.body.icon || component.icon
    };
    
    // ✅ معالجة features
    if (req.body.features !== undefined) {
      let features = req.body.features;
      if (typeof features === 'string') {
        try {
          features = JSON.parse(features);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'صيغة features غير صحيحة'
          });
        }
      }
      updateData.features = features;
    }
    
    // ✅ معالجة galleryImages
    let galleryImages = component.galleryImages || [];
    
    if (req.body.galleryImages !== undefined) {
      let newGallery = req.body.galleryImages;
      if (typeof newGallery === 'string') {
        try {
          newGallery = JSON.parse(newGallery);
        } catch (e) {
          newGallery = [];
        }
      }
      galleryImages = Array.isArray(newGallery) ? newGallery : [];
    }
    
    if (req.files?.galleryImages?.length) {
      const uploadedGallery = req.files.galleryImages.map(file => 
        `/uploads/components/${file.filename}`
      );
      galleryImages = [...galleryImages, ...uploadedGallery];
    }
    
    if (galleryImages.length > 12) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إضافة أكثر من 12 صورة'
      });
    }
    
    updateData.galleryImages = galleryImages;
    
    // ✅ تحديث الصورة الرئيسية
    if (req.files?.backgroundImage?.[0]) {
      if (component.backgroundImage) {
        const oldImagePath = path.join(__dirname, '..', component.backgroundImage);
        await fs.unlink(oldImagePath).catch(() => {});
      }
      updateData.backgroundImage = `/uploads/components/${req.files.backgroundImage[0].filename}`;
    }
    
    const updatedComponent = await Component.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'تم تحديث العنصر بنجاح',
      data: updatedComponent
    });
  } catch (error) {
    console.error('❌ Update Error:', error);
    
    if (req.files) {
      const allFiles = [
        ...(req.files.backgroundImage || []),
        ...(req.files.galleryImages || [])
      ];
      for (const file of allFiles) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    
    res.status(400).json({
      success: false,
      message: 'خطأ في تحديث العنصر',
      error: error.message
    });
  }
};

// ✅ DELETE Component (مع حذف كل الصور)
export const deleteComponent = async (req, res) => {
  try {
    const component = await Component.findById(req.params.id);
    
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'العنصر غير موجود'
      });
    }
    
    // ✅ حذف الصورة الرئيسية
    if (component.backgroundImage) {
      const imagePath = path.join(__dirname, '..', component.backgroundImage);
      await fs.unlink(imagePath).catch(() => {});
    }
    
    // ✅ حذف صور المعرض
    if (component.galleryImages?.length) {
      for (const imgUrl of component.galleryImages) {
        const imgPath = path.join(__dirname, '..', imgUrl);
        await fs.unlink(imgPath).catch(() => {});
      }
    }
    
    await Component.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'تم حذف العنصر بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف العنصر',
      error: error.message
    });
  }
};

// ✅ BULK DELETE (مع حذف كل الصور)
export const bulkDeleteComponents = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد معرفات العناصر للحذف'
      });
    }
    
    const components = await Component.find({ _id: { $in: ids } });
    
    // ✅ حذف كل الصور (الرئيسية + المعرض)
    for (const component of components) {
      if (component.backgroundImage) {
        const imagePath = path.join(__dirname, '..', component.backgroundImage);
        await fs.unlink(imagePath).catch(() => {});
      }
      
      if (component.galleryImages?.length) {
        for (const imgUrl of component.galleryImages) {
          const imgPath = path.join(__dirname, '..', imgUrl);
          await fs.unlink(imgPath).catch(() => {});
        }
      }
    }
    
    const result = await Component.deleteMany({ _id: { $in: ids } });
    
    res.status(200).json({
      success: true,
      message: `تم حذف ${result.deletedCount} عنصر بنجاح`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الحذف المتعدد',
      error: error.message
    });
  }
};

// ✅ UPDATE Display Order
export const updateDisplayOrder = async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الترتيب غير صحيحة'
      });
    }
    
    const bulkOps = updates.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { displayOrder: item.displayOrder }
      }
    }));
    
    await Component.bulkWrite(bulkOps);
    
    res.status(200).json({
      success: true,
      message: 'تم تحديث الترتيب بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الترتيب',
      error: error.message
    });
  }
};

export default {
  getAllComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  bulkDeleteComponents,
  updateDisplayOrder
};