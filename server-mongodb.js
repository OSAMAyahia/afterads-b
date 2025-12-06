import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { config, getMongoUri } from './config.js';

// Import Models
import Product from './models/Product.js';
import Category from './models/Category.js';
import Coupon from './models/Coupon.js';
import Customer from './models/Customer.js';
import User from './models/User.js';
import Cart from './models/Cart.js';
import Wishlist from './models/Wishlist.js';
import Order from './models/Order.js';
import Review from './models/Review.js';
import BlogPost from './models/BlogPost.js';
import Testimonial from './models/Testimonial.js';
import Client from './models/Client.js';
import Comment from './models/Comment.js';
import ActivityLog from './models/ActivityLog.js';
import LoginLog from './models/LoginLog.js';
import AdminPin from './models/AdminPin.js';

// Import Email Service
import { sendOTPEmail, sendWelcomeEmail } from './services/emailService.js';

// Import Authentication Middleware
import { authenticateToken, requireRole } from './middleware/auth.js';

// Helper function to log order activities
async function logOrderActivity(userId, userName, userRole, action, orderId, orderNumber, details, previousValue = null, newValue = null, notes = '', req = null) {
  try {
    console.log('🔍 logOrderActivity called with:', {
      userId, userName, userRole, action, orderId, orderNumber, details
    });
    
    // تحسين عرض التفاصيل لإظهار رقم الطلب بدلاً من اسم العميل
    let enhancedDetails = `طلب رقم ${orderNumber}: ${details}`;
    
    // التحقق من عدم وجود سجل مطابق لمنع التكرار
    const existingLog = await ActivityLog.findOne({
      orderNumber,
      action,
      details: enhancedDetails,
      createdAt: { $gte: new Date(Date.now() - 5000) } // خلال آخر 5 ثوانٍ
    });
    
    if (existingLog) {
      console.log('⚠️ Duplicate activity log detected, skipping...');
      return;
    }

    const activityLog = new ActivityLog({
      userId: userId === 'system' ? null : userId,
      userName,
      userRole,
      action,
      orderId,
      orderNumber,
      details: enhancedDetails,
      previousValue: previousValue ? (typeof previousValue === 'object' ? JSON.stringify(previousValue) : previousValue) : null,
      newValue: newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : newValue) : null,
      notes,
      ipAddress: req ? (req.ip || req.connection.remoteAddress || 'unknown') : 'system',
      userAgent: req ? (req.get('User-Agent') || 'unknown') : 'system'
    });
    
    console.log('💾 Saving activity log:', activityLog.toObject());
    await activityLog.save();
    console.log('✅ Activity log saved successfully');
  } catch (error) {
    console.error('❌ Error logging order activity:', error);
  }
}

// Import Routes
import invoiceRoutes from './routes/invoices.js';
import staticPagesRoutes from './routes/staticPages.js';
import blogPostsRoutes from './routes/blogPosts.js';
import testimonialsRoutes from './routes/testimonials.js';
import clientsRoutes from './routes/clients.js';
import customersRoutes from './routes/customers.js';
import usersRoutes from './routes/users.js';
import commentsRoutes from './routes/comments.js';
import logsRoutes from './routes/logs.js';
import authRoutes from './routes/auth.js';
import adminPinRoutes from './routes/adminPin.js';
import portfolioCategoriesRoutes from './routes/portfolioCategories.js';
import portfoliosRoutes from './routes/portfolios.js';
import themecard from './routes/themecard.js';
import visits from './routes/visits.js';
import themeWorks from './routes/themeWorks.js';
import documentationsRoutes from './routes/documentations.js';
import announcement from './routes/announcementBar.js';
import navigationVisibilityRoutes from './routes/navigationVisibility.js';


import subcategoriesRoutes from './routes/subcategories.js';
import productsRoutes from './routes/products.js';


// محاكاة __dirname في ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration for AfterAds deployment
const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// إعدادات Multer لرفع الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/images/');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// إعداد أساسي يتعامل مع أي نوع من الحقول
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('فقط ملفات الصور مسموحة!'), false);
    }
  }
});

// Middleware للتعامل مع جميع أنواع الملفات
const uploadFiles = upload.any();

// معالج أخطاء Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'حجم الملف كبير جداً (الحد الأقصى 5MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'عدد الملفات كبير جداً' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'نوع ملف غير متوقع' });
    }
    return res.status(400).json({ message: 'خطأ في رفع الملف: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(handleMulterError);

// Root health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    message: 'Mawasiem Backend API',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    authentication: 'Available at /api/auth/login and /api/auth/register'
  });
});

// Health check endpoint  
app.get('/api/health', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      database: 'MongoDB',
      timestamp: new Date().toISOString(),
      authentication: 'Available'
    };
    res.json(healthData);
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Note: Product model is now imported from models/Product.js with multilingual support
// Category model will be imported from models/Category.js when needed

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(getMongoUri(), config.mongodb.options);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// ======================
// CATEGORIES APIs (Both with and without /api/ prefix for compatibility)
// ======================

// Categories endpoints without /api/ prefix (for current production compatibility)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    console.error('Error in GET /categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// Categories endpoints with /api/ prefix (for frontend)
app.get('/api/categories', async (req, res) => {
  try {
    // جلب التصنيفات الرئيسية فقط (parentId: null) وليس التصنيفات الفرعية
    const categories = await Category.find({ 
      isActive: true, 
      parentId: null 
    }).sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

app.get('/api/categories/debug/all', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    console.error('Error in GET /api/categories/debug/all:', error);
    res.status(500).json({ message: 'Failed to fetch all categories' });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let category;
    
    // ✅ لو ObjectId صحيح
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findOne({ _id: id, isActive: true });
    } else {
      // ✅ لو رقم عادي
      category = await Category.findOne({ id: parseInt(id) || id, isActive: true });
    }
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Error in GET /api/categories/:id:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

app.post('/api/categories', uploadFiles, async (req, res) => {
  try {
    console.log('Creating category with data:', req.body);
    console.log('Files received:', req.files);
    
    const { 
      name, 
      description, 
      name_ar, 
      name_en, 
      description_ar, 
      description_en 
    } = req.body;
    const imageFile = req.files?.find(f => f.fieldname === 'mainImage');
    
    const category = new Category({
      name,
      description: description || '',
      name_ar: name_ar || '',
      name_en: name_en || '',
      description_ar: description_ar || '',
      description_en: description_en || '',
      image: imageFile ? `/images/${imageFile.filename}` : ''
    });

    await category.save();
    console.log('Category created successfully:', category);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

app.put('/api/categories/:id', uploadFiles, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      name_ar, 
      name_en, 
      description_ar, 
      description_en,
      isActive 
    } = req.body;
    const imageFile = req.files?.find(f => f.fieldname === 'mainImage');

    const updateData = {
      name,
      description: description || '',
      name_ar: name_ar || '',
      name_en: name_en || '',
      description_ar: description_ar || '',
      description_en: description_en || ''
    };

    // Only update isActive if it's provided
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (imageFile) {
      updateData.image = `/images/${imageFile.filename}`;
    }

    const category = await Category.findOneAndUpdate(
      { _id:  req.params.id },
      updateData,
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error in PUT /api/categories/:id:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // تحقق من صحة الـ ID
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'معرف الفئة غير صالح' });
    }

    // أولاً: احصل على الفئة لمعرفة الـ id الرقمي
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'الفئة غير موجودة' });
    }

    // استخدم الـ id الرقمي للبحث في المنتجات
    const productCount = await Product.countDocuments({ 
      categoryId: category.id, // استخدم category.id (الرقم) وليس _id (ObjectId)
      isActive: true 
    });
    
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `لا يمكن حذف الفئة. تحتوي على ${productCount} منتج نشط.` 
      });
    }

    // قم بتعطيل الفئة
    const updatedCategory = await Category.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(categoryId) },
      { isActive: false },
      { new: true }
    );

    res.json({ message: 'تم حذف الفئة بنجاح' });
  } catch (error) {
    console.error('Error in DELETE /api/categories/:id:', error);
    res.status(500).json({ 
      message: 'فشل في حذف الفئة',
      error: error.message 
    });
  }
});


