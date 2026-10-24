import { createApp } from "./app";
import { config } from "./config";
import { connectDb } from "./db";

async function main() {
  await connectDb(config.dbUri);
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`ig-automatic-tools escutando em http://${config.host}:${config.port}`);
  });
}

main().catch((err) => {
  console.error("falha ao iniciar", err);
  process.exit(1);
});
