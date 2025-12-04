import mongoose from 'mongoose';

const navigationVisibilitySchema = new mongoose.Schema({
  id: { type: Number, default: 1, unique: true },
  navbar: { type: Map, of: Boolean, default: {} },
  footerImportant: { type: Map, of: Boolean, default: {} },
  footerQuick: { type: Map, of: Boolean, default: {} },
  footerStaticPages: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });

navigationVisibilitySchema.statics.getCurrentSettings = async function() {
  let doc = await this.findOne({ id: 1 });
  if (!doc) {
    doc = await this.create({ id: 1 });
  }
  return doc;
};

navigationVisibilitySchema.statics.updateSettings = async function(payload = {}) {
  const allowed = ['navbar', 'footerImportant', 'footerQuick', 'footerStaticPages'];
  const update = {};
  for (const key of allowed) {
    if (payload[key] && typeof payload[key] === 'object') {
      update[key] = payload[key];
    }
  }
  const doc = await this.findOneAndUpdate(
    { id: 1 },
    { $set: update },
    { new: true, upsert: true }
  );
  return doc;
};

navigationVisibilitySchema.statics.upsertEntry = async function(section, key, value) {
  const allowed = ['navbar', 'footerImportant', 'footerQuick', 'footerStaticPages'];
  if (!allowed.includes(section)) {
    throw new Error('Invalid section');
  }
  if (typeof key !== 'string') {
    throw new Error('Invalid key');
  }
  const doc = await this.findOne({ id: 1 }) || await this.create({ id: 1 });
  const map = doc[section];
  if (map instanceof Map) {
    map.set(key, Boolean(value));
  } else {
    doc[section] = new Map(Object.entries({ ...(doc[section] || {}), [key]: Boolean(value) }));
  }
  await doc.save();
  return doc;
};

const NavigationVisibility = mongoose.model('NavigationVisibility', navigationVisibilitySchema);

export default NavigationVisibility;
