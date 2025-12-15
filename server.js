import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Configure dotenv
dotenv.config();

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import staticPagesRouter from './routes/staticPages.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import customersRouter from './routes/customers.js';
import commentsRouter from './routes/comments.js';
import adminPinRouter from './routes/adminPin.js';
import blogPostsRouter from './routes/blogPosts.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import portfoliosRouter from './routes/portfolios.js';
import portfolioCategoriesRouter from './routes/portfolioCategories.js';
import cartRouter from './routes/cart.js';
import wishlistRouter from './routes/wishlist.js';
import bannersRouter from './routes/banners.js';
import collectionsRouter from './routes/collections.js';
import subcategoriesRouter from './routes/subcategories.js';
import themecard from './routes/themecard.js';
import visitsRouter from './routes/visits.js';


const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB connection
import { config } from './config.js';
const MONGODB_URI = process.env.MONGODB_URI || config.mongodb.atlasUri;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:8081',     // Expo web development server
    'https://afterads.netlify.app',  // Netlify frontend URL
    'https://afterads.netlify.app/', // With trailing slash
    'https://ghem.store',         // Main domain
    'https://www.ghem.store',     // With www
    'http://ghem.store',          // HTTP version (for redirects)
    'http://www.ghem.store',      // HTTP with www
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/images', express.static(path.join(process.cwd(), 'public/images')));
app.use(express.static(path.join(process.cwd(), 'public')));

// Connect to MongoDB with Mongoose
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB with Mongoose');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Routes
// app.use('/api/static-pages', staticPagesRouter);
// app.use('/api/auth', authRouter);
// app.use('/api/users', usersRouter);
// app.use('/api/customers', customersRouter);
// app.use('/api/comments', commentsRouter);
// app.use('/api/admin-pin', adminPinRouter);
// app.use('/api/blog-posts', blogPostsRouter);
// app.use('/api/categories', categoriesRouter);
// app.use('/api/products', productsRouter);
// app.use('/api/portfolios', portfoliosRouter);
// app.use('/api/portfolio-categories', portfolioCategoriesRouter);
// app.use('/api/cart', cartRouter);
// app.use('/api', wishlistRouter);
// app.use('/api/banners', bannersRouter);
// app.use('/api/collections', collectionsRouter);
// app.use('/api/subcategories', subcategoriesRouter);
app.use('/api/theme-card', themecard); 
app.use('/api/visits', visitsRouter);


// Multer error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'عدد كبير من الملفات'
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: error.message
    });
  }
  
  // Handle custom multer errors (like file type validation)
  if (error.message === 'فقط ملفات الصور مسموحة!') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'فقط ملفات الصور مسموحة!'
    });
  }
  
  // Handle other errors
  if (error) {
    console.error('Server Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'حدث خطأ في الخادم'
    });
  }
  
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Note: Authentication is now handled by the auth router
// Old in-memory authentication system has been replaced with MongoDB-based system

// Start server
app.listen(PORT, () => {
  console.log('🚀 Mawasiem Server is running!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoints available: /api/auth/login, /api/auth/register`);
});

// ... rest of the server code ...