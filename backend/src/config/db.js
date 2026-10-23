import mongoose from 'mongoose';

export function resolveMongoUri(env = process.env) {
  return env.MONGODB_URI || env.MONGO_URI || 'mongodb://127.0.0.1:27017/test';
}

async function connectDB() {
  await mongoose.connect(resolveMongoUri());
  console.log('MongoDB conectado');
}

export default connectDB;
