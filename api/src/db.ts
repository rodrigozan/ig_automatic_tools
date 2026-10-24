import mongoose from "mongoose";

export async function connectDb(uri: string) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
