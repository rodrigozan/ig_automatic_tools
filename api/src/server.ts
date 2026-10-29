import { createApp } from "./app";
import { config } from "./config";
import { connectDb } from "./db";
import { startScheduler } from "./services/scheduler";

function checkConfig() {
  const missing = [
    ["DB_URI", config.dbUri],
    ["JWT_SECRET", config.jwtSecret],
    ["TOKEN_ENC_KEY", config.tokenEncKey],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`variáveis ausentes no api/.env: ${missing.join(", ")}`);
  if (Buffer.from(config.tokenEncKey, "base64").length !== 32) throw new Error("TOKEN_ENC_KEY precisa ter 32 bytes em base64");
}

async function main() {
  checkConfig();
  await connectDb(config.dbUri);
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`${config.appName} escutando em http://${config.host}:${config.port}`);
  });
  await startScheduler();
}

main().catch((err) => {
  console.error("falha ao iniciar", err);
  process.exit(1);
});
