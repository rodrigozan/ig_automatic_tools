import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const env = process.env;

export const config = {
  env: env.NODE_ENV || "development",
  port: Number(env.PORT || 3930),
  host: env.HOST || "127.0.0.1",
  publicBaseUrl: (env.PUBLIC_BASE_URL || "http://127.0.0.1:3930/ig").replace(/\/$/, ""),
  dbUri: env.DB_URI || "",
  dbUriTest: env.DB_URI_TEST || "mongodb://127.0.0.1:27017/ig-automatic-tools-test",
  jwtSecret: env.JWT_SECRET || "",
  tokenEncKey: env.TOKEN_ENC_KEY || "",
  adminEmail: (env.ADMIN_EMAIL || "").toLowerCase(),
  // Token de agente do PhanterClaw (escopo instagram:publish). Sem o segredo, a rota por agente fica desligada.
  agentJwtSecret: env.PHANTERCLAW_IG_JWT_SECRET || "",
  agentIds: (env.IG_AGENT_IDS || "gladiador-dourado").split(",").map((id) => id.trim()).filter(Boolean),
  agentUserEmail: (env.IG_AGENT_USER_EMAIL || env.ADMIN_EMAIL || "").toLowerCase(),
  // Token da prospecção (Harvey/phanter_scrapper) para consultar perfis: escopo instagram:analyze, segredo próprio.
  analysisJwtSecret: env.IG_ANALYSIS_JWT_SECRET || "",
  analysisAgentIds: (env.IG_ANALYSIS_AGENT_IDS || "phanter-scrapper").split(",").map((id) => id.trim()).filter(Boolean),
  googleClientId: env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || "",
  facebookAppId: env.FACEBOOK_APP_ID || "",
  facebookAppSecret: env.FACEBOOK_APP_SECRET || "",
  instagramAppId: env.INSTAGRAM_APP_ID || "",
  instagramAppSecret: env.INSTAGRAM_APP_SECRET || "",
  metaWebhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN || "",
  mediaDir: path.resolve(env.MEDIA_DIR || path.resolve(__dirname, "..", "media")),
  webDist: path.resolve(__dirname, "..", "..", "web", "dist"),
};

export const isProduction = config.env === "production";

export const limits = {
  publishPer24h: Number(env.IG_PUBLISH_LIMIT_24H || 50),
  privateRepliesPerHour: Number(env.DM_PRIVATE_REPLY_LIMIT_HOUR || 750),
  nearRatio: 0.8,
  firstStepButtons: env.DM_FIRST_STEP_BUTTONS === "true",
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 1024),
  containerPollMs: Number(env.IG_CONTAINER_POLL_MS || 5000),
  containerPollMax: Number(env.IG_CONTAINER_POLL_MAX || 120),
};
