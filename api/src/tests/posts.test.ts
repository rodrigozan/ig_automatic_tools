import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, createMedia, stubIg, restoreIg } from "./helpers";
import { ScheduledPost } from "../models/ScheduledPost";
import { Notification } from "../models/Notification";
import { Media } from "../models/Media";
import { InstagramAccount } from "../models/InstagramAccount";
import { publishPost, recoverOnStartup, runPublisherTick, MAX_ATTEMPTS } from "../services/publisher";
import { IgApiError } from "../services/instagramApi";
import { limits } from "../config";

let srv: Awaited<ReturnType<typeof startServer>>;
const calls: { method: string; args: unknown[] }[] = [];

before(async () => {
  limits.containerPollMs = 1;
  await setupDb();
  srv = await startServer();
});

after(async () => {
  await srv.close();
  await teardownDb();
});

beforeEach(async () => {
  await clearDb();
  calls.length = 0;
  let n = 0;
  stubIg({
    createContainer: async (...args) => {
      calls.push({ method: "createContainer", args });
      return `c${++n}`;
    },
    containerStatus: async () => ({ statusCode: "FINISHED" }),
    publishContainer: async (...args) => {
      calls.push({ method: "publishContainer", args });
      return "m1";
    },
    permalink: async () => "https://instagram.com/p/abc",
  });
});

afterEach(restoreIg);

const inMinutes = (m: number, from = Date.now()) => new Date(from + m * 60000);

async function setup() {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const img = await createMedia(u._id, "image");
  const vid = await createMedia(u._id, "video");
  return { u, acc, img, vid, c: client(srv.url, sessionCookie(u.id)) };
}

test("validações: antecedência de 5 minutos, quantidade de mídias, tipo e legenda", async () => {
  const { acc, img, vid, c } = await setup();
  const base = { accountId: acc.id, type: "post", mediaIds: [img.id], caption: "oi", scheduledAt: inMinutes(10) };
  assert.equal((await c.post("/posts", { ...base, scheduledAt: inMinutes(4) })).body.fields.scheduledAt.includes("5 minutos"), true);
  assert.ok((await c.post("/posts", { ...base, mediaIds: [img.id, vid.id] })).body.fields.mediaIds);
  assert.ok((await c.post("/posts", { ...base, type: "carousel" })).body.fields.mediaIds);
  assert.ok((await c.post("/posts", { ...base, type: "reel" })).body.fields.mediaIds);
  assert.ok((await c.post("/posts", { ...base, caption: "x".repeat(2201) })).body.fields.caption);
  const ok = await c.post("/posts", base);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.status, "scheduled");
  const carousel = await c.post("/posts", { ...base, type: "carousel", mediaIds: [img.id, vid.id] });
  assert.equal(carousel.status, 201);
});

test("conta expirada ou de outra pessoa não agenda", async () => {
  const { u, img, c } = await setup();
  const expired = await createAccount(u._id, { status: "expired" });
  const r = await c.post("/posts", { accountId: expired.id, type: "post", mediaIds: [img.id], scheduledAt: inMinutes(10) });
  assert.match(r.body.fields.accountId, /Reconecte/);
  const other = await createUser();
  const otherAcc = await createAccount(other._id);
  const r2 = await c.post("/posts", { accountId: otherAcc.id, type: "post", mediaIds: [img.id], scheduledAt: inMinutes(10) });
  assert.ok(r2.body.fields.accountId);
});

test("editar e cancelar seguem a máquina de estados", async () => {
  const { acc, img, c } = await setup();
  const created = await c.post("/posts", { accountId: acc.id, type: "post", mediaIds: [img.id], scheduledAt: inMinutes(10) });
  const id = created.body.id;
  const edited = await c.patch(`/posts/${id}`, { caption: "nova" });
  assert.equal(edited.body.caption, "nova");
  await ScheduledPost.updateOne({ _id: id }, { status: "published" });
  assert.equal((await c.patch(`/posts/${id}`, { caption: "x" })).status, 409);
  assert.equal((await c.del(`/posts/${id}`)).status, 409);
  await ScheduledPost.updateOne({ _id: id }, { status: "failed", attempts: 3, lastError: "erro" });
  const resched = await c.patch(`/posts/${id}`, { scheduledAt: inMinutes(30) });
  assert.equal(resched.body.status, "scheduled");
  assert.equal(resched.body.attempts, 0);
  assert.equal((await c.del(`/posts/${id}`)).status, 204);
  assert.equal((await ScheduledPost.findById(id))?.status, "cancelled");
});

test("outro usuário não vê nem mexe na publicação", async () => {
  const { acc, img, c } = await setup();
  const created = await c.post("/posts", { accountId: acc.id, type: "post", mediaIds: [img.id], scheduledAt: inMinutes(10) });
  const other = client(srv.url, sessionCookie((await createUser()).id));
  assert.equal((await other.get(`/posts/${created.body.id}`)).status, 404);
  assert.equal((await other.del(`/posts/${created.body.id}`)).status, 404);
  assert.equal((await other.get("/posts")).body.length, 0);
});

test("agendador publica na hora, grava o resultado e apaga o arquivo", async () => {
  const { u, acc, img } = await setup();
  const post = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img._id], caption: "oi", scheduledAt: inMinutes(-1) });
  await runPublisherTick(new Date());
  const p = await ScheduledPost.findById(post._id);
  assert.equal(p?.status, "published");
  assert.equal(p?.igMediaId, "m1");
  assert.equal(p?.permalink, "https://instagram.com/p/abc");
  assert.ok(p?.publishedAt);
  assert.match(String(calls[0].args[2] && (calls[0].args[2] as { image_url: string }).image_url), /\/public\/media\//);
  assert.equal(fs.existsSync(img.storagePath), false);
  assert.ok((await Media.findById(img._id))?.deletedAt);
});

