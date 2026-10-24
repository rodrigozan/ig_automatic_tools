import mongoose from "mongoose";
import { config } from "../config";

async function main() {
  await mongoose.connect(config.dbUriTest, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("banco de testes esvaziado");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