// ======================
// ORDERS APIs (حقيقية مش وهمية!)
// ======================
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({
     }).sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ 
      id: parseInt(req.params.id),
      customerAddress: { $type: "string" } // فقط الطلبات الجديدة اللي العنوان فيها string
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error in GET /api/orders/:id:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// جلب طلبات المستخدم حسب الإيميل
app.get('/api/orders/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.find({ 
      customerEmail: email,
      customerAddress: { $type: "string" } // فقط الطلبات الجديدة اللي العنوان فيها string
    }).sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error in GET /api/orders/user/:email:', error);
    res.status(500).json({ message: 'Failed to fetch user orders' });
  }
});

// إنشاء طلب جديد من السلة
app.post('/api/orders', async (req, res) => {
  try {
    console.log('Creating order with data:', req.body);
    
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      items,
      couponCode,
      paymentMethod,
      notes,

      customerAddress
    } = req.body;

    // التحقق من الكوبون إن وجد
    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        const subtotal = items.reduce((sum, item) => {
          const itemTotal = item.totalPrice || (item.price * item.quantity);
          return sum + itemTotal;
        }, 0);
        const discountResult = coupon.calculateDiscount(subtotal);
        if (!discountResult.error) {
          couponDiscount = discountResult.discount;
          // زيادة عدد مرات الاستخدام
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
    }

    const order = new Order({
      customerName,
      customerEmail,
      customerPhone,
      address: customerAddress || address,
      city,
      items,

      couponCode: couponCode || '',
      couponDiscount,
      paymentMethod: paymentMethod || 'cash',
      notes: notes || ''
    });

    await order.save();
    
    // تم إزالة تسجيل إنشاء الطلب حسب طلب المستخدم
    
    // إزالة العناصر من السلة بعد إنشاء الطلب
    await Cart.deleteMany({ userId: req.body.userId || 'guest' });
    
    console.log('Order created successfully:', order);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error in POST /api/orders:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

// تحديث حالة الطلب
app.put('/api/orders/:id/status', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = parseInt(req.params.id);
    
    // التحقق من صحة الحالة
    const validStatuses = ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'حالة غير صالحة' 
      });
    }
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'الطلب غير موجود' 
      });
    }
    
    // منع تغيير الحالة بعد الاستلام
    if (order.status === 'delivered' && status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تغيير حالة الطلب بعد الاستلام'
      });
    }
    
    const previousStatus = order.status;
    order.status = status;
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }
    
    await order.save();

    if (order.status === 'delivered') {
      try {
        if (order.customerEmail) {
          const customer = await Customer.findOne({ email: order.customerEmail.toLowerCase() });
          if (customer) {
            if (!order.loyaltyEarned || order.loyaltyEarned === 0) {
              const rate = 0.05;
              const earned = Math.floor((order.total || 0) * rate);
              customer.loyaltyPoints = (customer.loyaltyPoints || 0) + earned;
              order.loyaltyEarned = earned;
              await order.save();
            }
            await customer.save();
          }
        }
      } catch (e) {
        console.error('❌ Error finalizing loyalty points:', e);
      }
    }
    if (order.status === 'cancelled') {
      try {
        if (order.customerEmail) {
          const customer = await Customer.findOne({ email: order.customerEmail.toLowerCase() });
          if (customer) {
            const redeemed = order.loyaltyRedeemed || 0;
            if (redeemed > 0 && previousStatus !== 'cancelled') {
              customer.loyaltyPoints = (customer.loyaltyPoints || 0) + redeemed;
              await customer.save();
            }
          }
        }
      } catch (e) {
        console.error('❌ Error releasing reserved loyalty points:', e);
      }
    }
    
    // تسجيل نشاط تحديث حالة الطلب
    const statusMap = {
      'pending': 'في الانتظار',
      'confirmed': 'مؤكد',
      'preparing': 'قيد التحضير',
      'delivered': 'تم التسليم',
      'cancelled': 'ملغي'
    };
    
    await logOrderActivity(
      req.user?.userId || 'system',
      req.user?.name || 'النظام',
      req.user?.role || 'system',
      'status_updated',
      order._id,
      order.id,
      `تحويل الطلب من ${statusMap[previousStatus] || previousStatus} إلى ${statusMap[status] || status}`,
      previousStatus,
      status,
      `تحديث حالة الطلب رقم ${order.id}`,
      req
    );
    
    console.log('✅ Order status updated:', { orderId, previousStatus, newStatus: status });
    
    res.json({ 
      success: true, 
      message: 'تم تحديث حالة الطلب بنجاح',
      order 
    });
  } catch (error) {
    console.error('Error in PUT /api/orders/:id/status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'فشل في تحديث حالة الطلب',
      error: error.message 
    });
  }
});
// تحديث ملاحظات الطلب
app.put('/api/orders/:id/notes', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { notes } = req.body;
    const orderId = parseInt(req.params.id);
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }
    
    const previousNotes = order.notes || '';
    order.notes = notes || '';
    order.updatedAt = new Date();
    
    await order.save();
    
    // تسجيل نشاط تحديث ملاحظات الطلب
    await logOrderActivity(
      req.user?.userId || 'system',
      req.user?.name || 'النظام',
      req.user?.role || 'system',
      'notes_updated',
      order._id,
      order.id,
      `تحديث ملاحظات الطلب`,
      previousNotes,
      notes,
      `تحديث ملاحظات الطلب رقم ${order.id}`,
      req
    );
    
    res.json({ message: 'تم تحديث ملاحظات الطلب بنجاح', order });
  } catch (error) {
    console.error('Error in PUT /api/orders/:id/notes:', error);
    res.status(500).json({ message: 'فشل في تحديث ملاحظات الطلب' });
  }
});

