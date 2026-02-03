import HomeSectionsVisibility from '../models/HomeSectionsVisibility.js';

export const getSettings = async (req, res) => {
  try {
    const settings = await HomeSectionsVisibility.getCurrentSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب إعدادات أقسام الرئيسية' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    const settings = await HomeSectionsVisibility.updateSettings(payload);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث إعدادات الأقسام' });
  }
};

export const upsertEntry = async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) {
      return res.status(400).json({ message: 'key is required' });
    }
    const settings = await HomeSectionsVisibility.upsertEntry(key, value);
    res.json({ success: true, key, value: Boolean(value), data: settings });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل ظهور القسم', error: error.message });
  }
};

export default { getSettings, updateSettings, upsertEntry };
