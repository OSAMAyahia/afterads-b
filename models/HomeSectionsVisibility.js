import mongoose from 'mongoose';

const homeSectionsVisibilitySchema = new mongoose.Schema({
  id: { type: Number, default: 1, unique: true },
  sections: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });

homeSectionsVisibilitySchema.statics.getCurrentSettings = async function() {
  let doc = await this.findOne({ id: 1 });
  if (!doc) {
    doc = await this.create({ id: 1 });
  }
  return doc;
};

homeSectionsVisibilitySchema.statics.updateSettings = async function(payload = {}) {
  const update = {};
  if (payload.sections && typeof payload.sections === 'object') {
    update.sections = payload.sections;
  }
  const doc = await this.findOneAndUpdate(
    { id: 1 },
    { $set: update },
    { new: true, upsert: true }
  );
  return doc;
};

homeSectionsVisibilitySchema.statics.upsertEntry = async function(key, value) {
  if (typeof key !== 'string') {
    throw new Error('Invalid key');
  }
  const doc = await this.findOne({ id: 1 }) || await this.create({ id: 1 });
  const map = doc.sections;
  if (map instanceof Map) {
    map.set(key, Boolean(value));
  } else {
    doc.sections = new Map(Object.entries({ ...(doc.sections || {}), [key]: Boolean(value) }));
  }
  await doc.save();
  return doc;
};

const HomeSectionsVisibility = mongoose.model('HomeSectionsVisibility', homeSectionsVisibilitySchema);

export default HomeSectionsVisibility;