// حذف طلب
// حذف طلب
app.delete('/api/orders/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'رقم الطلب غير صالح' 
      });
    }
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'الطلب غير موجود' 
      });
    }
    
    // تسجيل نشاط حذف الطلب قبل الحذف
    await logOrderActivity(
      req.user?.userId || 'system',
      req.user?.name || 'النظام',
      req.user?.role || 'system',
      'order_deleted',
      order._id,
      order.id,
      `تم حذف الطلب للعميل ${order.customerName} بقيمة ${order.total} ريال`,
      {
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        total: order.total,
        status: order.status,
        orderDate: order.orderDate
      },
      null,
      `حذف الطلب رقم ${order.id}`,
      req
    );
    
    await Order.deleteOne({ id: orderId });
    
    console.log('✅ Order deleted successfully:', orderId);
    
    res.json({ 
      success: true, 
      message: 'تم حذف الطلب بنجاح' 
    });
  } catch (error) {
    console.error('Error in DELETE /api/orders/:id:', error);
    res.status(500).json({ 
      success: false, 
      message: 'فشل في حذف الطلب',
      error: error.message 
    });
  }
});
// إحصائيات الطلبات
app.get('/api/orders/stats', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Error in GET /api/orders/stats:', error);
    res.status(500).json({ message: 'Failed to fetch order stats' });
  }
});

// ======================
// COUPONS APIs
// ======================
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    console.error('Error in GET /api/coupons:', error);
    res.status(500).json({ message: 'Failed to fetch coupons' });
  }
});

app.get('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ _id: req.params.id });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Error in GET /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to fetch coupon' });
  }
});

// Create coupon without file upload
app.post('/api/coupons', async (req, res) => {
  try {
    console.log('Creating coupon with data:', req.body);
    
    // Auto-generate ID if not provided
    if (!req.body.id) {
      const lastCoupon = await Coupon.findOne().sort({ id: -1 });
      req.body.id = lastCoupon ? lastCoupon.id + 1 : 1;
    }
    
    const coupon = new Coupon(req.body);
    await coupon.save();
    console.log('Coupon created successfully:', coupon);
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Error in POST /api/coupons:', error);
    res.status(500).json({ message: 'Failed to create coupon', error: error.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(coupon);
  } catch (error) {
    console.error('Error in PUT /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to update coupon' });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id });

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to delete coupon' });
  }
});

// Validate coupon
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ message: 'كوبون غير صحيح' });
    }

    const result = coupon.calculateDiscount(totalAmount);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      coupon: coupon,
      discountAmount: result.discount
    });
  } catch (error) {
    console.error('Error in POST /api/coupons/validate:', error);
    res.status(500).json({ message: 'Failed to validate coupon' });
  }
});

