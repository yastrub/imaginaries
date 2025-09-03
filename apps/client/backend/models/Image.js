import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  prompt: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  watermarkedUrl: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Add compound index for efficient queries
imageSchema.index({ userId: 1, createdAt: -1 });

export const Image = mongoose.model('Image', imageSchema);