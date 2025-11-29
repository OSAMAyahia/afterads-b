import express from 'express';
import Documentation from '../models/Documentation.js';

const router = express.Router();

// =====================================
// MAIN CLASSIFICATION ROUTES
// =====================================

// GET /api/documentations - Get all main classifications
router.get('/', async (req, res) => {
  try {
    const { search, limit, page } = req.query;
    let docs;
    
    if (search) {
      docs = await Documentation.searchByText(search);
    } else {
      docs = await Documentation.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    }
    
    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    const total = docs.length;
    const paginatedDocs = docs.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      docs: paginatedDocs,
      total,
      page: pageNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/documentations/structure - Get full navigation structure
router.get('/structure', async (req, res) => {
  try {
    const structure = await Documentation.getAllStructure();
    
    res.json({
      navigation: structure.map(mainClass => ({
        id: mainClass.id,
        title: mainClass.title,
        slug: mainClass.slug,
        icon: mainClass.icon,
        description: mainClass.description,
        color: mainClass.color,
        order: mainClass.order,
        isActive: mainClass.isActive,
        categories: mainClass.categories.map(cat => ({
          id: cat.id,
          title: cat.title,
          slug: cat.slug,
          icon: cat.icon,
          description: cat.description,
          order: cat.order,
          mainClassificationId: cat.mainClassificationId,
          isActive: cat.isActive,
          classifications: cat.classifications?.map(classification => ({
            id: classification.id,
            title: classification.title,
            slug: classification.slug,
            icon: classification.icon,
            order: classification.order
          })) || [],
          documentations: cat.documentations.map(doc => ({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            icon: doc.icon,
            description: doc.description,
            order: doc.order,
            classificationId: doc.classificationId,
            content: doc.content,
            metadata: doc.metadata
          })).sort((a, b) => a.order - b.order),
          metadata: cat.metadata
        })).sort((a, b) => a.order - b.order),
        metadata: mainClass.metadata,
        createdAt: mainClass.createdAt,
        updatedAt: mainClass.updatedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// GET /api/documentations/main/:mainId - Get main classification by ID or slug
router.get('/main/:mainId', async (req, res) => {
  try {
    const { mainId } = req.params;
    
    let mainClass = await Documentation.findOne({ id: mainId, isActive: true });
    
    if (!mainClass) {
      mainClass = await Documentation.findBySlug(mainId);
    }
    
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId, isActive: true });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    res.json(mainClass);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// POST /api/documentations/main - Create new main classification
router.post('/main', async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    
    if (data.slug) {
      const existing = await Documentation.findOne({ slug: data.slug });
      if (existing) {
        return res.status(400).json({ error: 'A main classification with this slug already exists' });
      }
    }
    
    const newMainClass = new Documentation({
      ...data,
      isActive: data.isActive !== undefined ? data.isActive : true,
      categories: data.categories || []
    });
    
    const saved = await newMainClass.save();
    res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `A main classification with this ${field} already exists` });
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/documentations/main/:mainId - Update main classification
router.put('/main/:mainId', async (req, res) => {
  try {
    const { mainId } = req.params;
    const data = req.body;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    if (data.slug && data.slug !== mainClass.slug) {
      const existing = await Documentation.findOne({ slug: data.slug });
      if (existing) {
        return res.status(400).json({ error: 'A main classification with this slug already exists' });
      }
    }
    
    Object.assign(mainClass, data);
    const updated = await mainClass.save();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/documentations/main/:mainId - Delete main classification
router.delete('/main/:mainId', async (req, res) => {
  try {
    const { mainId } = req.params;
    
    let mainClass = await Documentation.findOneAndDelete({ id: mainId });
    
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOneAndDelete({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    res.json({ message: 'Main classification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// =====================================
// CATEGORY ROUTES (داخل Main Classification)
// =====================================

// POST /api/documentations/main/:mainId/categories - Add category to main classification
router.post('/main/:mainId/categories', async (req, res) => {
  try {
    const { mainId } = req.params;
    const categoryData = req.body;
    
    if (!categoryData.title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    if (!mainClass.categories) {
      mainClass.categories = [];
    }
    
    if (categoryData.slug) {
      const exists = mainClass.categories.some(c => c.slug === categoryData.slug);
      if (exists) {
        return res.status(400).json({ error: 'A category with this slug already exists' });
      }
    }
    
    mainClass.categories.push({
      ...categoryData,
      mainClassificationId: mainId,
      classifications: categoryData.classifications || [],
      documentations: categoryData.documentations || []
    });
    
    const updated = await mainClass.save();
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/documentations/main/:mainId/categories/:categoryId - Update category
router.put('/main/:mainId/categories/:categoryId', async (req, res) => {
  try {
    const { mainId, categoryId } = req.params;
    const data = req.body;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    if (data.slug && data.slug !== category.slug) {
      const exists = mainClass.categories.some(c => c.slug === data.slug && c.id !== categoryId);
      if (exists) {
        return res.status(400).json({ error: 'A category with this slug already exists' });
      }
    }
    
    Object.assign(category, data);
    const updated = await mainClass.save();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/documentations/main/:mainId/categories/:categoryId - Delete category
router.delete('/main/:mainId/categories/:categoryId', async (req, res) => {
  try {
    const { mainId, categoryId } = req.params;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const initialLength = mainClass.categories?.length || 0;
    mainClass.categories = (mainClass.categories || []).filter(c => c.id !== categoryId);
    
    if (mainClass.categories.length === initialLength) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await mainClass.save();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// =====================================
// CLASSIFICATION ROUTES
// =====================================

// POST /api/documentations/main/:mainId/categories/:categoryId/classifications
router.post('/main/:mainId/categories/:categoryId/classifications', async (req, res) => {
  try {
    const { mainId, categoryId } = req.params;
    const classificationData = req.body;
    
    if (!classificationData.title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    if (!category.classifications) {
      category.classifications = [];
    }
    
    category.classifications.push(classificationData);
    const updated = await mainClass.save();
    
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/documentations/main/:mainId/categories/:categoryId/classifications/:classificationId
router.put('/main/:mainId/categories/:categoryId/classifications/:classificationId', async (req, res) => {
  try {
    const { mainId, categoryId, classificationId } = req.params;
    const data = req.body;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const classification = category.classifications?.find(cls => cls.id === classificationId);
    if (!classification) {
      return res.status(404).json({ error: 'Classification not found' });
    }
    
    if (data.slug && data.slug !== classification.slug) {
      const exists = category.classifications.some(cls => cls.slug === data.slug && cls.id !== classificationId);
      if (exists) {
        return res.status(400).json({ error: 'A classification with this slug already exists' });
      }
    }
    
    Object.assign(classification, data);
    const updated = await mainClass.save();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/documentations/main/:mainId/categories/:categoryId/classifications/:classificationId
router.delete('/main/:mainId/categories/:categoryId/classifications/:classificationId', async (req, res) => {
  try {
    const { mainId, categoryId, classificationId } = req.params;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const initialLength = category.classifications?.length || 0;
    category.classifications = (category.classifications || []).filter(cls => cls.id !== classificationId);
    
    if (category.classifications.length === initialLength) {
      return res.status(404).json({ error: 'Classification not found' });
    }
    
    await mainClass.save();
    res.json({ message: 'Classification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// =====================================
// DOCUMENTATION ROUTES
// =====================================

// POST /api/documentations/main/:mainId/categories/:categoryId/documentations
router.post('/main/:mainId/categories/:categoryId/documentations', async (req, res) => {
  try {
    const { mainId, categoryId } = req.params;
    const docData = req.body;
    
    if (!docData.title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    category.documentations.push({
      ...docData,
      content: docData.content || []
    });
    const updated = await mainClass.save();
    
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// PUT /api/documentations/main/:mainId/categories/:categoryId/documentations/:docId - Update documentation
router.put('/main/:mainId/categories/:categoryId/documentations/:docId', async (req, res) => {
  try {
    const { mainId, categoryId, docId } = req.params;
    const data = req.body;

    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    if (!mainClass && typeof Documentation.findBySlug === 'function') {
      mainClass = await Documentation.findBySlug(mainId);
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }

    const category = (mainClass.categories || []).find(c => c.id === categoryId || c.slug === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const doc = (category.documentations || []).find(d => d.id === docId || d.slug === docId);
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    if (data.slug && data.slug !== doc.slug) {
      const exists = (category.documentations || []).some(d => d.slug === data.slug && d.id !== doc.id);
      if (exists) {
        return res.status(400).json({ error: 'A documentation with this slug already exists' });
      }
    }

    if (data.content !== undefined) {
      doc.content = data.content || [];
      delete data.content;
    }

    Object.assign(doc, data);
    const updated = await mainClass.save();

    const updatedCategory = (updated.categories || []).find(c => c.id === category.id);
    const updatedDoc = (updatedCategory?.documentations || []).find(d => d.id === doc.id || d.slug === doc.slug);

    res.json(updatedDoc || doc);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/documentations/main/:mainId/categories/:categoryId/documentations/:docId
router.delete('/main/:mainId/categories/:categoryId/documentations/:docId', async (req, res) => {
  try {
    const { mainId, categoryId, docId } = req.params;
    
    let mainClass = await Documentation.findOne({ id: mainId });
    if (!mainClass && mainId.match(/^[0-9a-fA-F]{24}$/)) {
      mainClass = await Documentation.findOne({ _id: mainId });
    }
    
    if (!mainClass) {
      return res.status(404).json({ error: 'Main classification not found' });
    }
    
    const category = mainClass.categories?.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const initialLength = category.documentations?.length || 0;
    category.documentations = (category.documentations || []).filter(doc => doc.id !== docId);
    
    if (category.documentations.length === initialLength) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    await mainClass.save();
    res.json({ message: 'Documentation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export default router;