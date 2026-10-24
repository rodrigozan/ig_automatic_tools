import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, createMedia, stubIg, restoreIg } from "./helpers";
import { InstagramAccount } from "../models/InstagramAccount";
import { ScheduledPost } from "../models/ScheduledPost";
import { Notification } from "../models/Notification";
import { decrypt } from "../lib/crypto";
import { refreshTokens } from "../services/tokens";

let srv: Awaited<ReturnType<typeof startServer>>;
const subscribed: string[] = [];
const unsubscribed: string[] = [];

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
  subscribed.length = 0;
  unsubscribed.length = 0;
  stubIg({
    authUrl: (state) => `https://instagram.test/oauth?state=${state}`,
    exchangeCode: async () => ({ accessToken: "longo-123", expiresIn: 60 * 86400 }),
    profile: async () => ({ igUserId: "17841", username: "rod.creator", accountType: "MEDIA_CREATOR".replace("MEDIA_", "") }),
    publishingLimit: async () => ({ quotaTotal: 100, quotaUsage: 0 }),
    subscribeWebhooks: async (id) => {
      subscribed.push(id);
    },
    unsubscribeWebhooks: async (id) => {
      unsubscribed.push(id);
    },
  });
});

afterEach(restoreIg);

async function connect(cookie: string) {
  const start = await fetch(`${srv.url}/ig/api/instagram/connect`, { redirect: "manual", headers: { cookie } });
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith("ig_connect="))!.split(";")[0];
  return fetch(`${srv.url}/ig/api/instagram/callback?code=abc&state=${state}`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
}

test("conectar grava a conta com token cifrado, limite e inscrição no webhook", async () => {
  const u = await createUser();
  const res = await connect(sessionCookie(u.id));
  assert.equal(res.headers.get("location"), "https://exemplo.test/ig/contas?conectada=rod.creator");
  const acc = await InstagramAccount.findOne({ igUserId: "17841" });
  assert.ok(acc);
  assert.notEqual(acc!.accessTokenEnc!.data, "longo-123");
  assert.equal(decrypt(acc!.accessTokenEnc as { data: string; iv: string; tag: string }), "longo-123");
  assert.equal(acc!.publishLimit, 100);
  assert.deepEqual(subscribed, ["17841"]);
  const list = await client(srv.url, sessionCookie(u.id)).get("/instagram/accounts");
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].accessTokenEnc, undefined);
  assert.equal(list.body[0].usage.limit, 100);
});

test("conta pessoal é recusada e conta de outra pessoa também", async () => {
  const u = await createUser();
  stubIg({ profile: async () => ({ igUserId: "1", username: "pessoal", accountType: "PERSONAL" }) });
  assert.match((await connect(sessionCookie(u.id))).headers.get("location")!, /erro=nao_profissional/);
  const other = await createUser();
  stubIg({ profile: async () => ({ igUserId: "17841", username: "rod.creator", accountType: "BUSINESS" }) });
  await connect(sessionCookie(other.id));
  assert.match((await connect(sessionCookie(u.id))).headers.get("location")!, /erro=outra_pessoa/);
});

test("desconectar apaga o token, cancela pendentes e mantém o histórico", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  const m = await createMedia(u._id);
  const pending = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date(Date.now() + 3600000) });
  const done = await ScheduledPost.create({ userId: u._id, accountId: acc._id, type: "post", mediaIds: [m._id], scheduledAt: new Date(), status: "published" });
  const c = client(srv.url, sessionCookie(u.id));
  assert.equal((await c.del(`/instagram/accounts/${acc.id}`)).status, 204);
  const a = await InstagramAccount.findById(acc._id);
  assert.equal(a?.accessTokenEnc, undefined);
  assert.equal(a?.status, "revoked");
  assert.equal((await ScheduledPost.findById(pending._id))?.status, "cancelled");
  assert.equal((await ScheduledPost.findById(done._id))?.status, "published");
  assert.equal(unsubscribed.length, 1);
  assert.equal((await c.get("/instagram/accounts")).body.length, 0);
});

test("renovação do token antes de vencer; falha perto do fim avisa; vencido marca expired", async () => {
  const u = await createUser();
  const soon = await createAccount(u._id, { username: "a", tokenExpiresAt: new Date(Date.now() + 5 * 86400000) });
  const far = await createAccount(u._id, { username: "b" });
  stubIg({ refreshToken: async () => ({ accessToken: "novo", expiresIn: 60 * 86400 }) });
  await refreshTokens(new Date());
  const s = await InstagramAccount.findById(soon._id);
  assert.equal(decrypt(s!.accessTokenEnc as { data: string; iv: string; tag: string }), "novo");
  assert.ok(s!.tokenExpiresAt > new Date(Date.now() + 50 * 86400000));
  assert.equal(decrypt((await InstagramAccount.findById(far._id))!.accessTokenEnc as { data: string; iv: string; tag: string }), "token-ig");

  const almost = await createAccount(u._id, { username: "c", tokenExpiresAt: new Date(Date.now() + 2 * 86400000) });
  const gone = await createAccount(u._id, { username: "d", tokenExpiresAt: new Date(Date.now() - 1000) });
  stubIg({ refreshToken: async () => { throw new Error("falhou"); } });
  await refreshTokens(new Date());
  assert.equal((await InstagramAccount.findById(almost._id))?.status, "connected");
  assert.equal((await InstagramAccount.findById(gone._id))?.status, "expired");
  assert.equal(await Notification.countDocuments({ type: "token_expiring" }), 2);
});
