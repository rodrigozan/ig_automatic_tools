import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, stubIg, restoreIg } from "./helpers";
import { config, limits } from "../config";
import { DmAutomation } from "../models/DmAutomation";
import { DmConversation } from "../models/DmConversation";
import { DmMessage } from "../models/DmMessage";
import { WebhookEvent } from "../models/WebhookEvent";
import { Notification } from "../models/Notification";
import { webhookIdle } from "../services/webhook";
import { expireConversations, keywordMatches, processQueuedReplies, purgeOldDmText, REPLY_PROMPT } from "../services/dm";
import { IgApiError } from "../services/instagramApi";

let srv: Awaited<ReturnType<typeof startServer>>;
type Sent = { kind: "private" | "message"; to: string; message: { text: string; buttons?: { type: string; title: string; payload?: string }[] } };
const sent: Sent[] = [];

before(async () => {
  await setupDb();
  srv = await startServer();
});

after(async () => {
  await srv.close();
  await teardownDb();
});

beforeEach(async () => {
  await clearDb();
  sent.length = 0;
  limits.firstStepButtons = false;
  limits.privateRepliesPerHour = 750;
  stubIg({
    sendPrivateReply: async (_ig, _t, commentId, message) => {
      sent.push({ kind: "private", to: commentId, message: message as Sent["message"] });
      return `pr-${sent.length}`;
    },
    sendMessage: async (_ig, _t, to, message) => {
      sent.push({ kind: "message", to, message: message as Sent["message"] });
      return `m-${sent.length}`;
    },
  });
});

afterEach(restoreIg);

