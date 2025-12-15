import express from 'express';
import AdminPin from '../models/AdminPin.js';
import { authenticateToken } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLogger.js';
 
const router = express.Router();

// الحصول على رمز PIN الحالي (للتحقق)
router.get('/current', authenticateToken, async (req, res) => {
  try {
    // التحقق من أن المستخدم admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المنتج'
      });
    }

    const pinRecord = await AdminPin.getCurrentPin();
    
    if (!pinRecord) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على رمز PIN'
      });
    }
    
    res.json({
      success: true,
      data: {
        hasPin: true,
        lastUpdated: pinRecord.lastUpdated,
        updatedBy: pinRecord.updatedBy
      }
    });
  } catch (error) {
    console.error('Error fetching current PIN:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء جلب رمز PIN'
    });
  }
});

// التحقق من صحة رمز PIN
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;

    // التحقق من أن المستخدم admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المنتج'
      });
    }

    // التحقق من وجود PIN
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'رمز PIN يجب أن يكون 4 أرقام'
      });
    }

    const pinRecord = await AdminPin.getCurrentPin();
    
    if (!pinRecord) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على رمز PIN في النظام'
      });
    }
    
    const isValid = await pinRecord.comparePin(pin);

    if (isValid) {
      // تسجيل نشاط التحقق الناجح
      await logActivity(
        req.user.id,
        req.user.name,
        req.user.role,
        'pin_verification',
        null,
        null,
        'تم التحقق من رمز PIN بنجاح',
        null,
        null,
        req
      );

      res.json({
        success: true,
        message: 'تم التحقق من رمز PIN بنجاح'
      });
    } else {
      // تسجيل نشاط التحقق الفاشل
      await logActivity(
        req.user.id,
        req.user.name,
        req.user.role,
        'pin_verification_failed',
        null,
        null,
        'فشل في التحقق من رمز PIN',
        null,
        null,
        req
      );

      res.status(401).json({
        success: false,
        message: 'رمز PIN غير صحيح'
      });
    }
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء التحقق من رمز PIN'
    });
  }
});

// تحديث رمز PIN
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;

    // التحقق من أن المستخدم admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المنتج'
      });
    }

    // التحقق من صحة البيانات
    if (!currentPin || !newPin) {
      return res.status(400).json({
        success: false,
        message: 'رمز PIN الحالي والجديد مطلوبان'
      });
    }

    if (currentPin.length !== 4 || newPin.length !== 4 || 
        !/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'رمز PIN يجب أن يكون 4 أرقام'
      });
    }

    // التحقق من رمز PIN الحالي
    const pinRecord = await AdminPin.getCurrentPin();
    
    if (!pinRecord) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على رمز PIN في النظام'
      });
    }
    
    const isCurrentPinValid = await pinRecord.comparePin(currentPin);

    if (!isCurrentPinValid) {
      // تسجيل محاولة تغيير فاشلة
      await logActivity(
        req.user.id,
        req.user.name,
        req.user.role,
        'pin_change_failed',
        null,
        null,
        'فشل في تغيير رمز PIN - رمز PIN الحالي غير صحيح',
        null,
        null,
        req
      );

      return res.status(401).json({
        success: false,
        message: 'رمز PIN الحالي غير صحيح'
      });
    }

    // تحديث رمز PIN
    await AdminPin.createOrUpdatePin(newPin, req.user.name);

    // تسجيل نشاط التغيير الناجح
    await logActivity(
      req.user.id,
      req.user.name,
      req.user.role,
      'pin_changed',
      null,
      null,
      'تم تغيير رمز PIN بنجاح',
      'رمز PIN قديم',
      'رمز PIN جديد',
      req
    );

    res.json({
      success: true,
      message: 'تم تغيير رمز PIN بنجاح'
    });
  } catch (error) {
    console.error('Error updating PIN:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تحديث رمز PIN'
    });
  }
});

// تحديث رمز PIN (PUT method للتوافق مع الفرونت إند)
router.put('/update', authenticateToken, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;

    // التحقق من أن المستخدم admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بالوصول لهذه المنتج'
      });
    }

    // التحقق من صحة البيانات
    if (!currentPin || !newPin) {
      return res.status(400).json({
        success: false,
        message: 'رمز PIN الحالي والجديد مطلوبان'
      });
    }

    if (currentPin.length !== 4 || newPin.length !== 4 || 
        !/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'رمز PIN يجب أن يكون 4 أرقام'
      });
    }

    // التحقق من رمز PIN الحالي
    const pinRecord = await AdminPin.getCurrentPin();
    
    if (!pinRecord) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على رمز PIN في النظام'
      });
    }
    
    const isCurrentPinValid = await pinRecord.comparePin(currentPin);

    if (!isCurrentPinValid) {
      // تسجيل محاولة تغيير فاشلة
      await logActivity(
        req.user.id,
        req.user.name,
        req.user.role,
        'pin_change_failed',
        null,
        null,
        'فشل في تغيير رمز PIN - رمز PIN الحالي غير صحيح',
        null,
        null,
        req
      );

      return res.status(401).json({
        success: false,
        message: 'رمز PIN الحالي غير صحيح'
      });
    }

    // تحديث رمز PIN
    await AdminPin.createOrUpdatePin(newPin, req.user.name);

    // تسجيل نشاط التغيير الناجح
    await logActivity(
      req.user.id,
      req.user.name,
      req.user.role,
      'pin_changed',
      null,
      null,
      'تم تغيير رمز PIN بنجاح',
      'رمز PIN قديم',
      'رمز PIN جديد',
      req
    );

    res.json({
      success: true,
      message: 'تم تغيير رمز PIN بنجاح'
    });
  } catch (error) {
    console.error('Error updating PIN:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تحديث رمز PIN'
    });
  }
});

export default router;