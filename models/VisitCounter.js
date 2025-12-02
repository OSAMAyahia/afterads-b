import mongoose from 'mongoose';

// Aggregated counter per path with daily buckets
const visitCounterSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  counts: [
    {
      date: { type: String, required: true }, // YYYY-MM-DD
      total: { type: Number, default: 0 }
    }
  ],
    dashboardMonthlyTarget: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true
});

// Index for efficient lookups by path
visitCounterSchema.index({ path: 1 });

const VisitCounter = mongoose.model('VisitCounter', visitCounterSchema);

export default VisitCounter;