// ======================
// CART APIs
// ======================
app.get('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const items = await Cart.find({ userId }).sort({ createdAt: -1 });
    
    // إضافة بيانات المنتج لكل عنصر
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},  // إضافة المواصفات المختارة
        optionsPricing: item.optionsPricing || {},    // إضافة أسعار الخيارات
        attachments: item.attachments || {},          // إضافة المرفقات
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          detailedImages: product.detailedImages || [],
          stock: product.stock
        } : null
      };
    }));
    
    res.json(itemsWithProducts);
  } catch (error) {
    console.error('Error in GET /api/cart:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', async (req, res) => {
  try {
    const { userId = 'guest', productId, productName, price, quantity = 1, image = '' } = req.body;
    
    // Check if item already exists
    const existingItem = await Cart.findOne({ userId, productId });
    if (existingItem) {
      existingItem.quantity += quantity;
      await existingItem.save();
      return res.json(existingItem);
    }

    const cartItem = new Cart({
      userId,
      productId,
      productName,
      price,
      quantity,
      image
    });

    await cartItem.save();
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Error in POST /api/cart:', error);
    res.status(500).json({ message: 'Failed to add to cart' });
  }
});

app.put('/api/cart/:id', async (req, res) => {
  try {
    const { quantity } = req.body;
    const item = await Cart.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      { quantity: parseInt(quantity) },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error in PUT /api/cart/:id:', error);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
});

app.delete('/api/cart/:id', async (req, res) => {
  try {
    const item = await Cart.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/cart/:id:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Clear cart
app.delete('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    await Cart.deleteMany({ userId });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/cart:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

// ======================
// WISHLIST APIs
// ======================
app.get('/api/wishlist', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const items = await Wishlist.find({ userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Error in GET /api/wishlist:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

app.post('/api/wishlist', async (req, res) => {
  try {
    const { userId = 'guest', productId, productName, price, image = '' } = req.body;
    
    // Check if item already exists
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(400).json({ message: 'المنتج موجود بالفعل في المفضلة' });
    }

    const wishlistItem = new Wishlist({
      userId,
      productId,
      productName,
      price,
      image
    });

    await wishlistItem.save();
    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error('Error in POST /api/wishlist:', error);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

app.delete('/api/wishlist/:id', async (req, res) => {
  try {
    const item = await Wishlist.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error in DELETE /api/wishlist/:id:', error);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// Check if product is in wishlist
app.get('/api/wishlist/check/:productId', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const productId = parseInt(req.params.productId);
    
    const item = await Wishlist.findOne({ userId, productId });
    res.json({ inWishlist: !!item });
  } catch (error) {
    console.error('Error in GET /api/wishlist/check/:productId:', error);
    res.status(500).json({ message: 'Failed to check wishlist' });
  }
});

// ======================
// CUSTOMERS APIs
// ======================
// app.get('/api/customers', async (req, res) => {
//   try {
//     const customers = await Customer.find({ status: 'active' }).sort({ createdAt: -1 });
    
//     // Add cart, wishlist and orders stats
//     const customersWithStats = await Promise.all(customers.map(async (customer) => {
//       // حساب مجموع الكميات في السلة بدلاً من عدد المنتجات فقط
//       const cartItems = await Cart.find({ userId: customer.id.toString() });
//       const cartItemsCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
//       const wishlistItemsCount = await Wishlist.countDocuments({ userId: customer.id.toString() });
//       const totalOrders = await Order.countDocuments({ customerEmail: customer.email });
      
//       return {
//         ...customer.toObject(),
//         cartItemsCount,
//         wishlistItemsCount,
//         totalOrders,
//         hasCart: cartItemsCount > 0,
//         hasWishlist: wishlistItemsCount > 0
//       };
//     }));

//     res.json(customersWithStats);
//   } catch (error) {
//     console.error('Error in GET /api/customers:', error);
//     res.status(500).json({ message: 'Failed to fetch customers' });
//   }
// });

// // Customer stats endpoint
// app.get('/api/customers/stats', async (req, res) => {
//   try {
//     const totalCustomers = await Customer.countDocuments({ status: 'active' });
//     const activeCustomers = await Customer.countDocuments({ status: 'active' });
    
//     // حساب مجموع الكميات في جميع السلال بدلاً من عدد المستندات
//     const allCartItems = await Cart.find({});
//     const totalCartItems = allCartItems.reduce((total, item) => total + (item.quantity || 1), 0);
//     const totalWishlistItems = await Wishlist.countDocuments();
    
//     // Calculate averages
//     const avgCartItems = totalCustomers > 0 ? (totalCartItems / totalCustomers).toFixed(1) : 0;
//     const avgWishlistItems = totalCustomers > 0 ? (totalWishlistItems / totalCustomers).toFixed(1) : 0;

//     res.json({
//       totalCustomers,
//       activeCustomers,
//       totalCartItems,
//       totalWishlistItems,
//       avgCartItems: parseFloat(avgCartItems),
//       avgWishlistItems: parseFloat(avgWishlistItems)
//     });
//   } catch (error) {
//     console.error('Error in GET /api/customers/stats:', error);
//     res.status(500).json({ message: 'Failed to fetch customer stats' });
//   }
// });

// app.post('/api/customers', async (req, res) => {
//   try {
//     const customer = new Customer(req.body);
//     await customer.save();
//     res.status(201).json(customer);
//   } catch (error) {
//     console.error('Error in POST /api/customers:', error);
//     res.status(500).json({ message: 'Failed to create customer' });
//   }
// });

// // Send OTP
// app.post('/api/customers/send-otp', async (req, res) => {
//   try {
//     const { email } = req.body;
    
//     let customer = await Customer.findOne({ email });
//     if (!customer) {
//       customer = new Customer({
//         email,
//         name: 'عميل جديد',
//         phone: ''
//       });
//     }

//     const otp = customer.generateOTP();
//     await customer.save();

//     // إرسال OTP عبر الإيميل الحقيقي
//     console.log(`🔄 Sending OTP to ${email}: ${otp}`);
//     const emailResult = await sendOTPEmail(email, otp, customer.name);
    
//     if (emailResult.success) {
//       console.log(`✅ OTP Email sent successfully to ${email}`);
//       res.json({ 
//         message: 'تم إرسال كود التحقق إلى إيميلك بنجاح ✉️',
//         emailSent: true
//       });
//     } else {
//       console.error(`❌ Failed to send OTP email to ${email}:`, emailResult.error);
//       // في حالة فشل الإيميل، لا نزال نعطي الكود للمستخدم
//       console.log(`📋 Backup OTP for ${email}: ${otp}`);
//       res.json({ 
//         message: 'تم إنشاء كود التحقق (تحقق من الإيميل أو الكونسول)',
//         emailSent: false,
//         backupOtp: otp // للتطوير فقط
//       });
//     }
//   } catch (error) {
//     console.error('Error in POST /api/customers/send-otp:', error);
//     res.status(500).json({ message: 'Failed to send OTP' });
//   }
// });

// // Verify OTP
// app.post('/api/customers/verify-otp', async (req, res) => {
//   try {
//     const { email, otp } = req.body;
    
//     const customer = await Customer.findOne({ email });
//     if (!customer) {
//       return res.status(404).json({ message: 'العميل غير موجود' });
//     }

//     const result = customer.verifyOTP(otp);
//     if (!result.valid) {
//       return res.status(400).json({ message: result.message });
//     }

//     await customer.save();
//     res.json({ message: result.message, customer });
//   } catch (error) {
//     console.error('Error in POST /api/customers/verify-otp:', error);
//     res.status(500).json({ message: 'Failed to verify OTP' });
//   }
// });

// // Delete customer
// app.delete('/api/customers/:id', async (req, res) => {
//   try {
//     const customerId = req.params.id;
    
//     // حذف العميل من قاعدة البيانات
//     const result = await Customer.deleteOne({ _id: customerId });
    
//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: 'العميل غير موجود' });
//     }
    
//     // حذف السلة وقائمة الأمنيات المرتبطة بالعميل
//     await Cart.deleteMany({ userId: customerId });
//     await Wishlist.deleteMany({ userId: customerId });
    
//     console.log(`✅ Customer ${customerId} deleted successfully`);
//     res.json({ message: 'تم حذف العميل بنجاح' });
//   } catch (error) {
//     console.error('❌ Error deleting customer:', error);
//     res.status(500).json({ error: 'فشل في حذف العميل' });
//   }
// });

// ======================
// REVIEWS APIs
// ======================

// Get reviews for a product
app.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error in GET /api/products/:productId/reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Add a review
app.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const { customerId, customerName, comment } = req.body;
    
    if (!customerId || !customerName || !comment) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }
    
    const review = new Review({
      productId,
      customerId,
      customerName,
      comment
    });
    
    await review.save();
    res.status(201).json({ 
      message: 'تم إضافة تعليقك بنجاح!',
      review 
    });
  } catch (error) {
    console.error('Error in POST /api/products/:productId/reviews:', error);
    res.status(500).json({ message: 'Failed to add review' });
  }
});

// Get all reviews (for admin)
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Error in GET /api/reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Delete review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    
    const review = await Review.findOneAndDelete({ id: reviewId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/reviews/:id:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
});

// ======================
// AUTHENTICATION APIs (Login, Register)
// ======================

// Login
app.post('/api/auth/login', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  let loginLogData = {
    email: req.body.email,
    userName: 'Unknown User', // Default value to satisfy schema requirement
    ipAddress,
    userAgent,
    success: false,
    timestamp: new Date()
  };

  try {
    const { email, password } = req.body;
    console.log(`🔒 Login attempt for email: ${email}`);

    // التحقق من المدخلات
    if (!email || !password) {
      loginLogData.failureReason = 'missing_credentials';
      loginLogData.userName = 'Unknown User'; // Set default userName
      await LoginLog.create(loginLogData);
      console.log('⚠️ Login failed: Missing email or password');
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    // البحث عن المستخدم في جدول User أولاً (للأدمن والموظفين)
    let user = await User.findOne({ email: email.toLowerCase() });
    let userType = 'admin';
    
    // إذا لم يوجد في جدول User، ابحث في جدول Customer
    if (!user) {
      user = await Customer.findOne({ email: email.toLowerCase() });
      userType = 'customer';
    }
    
    if (!user) {
      loginLogData.failureReason = 'user_not_found';
      loginLogData.userName = 'Unknown User'; // Set default userName
      await LoginLog.create(loginLogData);
      console.log(`⚠️ Login failed: User not found for email: ${email}`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // تحديث بيانات السجل بمعلومات المستخدم
    loginLogData.userId = user._id;
    loginLogData.userName = user.name || user.firstName + ' ' + user.lastName;
    loginLogData.userRole = userType === 'admin' ? user.role : 'customer';

    // مقارنة كلمة المرور
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      loginLogData.failureReason = 'invalid_credentials';
      loginLogData.userName = user.name || user.firstName + ' ' + user.lastName || 'Unknown User'; // Set userName
      await LoginLog.create(loginLogData);
      console.log(`⚠️ Login failed: Invalid password for email: ${email}`);
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }
    
    // إنشاء JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: userType === 'admin' ? user.role : 'customer',
        userType: userType
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // تسجيل نجاح الدخول
    loginLogData.success = true;
    loginLogData.sessionId = token.substring(0, 20); // جزء من التوكن كمعرف للجلسة
    await LoginLog.create(loginLogData);
    
    // تحديث lastLogin للعميل
    if (userType === 'customer') {
      await Customer.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    }
    
    // إزالة كلمة المرور من بيانات المستخدم قبل إرسالها
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.otp;
    
    // إضافة نوع المستخدم للاستجابة
    userResponse.userType = userType;
    
    // إضافة lastLogin للاستجابة إذا كان العميل
    if (userType === 'customer') {
      userResponse.lastLogin = new Date();
    }

    console.log(`✅ Login successful for user: ${email} (${userType})`);
    console.log('🔍 Token generated:', { tokenExists: !!token, tokenType: typeof token, tokenLength: token ? token.length : 0 });
    res.json({ 
      message: 'تم تسجيل الدخول بنجاح', 
      user: userResponse,
      token: token
    });

  } catch (error) {
    // تسجيل خطأ الخادم
    loginLogData.failureReason = 'server_error';
    // التأكد من وجود userName في حالة الخطأ
    if (!loginLogData.userName) {
      loginLogData.userName = 'Unknown User';
    }
    try {
      await LoginLog.create(loginLogData);
    } catch (logError) {
      console.error('❌ Error saving login log:', logError);
    }
    console.error('❌ Error in /api/auth/login:', error);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    console.log(`📝 Registration attempt for email: ${email}`);

    // التحقق من المدخلات
    if (!email || !password || !firstName || !lastName || !phone) {
      console.log('⚠️ Registration failed: Missing required fields');
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    // التحقق من وجود المستخدم
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
    if (existingCustomer) {
      console.log(`⚠️ Registration failed: Email already exists: ${email}`);
      return res.status(409).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    // إنشاء مستخدم جديد
    const newCustomer = new Customer({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone,
      name: `${firstName} ${lastName}`
    });

    await newCustomer.save();
    
    // إزالة كلمة المرور من بيانات المستخدم قبل إرسالها
    const userResponse = newCustomer.toObject();
    delete userResponse.password;
    delete userResponse.otp;

    console.log(`✅ Registration successful for user: ${email}`);
    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: userResponse });

  } catch (error) {
    console.error('❌ Error in /api/auth/register:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'بيانات غير صالحة', errors: error.errors });
    }
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

// Send OTP (Legacy - can be removed if not needed)
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    let customer = await Customer.findOne({ email });
    if (!customer) {
      customer = new Customer({
        email,
        name: 'عميل جديد',
        phone: ''
      });
    }

    const otp = customer.generateOTP();
    await customer.save();

    // إرسال OTP عبر الإيميل الحقيقي
    console.log(`🔄 Sending OTP to ${email}: ${otp}`);
    const emailResult = await sendOTPEmail(email, otp, customer.name);
    
    if (emailResult.success) {
      console.log(`✅ OTP Email sent successfully to ${email}`);
      res.json({ 
        message: 'تم إرسال كود التحقق إلى إيميلك بنجاح ✉️',
        emailSent: true
      });
    } else {
      console.error(`❌ Failed to send OTP email to ${email}:`, emailResult.error);
      // في حالة فشل الإيميل، لا نزال نعطي الكود للمستخدم
      console.log(`📋 Backup OTP for ${email}: ${otp}`);
      res.json({ 
        message: 'تم إنشاء كود التحقق (تحقق من الإيميل أو الكونسول)',
        emailSent: false,
        backupOtp: otp // للتطوير فقط
      });
    }
  } catch (error) {
    console.error('Error in POST /api/auth/send-otp:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    const result = customer.verifyOTP(otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    await customer.save();
    res.json({ message: result.message, customer });
  } catch (error) {
    console.error('Error in POST /api/auth/verify-otp:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

// Complete Registration for new users
app.post('/api/auth/complete-registration', async (req, res) => {
  try {
    const { email, firstName, lastName, phone } = req.body;
    
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    // تحديث بيانات العميل
    customer.name = `${firstName} ${lastName}`;
    customer.phone = phone;
    await customer.save();

    res.json({ 
      message: 'تم إنشاء الحساب بنجاح',
      user: customer
    });
  } catch (error) {
    console.error('Error in POST /api/auth/complete-registration:', error);
    res.status(500).json({ message: 'خطأ في الاتصال. حاول مرة أخرى' });
  }
});

// ======================
// USER CART APIs
// ======================

// Get user's cart
app.get('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    const items = await Cart.find({ userId }).sort({ createdAt: -1 });
    
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},
        optionsPricing: item.optionsPricing || {},
        attachments: item.attachments || {},
        addOns: item.addOns || [],
        basePrice: item.basePrice || 0,
        addOnsPrice: item.addOnsPrice || 0,
        totalPrice: item.totalPrice || (item.price * item.quantity),
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          detailedImages: product.detailedImages || [],
          stock: product.stock,
        } : null
      };
    }));

    const subtotal = itemsWithProducts.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    let customer = null;
    const numericId = parseInt(userId);
    if (!isNaN(numericId)) {
      customer = await Customer.findOne({ id: numericId });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      customer = await Customer.findById(userId);
    }
    const availablePoints = customer ? (customer.loyaltyPoints || 0) : 0;
    const loyaltyDiscount = Math.min(availablePoints, subtotal);
    const total = Math.max(subtotal - loyaltyDiscount, 0);

    res.json({
      items: itemsWithProducts,
      subtotal,
      loyaltyAvailable: availablePoints,
      loyaltyDiscount,
      total
    });
  } catch (error) {
    console.error('Error in GET /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});
app.get('/api/user/:userId/cart/summary', async (req, res) => {
  try {
    const userId = req.params.userId;
    const applyLoyalty = String(req.query.applyLoyalty || '').toLowerCase() === 'true';
    const loyaltyPointsToRedeemParam = req.query.loyaltyPointsToRedeem;
    const requestedRedeem = loyaltyPointsToRedeemParam !== undefined ? parseInt(loyaltyPointsToRedeemParam) : undefined;

    const items = await Cart.find({ userId }).sort({ createdAt: -1 });
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},
        optionsPricing: item.optionsPricing || {},
        attachments: item.attachments || {},
        addOns: item.addOns || [],
        basePrice: item.basePrice || 0,
        addOnsPrice: item.addOnsPrice || 0,
        totalPrice: item.totalPrice || (item.price * item.quantity),
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          detailedImages: product.detailedImages || [],
          stock: product.stock,
        } : null
      };
    }));

    const subtotal = itemsWithProducts.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    let customer = null;
    const numericId = parseInt(userId);
    if (!isNaN(numericId)) {
      customer = await Customer.findOne({ id: numericId });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      customer = await Customer.findById(userId);
    }

    const availablePoints = customer ? (customer.loyaltyPoints || 0) : 0;
    let loyaltyDiscount = 0;
    if (applyLoyalty && availablePoints > 0 && subtotal > 0) {
      const pointsRequested = (typeof requestedRedeem === 'number' && !isNaN(requestedRedeem)) ? requestedRedeem : availablePoints;
      loyaltyDiscount = Math.min(pointsRequested, availablePoints, subtotal);
    }

    const total = Math.max(subtotal - loyaltyDiscount, 0);

    res.json({
      items: itemsWithProducts,
      subtotal,
      loyaltyAvailable: availablePoints,
      loyaltyDiscount,
      total
    });
  } catch (error) {
    console.error('Error in GET /api/user/:userId/cart/summary:', error);
    res.status(500).json({ message: 'Failed to fetch cart summary' });
  }
});

// Add to user's cart
app.post('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId, quantity = 1, selectedOptions = {}, optionsPricing = {}, attachments = {}, addOns = [], basePrice, addOnsPrice, totalPrice } = req.body;
    
    console.log('🛒 Adding to cart:', { productId, quantity, addOns, basePrice, addOnsPrice, totalPrice });
    
    // الحصول على بيانات المنتج
    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    
    // التحقق من وجود العنصر في السلة مع نفس الخيارات والمنتجات الإضافية
    const existingItem = await Cart.findOne({ 
      userId, 
      productId,
      selectedOptions: selectedOptions,
      addOns: addOns
    });
    
    if (existingItem) {
      existingItem.quantity += quantity;
      if (attachments && (attachments.text || (attachments.images && attachments.images.length > 0))) {
        existingItem.attachments = attachments;
      }
      const bp = existingItem.basePrice || existingItem.price || 0;
      const ap = existingItem.addOnsPrice || 0;
      existingItem.totalPrice = (bp * existingItem.quantity) + ap;
      await existingItem.save();
      return res.json(existingItem);
    }

    const bp = (typeof basePrice === 'number' ? basePrice : product.price) || 0;
    const ap = (typeof addOnsPrice === 'number' ? addOnsPrice : 0) || 0;
    const computedTotal = (bp * quantity) + ap;
    const cartItem = new Cart({
      userId,
      productId,
      productName: product.name,
      price: bp,
      quantity,
      image: product.mainImage,
      selectedOptions: selectedOptions || {},
      optionsPricing: optionsPricing || {},
      attachments: attachments || {},
      addOns: addOns || [],
      basePrice: bp,
      addOnsPrice: ap,
      totalPrice: typeof totalPrice === 'number' ? totalPrice : computedTotal
    });

    await cartItem.save();
    console.log('✅ Cart item saved:', cartItem);
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Error in POST /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to add to cart' });
  }
});

// Update cart item quantity
app.put('/api/user/:userId/cart/:itemId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const itemId = parseInt(req.params.itemId);
    const { quantity, selectedOptions, optionsPricing, attachments, productId } = req.body;
    
    console.log(`🔄 Updating cart item ${itemId} for user ${userId}`);
    console.log('📦 Request body:', { quantity, selectedOptions, optionsPricing, attachments, productId });
    
    // تحضير البيانات للتحديث
    const updateData = {};
    
    if (quantity !== undefined) {
      if (quantity < 1) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
      updateData.quantity = quantity;
      console.log(`📊 Updating quantity to: ${quantity}`);
    }
    
    if (selectedOptions !== undefined) {
      updateData.selectedOptions = selectedOptions;
      console.log(`🎯 Updating selectedOptions:`, selectedOptions);
    }
    
    if (optionsPricing !== undefined) {
      updateData.optionsPricing = optionsPricing;
      console.log(`💰 Updating optionsPricing:`, optionsPricing);
    }
    
    if (attachments !== undefined) {
      updateData.attachments = attachments;
      console.log(`📎 Updating attachments:`, attachments);
    }
    
    if (productId !== undefined) {
      updateData.productId = productId;
      console.log(`🏷️ Updating productId to: ${productId}`);
    }
    
    // Try to find by id (number) first
    let item = await Cart.findOneAndUpdate(
      { id: itemId, userId },
      updateData,
      { new: true }
    );
    
    // If not found, try by _id (ObjectId) as fallback
    if (!item) {
      console.log(`🔄 Item not found by id, trying _id for item ${itemId}`);
      try {
        item = await Cart.findOneAndUpdate(
          { _id: itemId, userId },
          updateData,
          { new: true }
        );
      } catch (err) {
        console.log(`❌ Invalid ObjectId format: ${itemId}`);
      }
    }

    if (!item) {
      console.log(`❌ Cart item ${itemId} not found for user ${userId}`);
      return res.status(404).json({ message: 'Cart item not found' });
    }

    try {
      const bp = item.basePrice || item.price || 0;
      const ap = item.addOnsPrice || 0;
      item.totalPrice = (bp * item.quantity) + ap;
      await item.save();
    } catch (e) {}

    console.log(`✅ Cart item ${itemId} updated successfully for user ${userId}`);
    console.log(`✅ Final item state:`, {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
      optionsPricing: item.optionsPricing,
      attachments: item.attachments
    });
    
    res.json({ 
      message: 'Cart item updated successfully', 
      item: {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        selectedOptions: item.selectedOptions,
        optionsPricing: item.optionsPricing,
        attachments: item.attachments
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/user/:userId/cart/:itemId:', error);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
});

// Remove product from cart by productId
app.delete('/api/user/:userId/cart/product/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    const item = await Cart.findOneAndDelete({ userId, productId });

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart/product/:productId:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Remove cart item by itemId
app.delete('/api/user/:userId/cart/:itemId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const itemId = parseInt(req.params.itemId);
    
    console.log(`🗑️ DELETE REQUEST RECEIVED`);
    console.log(`🗑️ User ID: ${userId} (type: ${typeof userId})`);
    console.log(`🗑️ Item ID: ${itemId} (type: ${typeof itemId})`);
    console.log(`🗑️ Raw Item ID from params: ${req.params.itemId}`);
    console.log(`🗑️ Request headers:`, req.headers);
    console.log(`🗑️ Attempting to delete cart item ${itemId} for user ${userId}`);
    
    // Try to find by id (number) first
    let item = await Cart.findOneAndDelete({ id: itemId, userId });
    
    // If not found, try by _id (ObjectId) as fallback
    if (!item) {
      console.log(`🔄 Item not found by id, trying _id for item ${itemId}`);
      try {
        item = await Cart.findOneAndDelete({ _id: itemId, userId });
      } catch (err) {
        console.log(`❌ Invalid ObjectId format: ${itemId}`);
      }
    }

    if (!item) {
      console.log(`❌ Cart item ${itemId} not found for user ${userId}`);
      return res.status(404).json({ message: 'Cart item not found' });
    }

    console.log(`✅ Cart item ${itemId} deleted successfully for user ${userId}`);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart/:itemId:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Clear user's cart
app.delete('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    await Cart.deleteMany({ userId });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

// Get user's wishlist
app.get('/api/user/:userId/wishlist', async (req, res) => {
  try {
    const userId = req.params.userId;
    const items = await Wishlist.find({ userId }).sort({ createdAt: -1 });
    
    // إضافة بيانات المنتج لكل عنصر
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        userId: item.userId,
        addedAt: item.createdAt,
        product: product ? {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          stock: product.stock
        } : null
      };
    }));
    
    res.json(itemsWithProducts);
  } catch (error) {
    console.error('Error in GET /api/user/:userId/wishlist:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

// Add to wishlist
app.post('/api/user/:userId/wishlist', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId } = req.body;
    
    // الحصول على بيانات المنتج
    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    
    // التحقق من وجود العنصر في قائمة الأمنيات
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(400).json({ message: 'المنتج موجود بالفعل في المفضلة' });
    }

    const wishlistItem = new Wishlist({
      userId,
      productId,
      productName: product.name,
      price: product.price,
      image: product.mainImage
    });

    await wishlistItem.save();
    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error('Error in POST /api/user/:userId/wishlist:', error);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

// Remove from wishlist
app.delete('/api/user/:userId/wishlist/product/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    console.log(`🗑️ DELETE WISHLIST REQUEST RECEIVED`);
    console.log(`🗑️ User ID: ${userId} (type: ${typeof userId})`);
    console.log(`🗑️ Product ID: ${productId} (type: ${typeof productId})`);
    console.log(`🗑️ Raw Product ID from params: ${req.params.productId}`);
    
    // First, let's check what items exist for this user
    const userWishlistItems = await Wishlist.find({ userId });
    console.log(`🔍 Found ${userWishlistItems.length} wishlist items for user ${userId}:`);
    userWishlistItems.forEach(item => {
      console.log(`  - Item ID: ${item.id}, Product ID: ${item.productId} (type: ${typeof item.productId}), User ID: ${item.userId}`);
    });
    
    const item = await Wishlist.findOneAndDelete({ userId, productId });

    if (!item) {
      console.log(`❌ Wishlist item not found for user ${userId} and product ${productId}`);
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    console.log(`✅ Wishlist item deleted successfully:`, item);
    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/wishlist/product/:productId:', error);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// Clear entire wishlist for a user
app.delete('/api/user/:userId/wishlist', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const result = await Wishlist.deleteMany({ userId });

    res.json({ 
      message: 'Wishlist cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/wishlist:', error);
    res.status(500).json({ message: 'Failed to clear wishlist' });
  }
});

// Check if product is in user's wishlist
app.get('/api/user/:userId/wishlist/check/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    const item = await Wishlist.findOne({ userId, productId });
    res.json({ isInWishlist: !!item });
  } catch (error) {
    console.error('Error in GET /api/user/:userId/wishlist/check/:productId:', error);
    res.status(500).json({ message: 'Failed to check wishlist' });
  }
});

// Upload attachment images
app.post('/api/upload-attachments', uploadFiles, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const imagePaths = req.files.map(file => `/images/${file.filename}`);
    res.json({ 
      message: 'Files uploaded successfully',
      imagePaths 
    });
  } catch (error) {
    console.error('Error uploading attachments:', error);
    res.status(500).json({ message: 'Failed to upload files' });
  }
});

// Checkout endpoint
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customerInfo, paymentMethod, total, subtotal, couponDiscount, appliedCoupon, paymentId, paymentStatus, userId, isGuestOrder, applyLoyalty, loyaltyPointsToRedeem } = req.body;
    
    console.log('💰 [Checkout] Creating order with data (SERVER CONTROLLED):', {
      customerInfo,
      itemsCount: items.length,
      total,
      subtotal,
      couponDiscount,
      paymentMethod,
      paymentStatus,
      userId,
      isGuestOrder: !!isGuestOrder,
      applyLoyalty,
      loyaltyPointsToRedeem,
      loyaltyData: { 
        applyLoyalty, 
        loyaltyPointsToRedeem, 
        typeofApplyLoyalty: typeof applyLoyalty,
        typeofLoyaltyPointsToRedeem: typeof loyaltyPointsToRedeem,
        serverControl: 'LOYALTY POINTS AUTO-APPLIED BY SERVER IF AVAILABLE'
      }
    });
    
    // التحقق من صحة البيانات الأساسية
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'لا يمكن إتمام طلب فارغ' });
    }
    
    console.log('🔍 [Checkout] Validating customerInfo:', {
      customerInfo,
      hasCustomerInfo: !!customerInfo,
      hasName: !!(customerInfo && customerInfo.name),
      hasPhone: !!(customerInfo && customerInfo.phone),
      nameValue: customerInfo ? customerInfo.name : 'undefined',
      phoneValue: customerInfo ? customerInfo.phone : 'undefined'
    });
    
    if (!customerInfo || !customerInfo.name || !customerInfo.phone) {
      console.log('❌ [Checkout] Validation failed - incomplete customer data');
      return res.status(400).json({ message: 'بيانات العميل غير كاملة' });
    }
    
    console.log('✅ [Checkout] Customer info validation passed');
    
    // تحضير عناصر الطلب - البيانات جاهزة من الفرونت إند
    const orderItems = items.map(item => ({
      productId: item.productId,
      productName: item.productName || 'منتج غير معروف',
      price: item.price || 0,
      quantity: item.quantity || 1,
      totalPrice: item.totalPrice || (item.price * item.quantity),
      selectedOptions: item.selectedOptions || {},
      optionsPricing: item.optionsPricing || {},
      productOptions: item.productOptions || [],
      productOptionsPriceModifier: item.productOptionsPriceModifier || 0,
      productImage: item.productImage || '',
      attachments: item.attachments || {},
      addOns: item.addOns || [],
      basePrice: item.basePrice || 0,
      addOnsPrice: item.addOnsPrice || 0
    }));

    // استخدام القيم المحسوبة من الفرونت إند أو حساب قيم احتياطية
    const orderSubtotal = subtotal || orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const orderCouponDiscount = couponDiscount || 0;
