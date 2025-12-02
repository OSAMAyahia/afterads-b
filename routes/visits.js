import express from 'express';
import VisitCounter from '../models/VisitCounter.js';

const router = express.Router();

// تم إزالة تخزين الزيارات الفردية بالكامل. نستخدم فقط عدّاد يومي بسيط.

// POST /api/visits/counter - زيادات يومية بدون تخزين IP
router.post('/counter', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path || typeof path !== 'string') {
      return res.status(400).json({ success: false, message: 'المسار (path) مطلوب كـ string' });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let doc = await VisitCounter.findOne({ path });
    if (!doc) {
      doc = new VisitCounter({ path, counts: [{ date: today, total: 1 }] });
      await doc.save();
      return res.status(201).json({ success: true, message: 'تم زيادة العداد', data: { path, date: today, total: 1 } });
    }

    const bucket = doc.counts.find((c) => c.date === today);
    if (bucket) {
      bucket.total += 1;
    } else {
      doc.counts.push({ date: today, total: 1 });
    }

    await doc.save();
    return res.status(200).json({ success: true, message: 'تم زيادة العداد', data: { path, date: today, total: bucket ? bucket.total : 1 } });
  } catch (error) {
    console.error('Error incrementing counter:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// GET /api/visits/counter - جلب الإجمالي وقائمة الأيام
router.get('/counter', async (req, res) => {
  try {
    const { path, from, to } = req.query;
    const fromDate = from ? new Date(from).toISOString().slice(0, 10) : null;
    const toDate = to ? new Date(to).toISOString().slice(0, 10) : null;

    // إذا تم تمرير path: نعرض عداد هذا المسار فقط
    if (path) {
      const doc = await VisitCounter.findOne({ path });
      const counts = (doc?.counts || []).filter((c) => {
        if (fromDate && c.date < fromDate) return false;
        if (toDate && c.date > toDate) return false;
        return true;
      });

      const total = counts.reduce((sum, c) => sum + c.total, 0);
      return res.json({ success: true, data: { path, total, daily: counts } });
    }

    // بدون path: إجمالي كل المسارات
    const all = await VisitCounter.find({}, { counts: 1, path: 1 });
    let total = 0;
    const dailyMap = new Map();

    for (const doc of all) {
      for (const c of doc.counts) {
        if (fromDate && c.date < fromDate) continue;
        if (toDate && c.date > toDate) continue;
        total += c.total;
        dailyMap.set(c.date, (dailyMap.get(c.date) || 0) + c.total);
      }
    }

    const daily = Array.from(dailyMap.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, total]) => ({ date, total }));

    return res.json({ success: true, data: { total, daily } });
  } catch (error) {
    console.error('Error fetching counters:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// PUT /api/visits/target - تعديل الهدف الشهري لمسار معين
router.put('/target', async (req, res) => {
  try {
    const { dashboardMonthlyTarget } = req.body;

    // ثابت دايمًا
    const path = 'admin/analisis';

    if (dashboardMonthlyTarget === undefined || typeof dashboardMonthlyTarget !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'dashboardMonthlyTarget يجب أن يكون رقم'
      });
    }

    // هنستخدم upsert لإنشاء المستند لو مش موجود
    const doc = await VisitCounter.findOneAndUpdate(
      { path },
      {
        path,
        dashboardMonthlyTarget,
        // لو بتستخدم counts ضروري نسيبها زي ما هي لو موجودة
      },
      {
        new: true,
        upsert: true // 👈 هنا الإنشاء التلقائي لو مش موجود
      }
    );

    return res.json({
      success: true,
      message: 'تم تحديث الهدف الشهري بنجاح (أو إنشاؤه إذا لم يكن موجودًا)',
      data: {
        path,
        dashboardMonthlyTarget: doc.dashboardMonthlyTarget
      }
    });

  } catch (error) {
    console.error('Error updating dashboardMonthlyTarget:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});


// GET /target - جلب الهدف الشهري لمسار admin/analisis
router.get('/target', async (req, res) => {
  try {
    const path = 'admin/analisis';

    const doc = await VisitCounter.findOne({ path });

    if (!doc) {
      // لو مفيش doc خالص → رجّع صفر
      return res.json({
        success: true,
        data: {
          path,
          dashboardMonthlyTarget: 0
        }
      });
    }

    return res.json({
      success: true,
      data: {
        path: doc.path,
        dashboardMonthlyTarget: doc.dashboardMonthlyTarget || 0
      }
    });

  } catch (error) {
    console.error('Error fetching dashboardMonthlyTarget:', error);
    return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});


export default router;