test("reel e carrossel criam os contêineres certos", async () => {
  const { u, acc, img, vid } = await setup();
  const reel = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "reel", mediaIds: [vid._id], scheduledAt: inMinutes(-1) });
  await publishPost(reel._id);
  assert.equal((calls[0].args[2] as Record<string, unknown>).media_type, "REELS");
  calls.length = 0;
  const img2 = await createMedia(u._id, "image");
  const car = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "carousel", mediaIds: [img._id, img2._id], scheduledAt: inMinutes(-1) });
  await publishPost(car._id);
  const containers = calls.filter((c) => c.method === "createContainer").map((c) => c.args[2] as Record<string, unknown>);
  assert.equal(containers.length, 3);
  assert.equal(containers[0].is_carousel_item, true);
  assert.equal(containers[2].media_type, "CAROUSEL");
  assert.equal(containers[2].children, "c2,c3");
});

test("falha: 3 tentativas com 5 minutos e depois failed com Aviso", async () => {
  const { u, acc, img } = await setup();
  stubIg({ createContainer: async () => { throw new IgApiError("mídia inválida"); } });
  const post = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img._id], scheduledAt: inMinutes(-1) });
  let now = new Date();
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    await runPublisherTick(now);
    const p = await ScheduledPost.findById(post._id);
    assert.equal(p?.attempts, i);
    if (i < MAX_ATTEMPTS) {
      assert.equal(p?.status, "scheduled");
      assert.equal(p!.nextAttemptAt!.getTime() - now.getTime(), 5 * 60000);
      await runPublisherTick(new Date(now.getTime() + 4 * 60000));
      assert.equal((await ScheduledPost.findById(post._id))?.attempts, i);
      now = new Date(now.getTime() + 5 * 60000);
    }
  }
  const p = await ScheduledPost.findById(post._id);
  assert.equal(p?.status, "failed");
  assert.equal(p?.lastError, "mídia inválida");
  const n = await Notification.find({ userId: u._id, type: "publish_failed" });
  assert.equal(n.length, 1);
  assert.equal(n[0].refId, post.id);
});

test("token inválido marca a conta como expirada", async () => {
  const { u, acc, img } = await setup();
  stubIg({ createContainer: async () => { throw new IgApiError("token", 190); } });
  const post = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img._id], scheduledAt: inMinutes(-1) });
  await publishPost(post._id);
  assert.equal((await InstagramAccount.findById(acc._id))?.status, "expired");
  assert.equal(await Notification.countDocuments({ type: "token_expiring" }), 1);
});

test("publicação espera a conversão terminar", async () => {
  const { u, acc } = await setup();
  const vid = await createMedia(u._id, "video", { conversionStatus: "converting" });
  const post = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "reel", mediaIds: [vid._id], scheduledAt: inMinutes(-1) });
  await runPublisherTick(new Date());
  assert.equal((await ScheduledPost.findById(post._id))?.status, "scheduled");
  await Media.updateOne({ _id: vid._id }, { conversionStatus: "done" });
  await runPublisherTick(new Date());
  assert.equal((await ScheduledPost.findById(post._id))?.status, "published");
});

test("no limite da Meta a publicação espera a janela, sem falhar; perto do limite gera Aviso", async () => {
  const { u, img } = await setup();
  const acc = await createAccount(u._id, { publishLimit: 5 });
  for (let i = 0; i < 4; i++) {
    const m = await createMedia(u._id);
    await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: inMinutes(-60), status: "published", publishedAt: inMinutes(-60 + i) });
  }
  const p1 = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img._id], scheduledAt: inMinutes(-1) });
  await runPublisherTick(new Date());
  assert.equal((await ScheduledPost.findById(p1._id))?.status, "published");
  assert.equal(await Notification.countDocuments({ type: "limit_near" }), 1);
  const m2 = await createMedia(u._id);
  const p2 = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m2._id], scheduledAt: inMinutes(-1) });
  await runPublisherTick(new Date());
  const waiting = await ScheduledPost.findById(p2._id);
  assert.equal(waiting?.status, "scheduled");
  assert.equal(waiting?.attempts, 0);
  assert.ok(waiting!.nextAttemptAt! > new Date());
});

test("reinício: 59 minutos de atraso publica, 61 minutos falha com Aviso", async () => {
  const { u, acc, img } = await setup();
  const img2 = await createMedia(u._id);
  const now = new Date();
  const ok = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img._id], scheduledAt: inMinutes(-59, now.getTime()) });
  const late = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [img2._id], scheduledAt: inMinutes(-61, now.getTime()) });
  await recoverOnStartup(now);
  assert.equal((await ScheduledPost.findById(ok._id))?.status, "published");
  const l = await ScheduledPost.findById(late._id);
  assert.equal(l?.status, "failed");
  assert.match(l!.lastError!, /Atrasada/);
  assert.equal(await Notification.countDocuments({ type: "publish_failed", refId: late.id }), 1);
});

test("avisos: listar, marcar como lido e apagar só os próprios", async () => {
  const { u, c } = await setup();
  const n = await Notification.create({ userId: u._id, type: "publish_failed", message: "falhou" });
  const other = await createUser();
  const n2 = await Notification.create({ userId: other._id, type: "publish_failed", message: "x" });
  assert.equal((await c.get("/notifications")).body.length, 1);
  const read = await c.patch(`/notifications/${n.id}/read`);
  assert.ok(read.body.readAt);
  assert.equal((await c.del(`/notifications/${n2.id}`)).status, 404);
  assert.equal((await c.del(`/notifications/${n.id}`)).status, 204);
});
