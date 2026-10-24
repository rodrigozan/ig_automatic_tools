import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, upload, jpgFixture, pngFixture, mp4Fixture, aviFixture, createMedia, createAccount } from "./helpers";
import { Media } from "../models/Media";
import { ScheduledPost } from "../models/ScheduledPost";
import { mediaQueueIdle, probe } from "../services/mediaProcessing";
import { cleanupMedia } from "../services/cleanup";

let srv: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await setupDb();
  srv = await startServer();
});

after(async () => {
  await srv.close();
  await teardownDb();
});

beforeEach(clearDb);

test("JPEG dentro do formato não é convertido", async () => {
  const u = await createUser();
  const r = await upload(srv.url, sessionCookie(u.id), [jpgFixture()]);
  assert.equal(r.status, 201);
  await mediaQueueIdle();
  const m = await Media.findById(r.body[0].id);
  assert.equal(m?.conversionStatus, "not_needed");
  assert.equal(m?.width, 1080);
});

test("PNG fora da proporção é convertido para JPEG com 4:5", async () => {
  const u = await createUser();
  const r = await upload(srv.url, sessionCookie(u.id), [pngFixture()]);
  await mediaQueueIdle();
  const m = await Media.findById(r.body[0].id);
  assert.equal(m?.conversionStatus, "done");
  assert.equal(m?.mimeType, "image/jpeg");
  const ratio = m!.width! / m!.height!;
  assert.ok(ratio >= 0.79 && ratio <= 0.81, `proporção ${ratio}`);
});

test("vídeo MP4 H.264 com AAC não é convertido", async () => {
  const u = await createUser();
  const r = await upload(srv.url, sessionCookie(u.id), [mp4Fixture()]);
  await mediaQueueIdle();
  const m = await Media.findById(r.body[0].id);
  assert.equal(m?.conversionStatus, "not_needed");
  assert.equal(m?.kind, "video");
  assert.ok((m?.durationSec ?? 0) >= 3.9);
});

test("vídeo fora do formato é convertido com ffmpeg para MP4 H.264", async () => {
  const u = await createUser();
  const r = await upload(srv.url, sessionCookie(u.id), [aviFixture()]);
  await mediaQueueIdle();
  const m = await Media.findById(r.body[0].id);
  assert.equal(m?.conversionStatus, "done");
  assert.equal(m?.mimeType, "video/mp4");
  const p = await probe(m!.storagePath);
  assert.equal(p.streams.find((s) => s.codec_type === "video")?.codec_name, "h264");
});

test("arquivo que não é mídia é recusado", async () => {
  const u = await createUser();
  const tmp = `${jpgFixture()}.txt`;
  fs.writeFileSync(tmp, "oi");
  const r = await upload(srv.url, sessionCookie(u.id), [tmp]);
  assert.equal(r.status, 400);
});

test("rota pública serve o arquivo pelo token e não lista pastas", async () => {
  const u = await createUser();
  const m = await createMedia(u._id);
  const ok = await fetch(`${srv.url}/ig/public/media/${m.publicToken}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  assert.equal((await fetch(`${srv.url}/ig/public/media/naoexiste`)).status, 404);
  assert.equal((await fetch(`${srv.url}/ig/public/media/`)).status, 404);
  assert.equal((await fetch(`${srv.url}/ig/public/media/..%2F..%2Fetc%2Fpasswd`)).status, 404);
});

test("GET /media mostra só as do usuário e DELETE respeita uso em publicação", async () => {
  const u = await createUser();
  const other = await createUser();
  const m = await createMedia(u._id);
  await createMedia(other._id);
  const c = client(srv.url, sessionCookie(u.id));
  const list = await c.get("/media");
  assert.equal(list.body.length, 1);
  const acc = await createAccount(u._id);
  await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date(Date.now() + 3600000) });
  assert.equal((await c.del(`/media/${m.id}`)).status, 409);
  await ScheduledPost.updateMany({}, { status: "cancelled" });
  assert.equal((await c.del(`/media/${m.id}`)).status, 204);
  assert.equal(fs.existsSync(m.storagePath), false);
  assert.equal((await client(srv.url, sessionCookie(other.id)).del(`/media/${m.id}`)).status, 404);
});

test("limpeza: mídia nunca agendada some após 7 dias; de publicação cancelada perde o arquivo", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const old = new Date(Date.now() - 8 * 86400000);
  const orphan = await createMedia(u._id, "image", { createdAt: old });
  const recent = await createMedia(u._id);
  const cancelledMedia = await createMedia(u._id, "image", { createdAt: old });
  const p = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [cancelledMedia._id], scheduledAt: old, status: "cancelled" });
  await ScheduledPost.collection.updateOne({ _id: p._id }, { $set: { updatedAt: old } });
  await cleanupMedia(new Date());
  assert.equal(await Media.exists({ _id: orphan._id }), null);
  assert.equal(fs.existsSync(orphan.storagePath), false);
  assert.ok(await Media.exists({ _id: recent._id }));
  const cm = await Media.findById(cancelledMedia._id);
  assert.ok(cm?.deletedAt);
  assert.equal(fs.existsSync(cancelledMedia.storagePath), false);
});