let orderTotal = orderSubtotal - orderCouponDiscount; // ✅ احسب من subtotal مباشرة

    let customer = null;
    if (customerInfo && customerInfo.email) {
      customer = await Customer.findOne({ email: (customerInfo.email || '').toLowerCase() });
    }
    if (!customer && userId) {
      const numericId = parseInt(userId);
      if (!isNaN(numericId)) {
        customer = await Customer.findOne({ id: numericId });
      }
    }

    let availablePoints = customer ? (customer.loyaltyPoints || 0) : 0;
    const requestedFromBody = (typeof loyaltyPointsToRedeem === 'number' && loyaltyPointsToRedeem >= 0)
      ? loyaltyPointsToRedeem
      : (typeof req.body.loyaltyDiscount === 'number' ? req.body.loyaltyDiscount : undefined);
    
    // Debug loyalty points logic - SERVER CONTROLLED
    console.log('🔍 [Checkout] Loyalty points debug (SERVER CONTROLLED):', {
      applyLoyalty: applyLoyalty,
      loyaltyPointsToRedeem: loyaltyPointsToRedeem,
      availablePoints: availablePoints,
      requestedFromBody: requestedFromBody,
      orderTotal: orderTotal,
      customerExists: !!customer,
      customerEmail: customer?.email
    });
    
    // ✅ الخادم يتحكم تماماً في خصم نقاط الولاء
    let pointsToRedeem = 0;
    if (availablePoints > 0 && orderTotal > 0) {
      // استخدم النقاط المطلوبة أو كل النقاط المتاحة، أيهما أقل
      const requested = (requestedFromBody !== undefined && requestedFromBody > 0) ? requestedFromBody : availablePoints;
      pointsToRedeem = Math.min(requested, availablePoints, orderTotal);
      orderTotal = Math.max(orderTotal - pointsToRedeem, 0);
      
      console.log('✅ [Checkout] Loyalty points AUTO-APPLIED by server:', {
        pointsToRedeem: pointsToRedeem,
        newOrderTotal: orderTotal,
        availablePoints: availablePoints,
        requestedPoints: requested,
        autoApplied: true
      });
    } else {
      console.log('❌ [Checkout] Loyalty points NOT applied (server decision):', {
        availablePoints: availablePoints,
        orderTotal: orderTotal,
        reason: availablePoints <= 0 ? 'no available points' : 'orderTotal <= 0'
      });
    }

    // معلومات الكوبون
    let couponCode = '';
    if (appliedCoupon && appliedCoupon.code) {
      couponCode = appliedCoupon.code;
    }

    // إنشاء الطلب
    const order = new Order({
      customerName: customerInfo.name,
      customerEmail: customerInfo.email || '',
      customerPhone: customerInfo.phone || '',
      customerAddress: customerInfo.address || '',
      items: orderItems,
      subtotal: orderSubtotal,
      total: orderTotal,
      couponCode,
      couponDiscount: orderCouponDiscount,
      loyaltyRedeemed: pointsToRedeem,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentStatus || 'pending',
      notes: customerInfo.notes || ''
    });

    // إضافة معرف الدفع إذا كان متوفراً
    if (paymentId) {
      order.paymentId = paymentId;
    }

    // حفظ الطلب
    const savedOrder = await order.save();

    console.log("customerId", customer?._id);

    if (customer && customer._id && pointsToRedeem > 0) {
      try {
        customer.loyaltyPoints = Math.max((customer.loyaltyPoints || 0) - pointsToRedeem, 0);
        await customer.save();
        console.log('✅ [Checkout] Customer loyalty points deducted:', {
          customerId: customer._id,
          email: customer.email,
          pointsRedeemed: pointsToRedeem,
          newPoints: customer.loyaltyPoints
        });
      } catch (updateError) {
        console.error('❌ [Checkout] Error updating loyalty points:', updateError);
      }
    }

    const LOYALTY_EARN_RATE = 0.05;
    let potentialEarn = 0;
    if (paymentStatus === 'paid') {
      potentialEarn = Math.floor(orderTotal * LOYALTY_EARN_RATE);
      savedOrder.loyaltyEarned = potentialEarn;
      await savedOrder.save();
    }
    
    console.log('✅ [Checkout] Order created successfully:', {
      orderId: savedOrder.id,
      customerName: savedOrder.customerName,
      total: savedOrder.total,
      isGuest: !!isGuestOrder
    });

    // إرسال استجابة النجاح مع كامل البيانات
    res.status(201).json({ 
      success: true,
      message: 'تم إرسال طلبك بنجاح!',
      orderId: savedOrder.id,
      order: {
        id: savedOrder.id,
        customerName: savedOrder.customerName,
        customerEmail: savedOrder.customerEmail,
        customerPhone: savedOrder.customerPhone,
        address: savedOrder.address,
        city: savedOrder.city,
        total: savedOrder.total,
        subtotal: savedOrder.subtotal,
        couponDiscount: savedOrder.couponDiscount,
        loyaltyRedeemed: savedOrder.loyaltyRedeemed,
        loyaltyEarned: savedOrder.loyaltyEarned,
        status: savedOrder.status,
        paymentMethod: savedOrder.paymentMethod,
        paymentStatus: savedOrder.paymentStatus,
        orderDate: savedOrder.orderDate,
        items: savedOrder.items,
        notes: savedOrder.notes
      }
    });

  } catch (error) {
    console.error('❌ [Checkout] Error creating order:', error);
    
    // إرسال رسالة خطأ مفصلة
    let errorMessage = 'فشل في إتمام الطلب';
    if (error.name === 'ValidationError') {
      errorMessage = 'بيانات الطلب غير صحيحة';
    } else if (error.code === 11000) {
      errorMessage = 'خطأ في قاعدة البيانات - يرجى إعادة المحاولة';
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// Update cart item options (alternative endpoint for options-only updates)
app.put('/api/user/:userId/cart/update-options', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId, selectedOptions, attachments } = req.body;
    
    console.log(`🔄 Updating cart options for user ${userId}, product ${productId}`);
    console.log('📝 New options:', selectedOptions);
    console.log('📎 New attachments:', attachments);
    
    // العثور على العنصر في السلة
    const cartItem = await Cart.findOne({ userId, productId });
    if (!cartItem) {
      return res.status(404).json({ message: 'المنتج غير موجود في السلة' });
    }
    
    // تحديث الخيارات والمرفقات
    if (selectedOptions !== undefined) {
      cartItem.selectedOptions = selectedOptions;
    }
    if (attachments !== undefined) {
      cartItem.attachments = attachments;
    }
    
    await cartItem.save();
    
    console.log('✅ Cart options updated successfully');
    console.log('✅ Final cart item:', {
      id: cartItem.id,
      productId: cartItem.productId,
      selectedOptions: cartItem.selectedOptions,
      attachments: cartItem.attachments
    });
    
    res.json({ 
      message: 'تم تحديث خيارات المنتج بنجاح',
      cartItem: {
        id: cartItem.id,
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        selectedOptions: cartItem.selectedOptions,
        optionsPricing: cartItem.optionsPricing,
        attachments: cartItem.attachments
      }
    });
  } catch (error) {
    console.error('❌ Error updating cart options:', error);
    res.status(500).json({ message: 'فشل في تحديث خيارات المنتج' });
  }
});

