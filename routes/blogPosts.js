import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import BlogPost from '../models/BlogPost.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إعدادات Multer لحفظ الصور في الذاكرة مؤقتًا
const storage = multer.memoryStorage();
const upload = multer({ storage });

const handleBase64Image = (req, res, next) => {
  if (req.body.featuredImage && req.body.featuredImage.startsWith('data:image')) {
    const base64Data = req.body.featuredImage;
    const matches = base64Data.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
    if (matches) {
      const imageBuffer = Buffer.from(matches[2], 'base64');
      const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const filename = `blog-${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
      const filePath = path.join(__dirname, '../public/images/', filename);

      // التأكد من وجود المجلد
      const dir = path.join(__dirname, '../public/images/');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, imageBuffer);

      req.file = {
        filename: filename,
        path: filePath,
        originalname: `featured.${extension}`,
        mimetype: `image/${extension}`,
        size: imageBuffer.length
      };
    }
  }
  next();
};

const uploadImage = (req, res, next) => {
  if (!req.file) {
    // محاولة رفع ملف من multipart إذا لم يتم التعامل مع Base64
    upload.single('featuredImage')(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  } else {
    // إذا تم بالفعل تعيين req.file من Base64، نكمل التنفيذ
    next();
  }
};

const router = express.Router();

// Get all blog posts - simplified and fast
router.get('/', async (req, res) => {
  try {
    const { category, limit, page } = req.query;
    let query = {};
    
    // Simple category filter only
    if (category) {
      query.categories = category;
    }
    
    // Fast query with lean() for better performance
    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    
    const posts = await BlogPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    const total = await BlogPost.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      posts,
      total,
      page: pageNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    });
    
  } catch (error) {
    console.error('❌ Error fetching blog posts:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get blog post by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let post = null;
    
    console.log('📄 Fetching blog post by identifier:', identifier);
    
    // Try to find by ID first (if it's a number)
    if (!isNaN(identifier)) {
      post = await BlogPost.findOne({ id: parseInt(identifier) });
    }
    
    // If not found by ID, try by slug
    if (!post) {
      post = await BlogPost.findOne({ slug: identifier });
    }
    
    if (!post) {
      console.log('❌ Blog post not found:', identifier);
      return res.status(404).json({ 
        error: 'Blog post not found',
        message: `No blog post found with identifier: ${identifier}`
      });
    }
    
    console.log('✅ Blog post found:', post.title);
    res.json(post);
  } catch (error) {
    console.error('❌ Error fetching blog post:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get blog post by slug specifically
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    console.log('📄 Fetching blog post by slug:', slug);
    
    const post = await BlogPost.findOne({ slug: decodeURIComponent(slug) });
    
    if (!post) {
      console.log('❌ Blog post not found with slug:', slug);
      return res.status(404).json({ 
        error: 'Blog post not found',
        message: `No blog post found with slug: ${slug}`
      });
    }
    
    console.log('✅ Blog post found by slug:', post.title);
    res.json(post);
  } catch (error) {
    console.error('❌ Error fetching blog post by slug:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Upload blog image
router.post('/upload-image', uploadImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم رفع أي صورة' });
    }

    const imagePath = `/images/${req.file.filename}`;
    res.json({ 
      message: 'تم رفع الصورة بنجاح',
      imagePath,
      imageUrl: imagePath
    });
  } catch (error) {
    console.error('Error uploading blog image:', error);
    res.status(500).json({ message: 'فشل في رفع الصورة' });
  }
});

// Create new blog post
router.post('/', handleBase64Image, uploadImage, async (req, res) => {
  try {
    const { 
      title, slug, excerpt, content, author, categories,
      metaTitle, metaDescription, keywords, ogTitle, ogDescription, ogImage,
      twitterTitle, twitterDescription
    } = req.body;
    
    console.log('📝 Creating new blog post - Full body:', req.body);
    console.log('📝 Validation check:', { 
      title: !!title, 
      excerpt: !!excerpt, 
      content: !!content, 
      author: !!author,
      titleValue: title,
      excerptValue: excerpt,
      contentValue: content,
      authorValue: author
    });
    
    // Validate required fields
    let parsedContent = [];
    try {
      parsedContent = content ? (typeof content === 'string' ? JSON.parse(content) : content) : [];
    } catch (e) {
      return res.status(400).json({ 
        error: 'Invalid content format',
        message: 'Content must be a valid JSON array'
      });
    }

    if (!title || !excerpt || !Array.isArray(parsedContent) || parsedContent.length === 0 || !author) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Title, excerpt, content blocks, and author are required',
        received: { title, excerpt, content: parsedContent, author }
      });
    }
    
    // Handle slug - ensure it's unique or let the model generate one
    let finalSlug = slug;
    if (slug && slug.trim()) {
      // Check if provided slug already exists
      const existingPost = await BlogPost.findOne({ slug: slug.trim().toLowerCase() });
      if (existingPost) {
        console.log('⚠️ Slug already exists, will auto-generate:', slug);
        finalSlug = ''; // Let the model generate a unique one
      }
    }
    
    // Get the next ID
    const lastPost = await BlogPost.findOne().sort({ id: -1 });
    const nextId = lastPost ? lastPost.id + 1 : 1;
    
    // Handle image upload
    let featuredImage = '';
    let featuredImageFile = {};
    
    if (req.file) {
      featuredImage = `/images/${req.file.filename}`;
      featuredImageFile = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadDate: new Date()
      };
    }
    
    // Parse categories safely
    let parsedCategories = [];
    if (categories) {
      try {
        console.log('📋 Raw categories received:', categories);
        parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories;
        console.log('📋 Parsed categories:', parsedCategories);
      } catch (parseError) {
        console.error('❌ Error parsing categories:', parseError.message);
        console.error('❌ Raw categories value:', categories);
        return res.status(400).json({
          error: 'Invalid categories format',
          message: 'Categories must be valid JSON array',
          details: parseError.message
        });
      }
    }
    
    const newPost = new BlogPost({
      id: nextId,
      title,
      slug: finalSlug,
      excerpt,
      content: parsedContent,
      featuredImage,
      featuredImageFile,
      author,
      categories: parsedCategories,
      // SEO fields
      metaTitle,
      metaDescription,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      twitterTitle,
      twitterDescription
    });
    
    const savedPost = await newPost.save();
    console.log('✅ Blog post created successfully:', savedPost.title);
    
    res.status(201).json(savedPost);
  } catch (error) {
    console.error('❌ Error creating blog post:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid blog post data',
        details: validationErrors
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        error: 'Duplicate error',
        message: `Blog post with this ${field} already exists`
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update blog post
router.put('/:_id', handleBase64Image, uploadImage, async (req, res) => {
  try {
    const { _id } = req.params;
    const { 
      title, slug, excerpt, content, author, categories,
      metaTitle, metaDescription, keywords, ogTitle, ogDescription, ogImage,
      twitterTitle, twitterDescription
    } = req.body;
    
    console.log('📝 Updating blog post by _id:', _id);
    
    // Find existing post by _id
    const existingPost = await BlogPost.findById(_id);
    if (!existingPost) {
      return res.status(404).json({ 
        error: 'Blog post not found',
        message: `No blog post found with ID: ${_id}`
      });
    }
    
    // Parse categories safely
    let parsedCategories = existingPost.categories;
    if (categories) {
      try {
        console.log('📋 Raw categories received for update:', categories);
        parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories;
        console.log('📋 Parsed categories for update:', parsedCategories);
      } catch (parseError) {
        console.error('❌ Error parsing categories in update:', parseError.message);
        console.error('❌ Raw categories value:', categories);
        return res.status(400).json({
          error: 'Invalid categories format',
          message: 'Categories must be valid JSON array',
          details: parseError.message
        });
      }
    }
    
    // Handle slug for updates
    let finalSlug = slug || existingPost.slug;
    if (slug && slug.trim() && slug !== existingPost.slug) {
      const existingSlugPost = await BlogPost.findOne({ 
        slug: slug.trim().toLowerCase(),
        _id: { $ne: _id } // ⚡ استخدام _id بدلاً من id
      });
      if (existingSlugPost) {
        console.log('⚠️ Slug already exists during update, keeping original:', slug);
        finalSlug = existingPost.slug;
      }
    }
    
    // Prepare update data
    let parsedContentUpdate = existingPost.content;
    if (content !== undefined) {
      try {
        parsedContentUpdate = content ? (typeof content === 'string' ? JSON.parse(content) : content) : [];
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid content format',
          message: 'Content must be a valid JSON array'
        });
      }
    }

    const updateData = {
      title: title || existingPost.title,
      slug: finalSlug,
      excerpt: excerpt || existingPost.excerpt,
      content: parsedContentUpdate,
      author: author || existingPost.author,
      categories: parsedCategories,
      metaTitle: metaTitle !== undefined ? metaTitle : existingPost.metaTitle,
      metaDescription: metaDescription !== undefined ? metaDescription : existingPost.metaDescription,
      keywords: keywords !== undefined ? keywords : existingPost.keywords,
      ogTitle: ogTitle !== undefined ? ogTitle : existingPost.ogTitle,
      ogDescription: ogDescription !== undefined ? ogDescription : existingPost.ogDescription,
      ogImage: ogImage !== undefined ? ogImage : existingPost.ogImage,
      twitterTitle: twitterTitle !== undefined ? twitterTitle : existingPost.twitterTitle,
      twitterDescription: twitterDescription !== undefined ? twitterDescription : existingPost.twitterDescription
    };
    
    // Handle image upload if new file provided
    if (req.file) {
      updateData.featuredImage = `/images/${req.file.filename}`;
      updateData.featuredImageFile = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadDate: new Date()
      };
    }
    
    const updatedPost = await BlogPost.findByIdAndUpdate(
      _id, // ⚡ استخدام _id مباشرة
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Blog post updated successfully:', updatedPost.title);
    res.json(updatedPost);
  } catch (error) {
    console.error('❌ Error updating blog post:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid blog post data',
        details: validationErrors
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Delete blog post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting blog post:', id);
    
    const post = await BlogPost.findOneAndDelete({ _id: id });
    if (!post) {
      return res.status(404).json({ 
        error: 'Blog post not found',
        message: `No blog post found with ID: ${id}`
      });
    }
    
    console.log('✅ Blog post deleted successfully:', post.title);
    res.json({ 
      message: 'Blog post deleted successfully',
      deletedPost: post
    });
  } catch (error) {
    console.error('❌ Error deleting blog post:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;