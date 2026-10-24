import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupDb, teardownDb, createUser } from "./helpers";
import { ScheduledPost } from "../models/ScheduledPost";
import { DmConversation } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";

before(setupDb);
after(teardownDb);

function stages(plan: any): string[] {
  const out: string[] = [];
  const walk = (p: any) => {
    if (!p) return;
    out.push(p.stage);
    walk(p.inputStage);
    (p.inputStages ?? []).forEach(walk);
  };
  walk(plan);
  return out;
}

async function winning(q: any) {
  const e: any = await q.explain("queryPlanner");
  return stages(e.queryPlanner.winningPlan.queryPlan ?? e.queryPlanner.winningPlan);
}

test("consultas do agendador, da fila e da limpeza usam índice", async () => {
  const u = await createUser();
  await ScheduledPost.create({ userId: u._id, accountId: u._id, type: "post", mediaIds: [u._id], scheduledAt: new Date() });
  const now = new Date();
  const checks = [
    ScheduledPost.find({ status: "scheduled", scheduledAt: { $lte: now } }).sort({ scheduledAt: 1 }),
    ScheduledPost.find({ userId: u._id, scheduledAt: { $gte: now } }).sort({ scheduledAt: 1 }),
    ScheduledPost.find({ accountId: u._id, status: "published", publishedAt: { $gt: now } }),
    DmConversation.find({ status: "active", windowExpiresAt: { $lte: now } }),
    DmConversation.find({ accountId: u._id, privateReplySentAt: { $gt: now } }),
    DmMessage.find({ textExpiresAt: { $lte: now } }),
  ];
  for (const q of checks) {
    const s = await winning(q);
    assert.ok(s.includes("IXSCAN"), `${JSON.stringify(q.getFilter())}: ${s.join(">")}`);
    assert.ok(!s.includes("COLLSCAN"));
  }
});
