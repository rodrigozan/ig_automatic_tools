import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import mongoose from "mongoose";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, createMedia, stubIg, restoreIg } from "./helpers";
import { ScheduledPost } from "../models/ScheduledPost";
import { Notification } from "../models/Notification";
import { WebhookEvent } from "../models/WebhookEvent";
import { Media } from "../models/Media";
import { DmAutomation } from "../models/DmAutomation";
import { DmConversation } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";
import { InstagramAccount } from "../models/InstagramAccount";
import { User } from "../models/User";
import { Batch } from "../models/Batch";
import { cleanupNotifications } from "../services/cleanup";
import { publishPost } from "../services/publisher";

let srv: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await setupDb();
  srv = await startServer();
});

after(async () => {
  restoreIg();
  await srv.close();
  await teardownDb();
});

beforeEach(clearDb);

async function fill(userId: mongoose.Types.ObjectId) {
  const acc = await createAccount(userId);
  const m = await createMedia(userId);
  await ScheduledPost.create({ userId, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date(Date.now() + 3600000) });
  await ScheduledPost.create({ userId, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date(), status: "published" });
  const steps = [{ id: "s1", text: "segredo da DM", buttons: [] }];
  const a = await DmAutomation.create({ userId, accountId: acc._id, name: "A", target: "any_post", keywords: ["x"], startStepId: "s1", steps });
  const c = await DmConversation.create({ userId, accountId: acc._id, automationId: a._id, igScopedUserId: "f1", currentStepId: "s1", windowExpiresAt: new Date(), flow: { startStepId: "s1", steps } });
  await DmMessage.create({ conversationId: c._id, userId, direction: "out", text: "segredo da DM", textExpiresAt: new Date(Date.now() + 1e9), status: "sent" });
  await Notification.create({ userId, type: "publish_failed", message: "x" });
  await Batch.create({ userId, accountId: acc._id, mode: "daily", times: ["10:00"], startDate: new Date(), status: "scheduled", totalItems: 0 });
  return { acc, m };
}

test("admin vê contagens por usuário e nunca o texto das DMs", async () => {
  const admin = await createUser({ role: "admin" });
  const u = await createUser();
  await fill(u._id);
  const r = await client(srv.url, sessionCookie(admin.id)).get("/admin/users");
  const row = r.body.find((x: { id: string }) => x.id === u.id);
  assert.deepEqual(row.counts, { accounts: 1, posts: 2, published: 1, automations: 1, conversations: 1 });
  assert.ok(!JSON.stringify(r.body).includes("segredo da DM"));
});

test("excluir a conta apaga tokens, mídia, conversas e tudo do usuário", async () => {
  const u = await createUser();
  const other = await createUser();
  const { m } = await fill(u._id);
  await fill(other._id);
  const unsub: string[] = [];
  stubIg({ unsubscribeWebhooks: async (id) => void unsub.push(id) });
  const r = await client(srv.url, sessionCookie(u.id)).del("/users/me");
  assert.equal(r.status, 204);
  assert.equal(fs.existsSync(m.storagePath), false);
  for (const model of [ScheduledPost, Media, DmAutomation, DmConversation, DmMessage, Notification, InstagramAccount, Batch] as mongoose.Model<any>[]) {
    assert.equal(await model.countDocuments({ userId: u._id }), 0, model.modelName);
    assert.ok((await model.countDocuments({ userId: other._id })) > 0, model.modelName);
  }
  assert.equal(await User.countDocuments({ _id: u._id }), 0);
  assert.equal(unsub.length, 1);
  assert.equal((await client(srv.url, sessionCookie(u.id)).get("/auth/me")).status, 401);
});

test("aviso é apagado 30 dias depois de lido; não lido fica", async () => {
  const u = await createUser();
  const now = new Date();
  await Notification.create({ userId: u._id, type: "publish_failed", message: "velho", readAt: new Date(now.getTime() - 31 * 86400000) });
  await Notification.create({ userId: u._id, type: "publish_failed", message: "recente", readAt: new Date(now.getTime() - 29 * 86400000) });
  await Notification.create({ userId: u._id, type: "publish_failed", message: "não lido" });
  await cleanupNotifications(now);
  const left = (await Notification.find()).map((n) => n.message).sort();
  assert.deepEqual(left, ["não lido", "recente"]);
});

test("evento de webhook expira em 30 dias pelo índice TTL", async () => {
  const idx = await WebhookEvent.collection.indexes();
  const ttl = idx.find((i) => i.key.receivedAt === 1);
  assert.equal(ttl?.expireAfterSeconds, 30 * 24 * 60 * 60);
});

test("mídia publicada perde o arquivo e fica com deletedAt", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const m = await createMedia(u._id);
  stubIg({
    createContainer: async () => "c1",
    containerStatus: async () => ({ statusCode: "FINISHED" }),
    publishContainer: async () => "m1",
    permalink: async () => undefined,
  });
  const p = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date() });
  await publishPost(p._id);
  const after = await Media.findById(m._id);
  assert.ok(after?.deletedAt);
  assert.equal(fs.existsSync(m.storagePath), false);
  assert.equal((await fetch(`${srv.url}/ig/public/media/${m.publicToken}`)).status, 404);
  restoreIg();
});

test("dados do painel", async () => {
  const u = await createUser();
  await fill(u._id);
  await createAccount(u._id, { status: "expired", username: "b" });
  const r = await client(srv.url, sessionCookie(u.id)).get("/dashboard");
  assert.equal(r.status, 200);
  assert.equal(r.body.stats.next24h, 1);
  assert.equal(r.body.stats.connectedAccounts, 1);
  assert.equal(r.body.stats.accountsNeedingReconnect, 1);
  assert.equal(r.body.stats.unreadNotifications, 1);
  assert.equal(r.body.upcoming.length, 1);
});
