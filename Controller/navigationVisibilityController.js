import NavigationVisibility from '../models/NavigationVisibility.js';
import mongoose from 'mongoose';

export const getSettings = async (req, res) => {
  try {
    const settings = await NavigationVisibility.getCurrentSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب إعدادات الظهور' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = await NavigationVisibility.updateSettings(payload);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث إعدادات الظهور' });
  }
};

export const upsertEntry = async (req, res) => {
  try {
    const { section, key, value } = req.body || {};
    if (!section || !key) {
      return res.status(400).json({ message: 'section and key are required' });
    }
    const settings = await NavigationVisibility.upsertEntry(section, key, value);
    res.json({ success: true, section, key, value: Boolean(value), data: settings });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل عنصر الظهور', error: error.message });
  }
};

export default { getSettings, updateSettings, upsertEntry };
