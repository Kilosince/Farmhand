import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  accessType: {
    type: String,
    enum: ['private', 'public-read'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', fileSchema);

export default File;
