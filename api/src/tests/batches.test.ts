import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, createMedia } from "./helpers";
import { computeSlots, assignSlots } from "../services/batchSchedule";
import { ScheduledPost } from "../models/ScheduledPost";
import { Batch } from "../models/Batch";
import { completeBatchIfDone } from "../routes/batches";

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

const SP = "America/Sao_Paulo";
const local = (d: Date, tz = SP) => DateTime.fromJSDate(d, { zone: tz }).toFormat("yyyy-MM-dd HH:mm ccc");
const lead = 5 * 60000;

test("todo dia: um vídeo por horário, na ordem, no fuso do usuário", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const slots = computeSlots({ mode: "daily", days: [], times: ["19:00", "09:00"], startDate: "2026-11-02", timezone: SP, count: 4, now, minLeadMs: lead });
  assert.deepEqual(slots.map((d) => local(d)), ["2026-11-02 19:00 Mon", "2026-11-03 09:00 Tue", "2026-11-03 19:00 Tue", "2026-11-04 09:00 Wed"]);
  assert.equal(slots[0].toISOString(), "2026-11-02T22:00:00.000Z");
});

test("dias da semana e mais vídeos que horários na semana seguem para as próximas semanas", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const slots = computeSlots({ mode: "selected_days", days: [1, 3, 5], times: ["12:00"], startDate: "2026-11-01", timezone: SP, count: 6, now, minLeadMs: lead });
  assert.deepEqual(slots.map((d) => local(d)), [
    "2026-11-02 12:00 Mon",
    "2026-11-04 12:00 Wed",
    "2026-11-06 12:00 Fri",
    "2026-11-09 12:00 Mon",
    "2026-11-11 12:00 Wed",
    "2026-11-13 12:00 Fri",
  ]);
});

test("horário de verão: o horário local se mantém e o UTC muda", () => {
  const ny = "America/New_York";
  const now = new Date("2026-03-06T00:00:00Z");
  const slots = computeSlots({ mode: "daily", days: [], times: ["10:00", "02:30"], startDate: "2026-03-07", timezone: ny, count: 4, now, minLeadMs: lead });
  assert.equal(slots[0].toISOString(), "2026-03-07T07:30:00.000Z");
  assert.equal(slots[1].toISOString(), "2026-03-07T15:00:00.000Z");
  assert.equal(local(slots[2], ny).slice(0, 10), "2026-03-08");
  assert.equal(slots[3].toISOString(), "2026-03-08T14:00:00.000Z");
});

test("horários que já passaram ou sem antecedência são pulados", () => {
  const now = new Date("2026-11-02T21:57:00Z");
  const slots = computeSlots({ mode: "daily", days: [], times: ["19:00"], startDate: "2026-11-02", timezone: SP, count: 1, now, minLeadMs: lead });
  assert.equal(local(slots[0]), "2026-11-03 19:00 Tue");
});

test("horário editado fica fixo e os outros recebem os horários livres", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const fixed = new Date("2026-11-03T22:00:00Z");
  const r = assignSlots(
    [
      { mediaId: "a", caption: "" },
      { mediaId: "b", caption: "", scheduledAt: fixed },
      { mediaId: "c", caption: "" },
    ],
    { mode: "daily", days: [], times: ["19:00"], startDate: "2026-11-02", timezone: SP, now, minLeadMs: lead }
  );
  assert.deepEqual(r.map((i) => [i.mediaId, local(i.scheduledAt!), i.fixed]), [
    ["a", "2026-11-02 19:00 Mon", false],
    ["b", "2026-11-03 19:00 Tue", true],
    ["c", "2026-11-04 19:00 Wed", false],
  ]);
});

test("reordenar recalcula os horários na nova ordem", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const base = { mode: "daily" as const, days: [], times: ["19:00"], startDate: "2026-11-02", timezone: SP, now, minLeadMs: lead };
  const a = assignSlots([{ mediaId: "a", caption: "" }, { mediaId: "b", caption: "" }], base);
  const b = assignSlots([{ mediaId: "b", caption: "" }, { mediaId: "a", caption: "" }], base);
  assert.equal(a[0].scheduledAt!.getTime(), b[0].scheduledAt!.getTime());
  assert.equal(a[0].mediaId, "a");
  assert.equal(b[0].mediaId, "b");
});

