import mongoose from "mongoose";
import { config } from "../config";
import { ScheduledPost } from "../models/ScheduledPost";

async function main() {
  await mongoose.connect(config.dbUri, { serverSelectionTimeoutMS: 5000 });
  const r = await ScheduledPost.updateMany({ status: { $in: ["draft", "scheduled"] } }, { $set: { status: "cancelled" } });
  console.log(`${r.modifiedCount} publicações pendentes canceladas`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