function sign(body: string, secret = config.instagramAppSecret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function hook(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${srv.url}/ig/api/webhooks/instagram`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature ?? sign(body) },
    body,
  });
  await webhookIdle();
  return res.status;
}

const comment = (igUserId: string, id: string, text: string, from = "fan1", mediaId = "post1") => ({
  object: "instagram",
  entry: [{ id: igUserId, time: Date.now(), changes: [{ field: "comments", value: { id, text, from: { id: from, username: `user_${from}` }, media: { id: mediaId } } }] }],
});

const postback = (igUserId: string, from: string, mid: string, payload: string, title = "Quero") => ({
  object: "instagram",
  entry: [{ id: igUserId, time: Date.now(), messaging: [{ sender: { id: from }, recipient: { id: igUserId }, timestamp: Date.now(), postback: { mid, title, payload } }] }],
});

const message = (igUserId: string, from: string, mid: string, text: string) => ({
  object: "instagram",
  entry: [{ id: igUserId, time: Date.now(), messaging: [{ sender: { id: from }, recipient: { id: igUserId }, timestamp: Date.now(), message: { mid, text } }] }],
});

async function setup(over: Record<string, unknown> = {}) {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const c = client(srv.url, sessionCookie(u.id));
  const r = await c.post("/automations", {
    accountId: acc.id,
    name: "Receita grátis",
    target: "specific_post",
    igMediaId: "post1",
    keywords: ["Receita"],
    matchMode: "contains",
    startStepId: "s1",
    steps: [
      { id: "s1", text: "Oi! Quer a receita?", buttons: [{ label: "Quero", type: "postback", nextStepId: "s2" }] },
      { id: "s2", text: "Aqui está o link", buttons: [{ label: "Abrir", type: "url", url: "https://exemplo.com/receita" }] },
    ],
    ...over,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { u, acc, c, automation: r.body };
}

test("palavra-chave: contém e exata, sem diferenciar maiúsculas", () => {
  assert.equal(keywordMatches("Quero a RECEITA por favor", ["receita"], "contains"), true);
  assert.equal(keywordMatches("Quero a receita", ["receita"], "exact"), false);
  assert.equal(keywordMatches("  Receita ", ["receita"], "exact"), true);
  assert.equal(keywordMatches("nada", ["receita"], "contains"), false);
});

test("assinatura inválida é recusada; válida é aceita", async () => {
  const { acc } = await setup();
  assert.equal(await hook(comment(acc.igUserId, "c1", "receita"), "sha256=errada"), 401);
  assert.equal(await hook(comment(acc.igUserId, "c1", "receita"), sign("x", "outro")), 401);
  assert.equal(sent.length, 0);
  assert.equal(await hook(comment(acc.igUserId, "c1", "receita")), 200);
  assert.equal(sent.length, 1);
});

test("comentário com palavra-chave envia o primeiro passo como resposta privada", async () => {
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "Quero a receita!"));
  assert.equal(sent[0].kind, "private");
  assert.equal(sent[0].to, "c1");
  assert.equal(sent[0].message.buttons, undefined);
  assert.ok(sent[0].message.text.endsWith(REPLY_PROMPT));
  const conv = await DmConversation.findOne({ igScopedUserId: "fan1" });
  assert.equal(conv?.status, "active");
  assert.equal(conv?.buttonsPending, true);
  assert.equal(await DmMessage.countDocuments({ conversationId: conv!._id, direction: "out", status: "sent" }), 1);
});

test("evento repetido é ignorado e é uma vez por pessoa por automação", async () => {
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita"));
  await hook(comment(acc.igUserId, "c1", "receita"));
  assert.equal(sent.length, 1);
  assert.equal(await WebhookEvent.countDocuments(), 1);
  await hook(comment(acc.igUserId, "c2", "receita de novo"));
  assert.equal(sent.length, 1);
  assert.equal(await DmConversation.countDocuments(), 1);
});

test("post diferente ou sem palavra-chave não dispara; qualquer post dispara", async () => {
  const { acc, c } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita", "fan1", "outro-post"));
  await hook(comment(acc.igUserId, "c2", "olá", "fan2"));
  assert.equal(sent.length, 0);
  await c.post("/automations", {
    accountId: acc.id,
    name: "Geral",
    target: "any_post",
    keywords: ["link"],
    matchMode: "exact",
    startStepId: "a",
    steps: [{ id: "a", text: "Segue o link" }],
  });
  await hook(comment(acc.igUserId, "c3", "LINK", "fan3", "qualquer"));
  assert.equal(sent.length, 1);
  const conv = await DmConversation.findOne({ igScopedUserId: "fan3" });
  assert.equal(conv?.status, "completed");
});

test("texto livre depois da primeira mensagem envia os botões; botão envia o passo seguinte e conclui", async () => {
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita"));
  await hook(message(acc.igUserId, "fan1", "mid1", "oi, quero"));
  assert.equal(sent.length, 2);
  assert.equal(sent[1].kind, "message");
  assert.equal(sent[1].message.buttons?.[0].type, "postback");
  const payload = sent[1].message.buttons![0].payload!;
  const conv = await DmConversation.findOne({ igScopedUserId: "fan1" });
  assert.equal(conv?.buttonsPending, false);
  assert.equal(payload, `c:${conv!.id}:s2`);
  await hook(postback(acc.igUserId, "fan1", "pb1", payload));
  assert.equal(sent.length, 3);
  assert.equal(sent[2].message.text, "Aqui está o link");
  const done = await DmConversation.findById(conv!._id);
  assert.equal(done?.status, "completed");
  assert.equal(done?.currentStepId, "s2");
  await hook(message(acc.igUserId, "fan1", "mid2", "valeu"));
  assert.equal(sent.length, 3);
});

test("com botão aceito na primeira mensagem, ela já vai com botões; texto livre é só guardado", async () => {
  limits.firstStepButtons = true;
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita"));
  assert.equal(sent[0].message.buttons?.length, 1);
  await hook(message(acc.igUserId, "fan1", "mid1", "texto qualquer"));
  assert.equal(sent.length, 1);
  const conv = await DmConversation.findOne({ igScopedUserId: "fan1" });
  assert.equal(await DmMessage.countDocuments({ conversationId: conv!._id, direction: "in", text: "texto qualquer" }), 1);
  assert.equal(conv?.currentStepId, "s1");
});

test("falha de envio: mensagem e conversa failed, Aviso dm_failed", async () => {
  const { acc } = await setup();
  stubIg({ sendPrivateReply: async () => { throw new IgApiError("bloqueado"); } });
  await hook(comment(acc.igUserId, "c1", "receita"));
  const conv = await DmConversation.findOne({ igScopedUserId: "fan1" });
  assert.equal(conv?.status, "failed");
  assert.equal(await DmMessage.countDocuments({ status: "failed" }), 1);
  assert.equal(await Notification.countDocuments({ type: "dm_failed" }), 1);
});

test("janela vencida vira expired", async () => {
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita"));
  const n = await expireConversations(new Date(Date.now() + 8 * 86400000));
  assert.equal(n, 1);
  assert.equal((await DmConversation.findOne())?.status, "expired");
});

test("limite por hora: perto do limite avisa e o excedente entra na fila", async () => {
  limits.privateRepliesPerHour = 2;
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita", "f1"));
  await hook(comment(acc.igUserId, "c2", "receita", "f2"));
  await hook(comment(acc.igUserId, "c3", "receita", "f3"));
  assert.equal(sent.length, 2);
  assert.equal(await Notification.countDocuments({ type: "limit_near" }), 1);
  const queued = await DmConversation.findOne({ igScopedUserId: "f3" });
  assert.equal(queued?.queued, true);
  assert.equal(await DmMessage.countDocuments({ status: "queued" }), 1);
  await processQueuedReplies(new Date());
  assert.equal(sent.length, 2);
  await processQueuedReplies(new Date(Date.now() + 61 * 60000));
  assert.equal(sent.length, 3);
  assert.equal((await DmConversation.findById(queued!._id))?.queued, false);
  assert.equal(await DmMessage.countDocuments({ status: "queued" }), 0);
});

test("limpeza dos 90 dias apaga o texto e mantém os números", async () => {
  const { acc } = await setup();
  await hook(comment(acc.igUserId, "c1", "receita"));
  await hook(message(acc.igUserId, "fan1", "mid1", "oi"));
  const total = await DmMessage.countDocuments();
  const n = await purgeOldDmText(new Date(Date.now() + 91 * 86400000));
  assert.equal(n, total);
  assert.equal(await DmMessage.countDocuments(), total);
  assert.equal(await DmMessage.countDocuments({ text: { $exists: true } }), 0);
});

test("validações do editor e acesso só do dono; admin não lê mensagens de outros", async () => {
  const { acc, c, automation } = await setup();
  const bad = await c.post("/automations", {
    accountId: acc.id,
    name: "x",
    target: "specific_post",
    keywords: [" "],
    startStepId: "zz",
    steps: [{ id: "s1", text: "oi", buttons: [{ label: "Ir", type: "postback", nextStepId: "nao" }, { label: "Site", type: "url", url: "http://inseguro" }] }],
  });
  assert.equal(bad.status, 400);
  for (const f of ["igMediaId", "keywords", "startStepId", "steps.0.buttons.0", "steps.0.buttons.1"]) assert.ok(bad.body.fields[f], f);
  await hook(comment(acc.igUserId, "c1", "receita"));
  const convs = await c.get(`/automations/${automation.id}/conversations`);
  assert.equal(convs.body.length, 1);
  const msgs = await c.get(`/conversations/${convs.body[0].id}/messages`);
  assert.equal(msgs.body.length, 1);
  const admin = client(srv.url, sessionCookie((await createUser({ role: "admin" })).id));
  assert.equal((await admin.get(`/conversations/${convs.body[0].id}/messages`)).status, 404);
  assert.equal((await admin.get(`/automations/${automation.id}/conversations`)).status, 404);
  const users = await admin.get("/admin/users");
  assert.ok(!JSON.stringify(users.body).includes("Oi! Quer a receita?"));
});

test("editar, desativar, desconectar a conta desativa e apagar", async () => {
  const { acc, c, automation } = await setup();
  const ed = await c.patch(`/automations/${automation.id}`, { keywords: ["Bolo"], target: "any_post" });
  assert.deepEqual(ed.body.keywords, ["bolo"]);
  assert.equal(ed.body.igMediaId, undefined);
  const off = await c.patch(`/automations/${automation.id}/active`, { active: false });
  assert.equal(off.body.active, false);
  await hook(comment(acc.igUserId, "c1", "bolo"));
  assert.equal(sent.length, 0);
  await c.patch(`/automations/${automation.id}/active`, { active: true });
  await c.del(`/instagram/accounts/${acc.id}`);
  assert.equal((await DmAutomation.findById(automation.id))?.active, false);
  assert.equal((await c.del(`/automations/${automation.id}`)).status, 204);
  assert.equal(await DmAutomation.countDocuments(), 0);
});