// Use invoice routes
app.use('/api/invoices', invoiceRoutes);

// Use static pages routes
app.use('/api/static-pages', staticPagesRoutes);
app.use('/api/documentations', documentationsRoutes);

// Use blog posts routes
app.use('/api/blog-posts', blogPostsRoutes);

// Use testimonials routes
app.use('/api/testimonials', testimonialsRoutes);

// Use clients routes
app.use('/api/clients', clientsRoutes);

// Use customers routes
app.use('/api/customers', customersRoutes);

// Use users routes
app.use('/api/users', usersRoutes);

// Comments routes
app.use('/api/comments', commentsRoutes);

// Logs routes
app.use('/api/logs', logsRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Admin PIN routes
app.use('/api/admin-pin', adminPinRoutes);

// Portfolio routes
app.use('/api/portfolio-categories', portfolioCategoriesRoutes);
app.use('/api/portfolios', portfoliosRoutes);


app.use('/api/subcategories', subcategoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/theme-card', themecard); 
app.use('/api/theme-works', themeWorks);
app.use('/api/visits', visits); 
app.use('/api/announcement-bar', announcement); 
app.use('/api/navigation-visibility', navigationVisibilityRoutes);




// ======================
// DEBUGGING 404 ERRORS
// ======================
// هذا الكود سيلتقط أي طلب لا يجد مساراً مطابقاً
app.use((req, res, next) => {
  console.log(`[404 DEBUG] Received ${req.method} request for unmatched URL: ${req.originalUrl}`);
  // تسجيل تفاصيل إضافية قد تساعد في كشف المشكلة
  console.log('[404 DEBUG] Request Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[404 DEBUG] Request Body:', JSON.stringify(req.body, null, 2));
  
  res.status(404).json({
    message: `Endpoint not found on the server.`,
    error: `The server received a ${req.method} request for the URL "${req.originalUrl}", but no corresponding route handler was found. Please check the API documentation or the server routing configuration.`,
    method: req.method,
    requestedUrl: req.originalUrl
  });
});

// ======================
// ORIGINAL APIs (تم الاحتفاظ بها للتوافق مع الداش بورد)
// ======================

// Start server
async function startServer() {
  await connectDB();
  
  app.listen(port, () => {
    console.log('🚀 Mawasiem Server with MongoDB is running!');
    console.log(`📍 Server: http://localhost:${port}`);
    console.log(`🗄️  Database: MongoDB`);
    console.log(`🔍 Health Check: http://localhost:${port}/api/health`);
    console.log(`🎯 Frontend: Remember to run 'cd frontend && npm run dev'`);
  });
}

startServer().catch(console.error);
