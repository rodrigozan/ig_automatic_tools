import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupDb, teardownDb, startServer, createUser, createAccount, sessionCookie, client } from "./helpers";

let srv: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await setupDb();
  srv = await startServer();
});

after(async () => {
  await srv.close();
  await teardownDb();
});

test("cabeçalhos de segurança", async () => {
  const res = await fetch(`${srv.url}/ig/api/health`);
  assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("a resposta nunca traz o token do Instagram", async () => {
  const u = await createUser();
  await createAccount(u._id);
  const r = await client(srv.url, sessionCookie(u.id)).get("/instagram/accounts");
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes("accessToken"));
  assert.ok(!text.includes("token-ig"));
});

test("entrada inválida é recusada com 400 e id malformado com 404", async () => {
  const u = await createUser();
  const c = client(srv.url, sessionCookie(u.id));
  assert.equal((await c.post("/posts", { accountId: "x", type: "story" })).status, 400);
  assert.equal((await c.patch("/users/me", { role: "admin" })).status, 400);
  assert.equal((await c.get("/posts/nao-e-id")).status, 404);
  const res = await fetch(`${srv.url}/ig/api/posts`, { method: "POST", headers: { cookie: sessionCookie(u.id), "content-type": "application/json" }, body: "{quebrado" });
  assert.equal(res.status, 400);
});

test("limite de tentativas no login", async () => {
  let last = 0;
  for (let i = 0; i < 31; i++) {
    last = (await fetch(`${srv.url}/ig/api/auth/google`, { redirect: "manual" })).status;
  }
  assert.equal(last, 429);
});