async function setup() {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const vids = [];
  for (let i = 0; i < 6; i++) vids.push(await createMedia(u._id, "video"));
  const startDate = DateTime.now().setZone(SP).plus({ days: 1 }).toISODate()!;
  return { u, acc, vids, startDate, c: client(srv.url, sessionCookie(u.id)) };
}

test("preview não grava; confirmar cria o lote e uma publicação reel por vídeo", async () => {
  const { acc, vids, startDate, c } = await setup();
  const body = { accountId: acc.id, mode: "selected_days", days: [1, 3, 5], times: ["19:00"], startDate, items: vids.map((v, i) => ({ mediaId: v.id, caption: `v${i}` })) };
  const prev = await c.post("/batches/preview", body);
  assert.equal(prev.status, 200);
  assert.equal(prev.body.items.length, 6);
  assert.equal(await ScheduledPost.countDocuments(), 0);
  const created = await c.post("/batches", body);
  assert.equal(created.status, 201);
  assert.equal(created.body.summary.total, 6);
  const posts = await ScheduledPost.find({ batchId: created.body.id }).sort({ scheduledAt: 1 });
  assert.equal(posts.length, 6);
  assert.ok(posts.every((p) => p.type === "reel" && p.status === "scheduled"));
  assert.deepEqual(posts.map((p) => p.caption), ["v0", "v1", "v2", "v3", "v4", "v5"]);
  for (const p of posts) assert.ok([1, 3, 5].includes(DateTime.fromJSDate(p.scheduledAt, { zone: SP }).weekday % 7));
});

test("validações do lote", async () => {
  const { u, acc, vids, startDate, c } = await setup();
  const base = { accountId: acc.id, mode: "selected_days", days: [], times: ["19:00"], startDate, items: [{ mediaId: vids[0].id }] };
  assert.ok((await c.post("/batches/preview", base)).body.fields.days);
  assert.equal((await c.post("/batches/preview", { ...base, mode: "daily", times: [] })).status, 400);
  assert.ok((await c.post("/batches/preview", { ...base, mode: "daily", startDate: "2020-01-01" })).body.fields.startDate);
  const img = await createMedia(u._id, "image");
  assert.ok((await c.post("/batches/preview", { ...base, mode: "daily", items: [{ mediaId: img.id }] })).body.fields.items);
  assert.ok((await c.post("/batches/preview", { ...base, mode: "daily", items: [{ mediaId: vids[0].id, caption: "x".repeat(2201) }] })).body.fields["items.0.caption"]);
});

test("cancelar o lote não toca nas publicadas; lote conclui quando nada está pendente", async () => {
  const { acc, vids, startDate, c } = await setup();
  const created = await c.post("/batches", { accountId: acc.id, mode: "daily", times: ["19:00"], startDate, items: vids.slice(0, 3).map((v) => ({ mediaId: v.id })) });
  const posts = await ScheduledPost.find({ batchId: created.body.id }).sort({ scheduledAt: 1 });
  await ScheduledPost.updateOne({ _id: posts[0]._id }, { status: "published", publishedAt: new Date() });
  const del = await c.del(`/batches/${created.body.id}`);
  assert.equal(del.body.cancelled, 2);
  const after = await ScheduledPost.find({ batchId: created.body.id }).sort({ scheduledAt: 1 });
  assert.deepEqual(after.map((p) => p.status), ["published", "cancelled", "cancelled"]);
  assert.equal((await Batch.findById(created.body.id))?.status, "cancelled");

  const other = await c.post("/batches", { accountId: acc.id, mode: "daily", times: ["19:00"], startDate, items: vids.slice(3, 4).map((v) => ({ mediaId: v.id })) });
  await ScheduledPost.updateMany({ batchId: other.body.id }, { status: "published" });
  await completeBatchIfDone(other.body.id);
  assert.equal((await Batch.findById(other.body.id))?.status, "completed");
  const list = await c.get("/batches");
  assert.equal(list.body.length, 2);
  assert.equal((await client(srv.url, sessionCookie((await createUser()).id)).get(`/batches/${other.body.id}`)).status, 404);
});
