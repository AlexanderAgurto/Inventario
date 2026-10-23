import mongoose from 'mongoose';

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
  await mongoose.connect(uri);
  console.log('MongoDB conectado');
}

export default connectDB;
