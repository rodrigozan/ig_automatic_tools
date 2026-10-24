import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client } from "./helpers";
import { resolveLogin } from "../services/login";
import { oauth, ProviderProfile } from "../services/oauth";
import { Invite } from "../models/Invite";
import { User } from "../models/User";

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

const profile = (over: Partial<ProviderProfile> = {}): ProviderProfile => ({
  provider: "google",
  providerId: "g-1",
  email: "ana@example.com",
  emailVerified: true,
  name: "Ana",
  ...over,
});

test("e-mail com convite cria creator e marca usedAt", async () => {
  const admin = await createUser({ role: "admin" });
  await Invite.create({ email: "ana@example.com", invitedBy: admin._id });
  const r = await resolveLogin(profile());
  assert.ok("user" in r);
  assert.equal(r.user.role, "creator");
  const inv = await Invite.findOne({ email: "ana@example.com" });
  assert.ok(inv?.usedAt);
});

test("e-mail sem convite é recusado", async () => {
  const r = await resolveLogin(profile());
  assert.deepEqual(r, { error: "not_invited" });
  assert.equal(await User.countDocuments(), 0);
});

test("ADMIN_EMAIL entra como admin sem convite", async () => {
  const r = await resolveLogin(profile({ email: "rod@example.com" }));
  assert.ok("user" in r);
  assert.equal(r.user.role, "admin");
});

test("mesmo e-mail verificado em outro provedor vincula ao mesmo usuário", async () => {
  await resolveLogin(profile({ email: "rod@example.com" }));
  const r = await resolveLogin(profile({ email: "rod@example.com", provider: "facebook", providerId: "fb-9" }));
  assert.ok("user" in r);
  assert.equal(await User.countDocuments(), 1);
  assert.deepEqual(r.user.providers.map((p) => p.provider).sort(), ["facebook", "google"]);
});

test("e-mail não verificado é recusado", async () => {
  await resolveLogin(profile({ email: "rod@example.com" }));
  const r = await resolveLogin(profile({ email: "rod@example.com", provider: "facebook", providerId: "fb-9", emailVerified: false }));
  assert.deepEqual(r, { error: "unverified" });
});

test("conta desativada é barrada", async () => {
  const first = await resolveLogin(profile({ email: "rod@example.com" }));
  assert.ok("user" in first);
  await User.updateOne({ _id: first.user._id }, { active: false });
  assert.deepEqual(await resolveLogin(profile({ email: "rod@example.com" })), { error: "disabled" });
});

async function runCallback(p: ProviderProfile | Error) {
  const origAuth = oauth.authUrl;
  const origProfile = oauth.profile;
  oauth.authUrl = (_prov, state) => `https://provedor.test/auth?state=${state}`;
  oauth.profile = async () => {
    if (p instanceof Error) throw p;
    return p;
  };
  try {
    const start = await fetch(`${srv.url}/ig/api/auth/google?next=/publicacoes`, { redirect: "manual" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith("ig_oauth="))!.split(";")[0];
    return await fetch(`${srv.url}/ig/api/auth/google/callback?code=abc&state=${state}`, {
      redirect: "manual",
      headers: { cookie: stateCookie },
    });
  } finally {
    oauth.authUrl = origAuth;
    oauth.profile = origProfile;
  }
}

test("callback emite cookie de sessão com os atributos certos e volta à tela anterior", async () => {
  const res = await runCallback(profile({ email: "rod@example.com" }));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://exemplo.test/ig/publicacoes");
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("ig_session="))!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/ig/);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /Max-Age=604800/);
});

test("callback sem convite volta ao login com o erro", async () => {
  const res = await runCallback(profile());
  assert.equal(res.headers.get("location"), "https://exemplo.test/ig/login?erro=not_invited");
});

test("callback com state errado é recusado", async () => {
  const res = await fetch(`${srv.url}/ig/api/auth/google/callback?code=abc&state=x`, { redirect: "manual" });
  assert.equal(res.headers.get("location"), "https://exemplo.test/ig/login?erro=failed");
});

test("GET /auth/me exige sessão e renova o cookie", async () => {
  const anon = await client(srv.url).get("/auth/me");
  assert.equal(anon.status, 401);
  const u = await createUser();
  const r = await client(srv.url, sessionCookie(u.id)).get("/auth/me");
  assert.equal(r.status, 200);
  assert.equal(r.body.email, u.email);
  assert.ok(r.headers.getSetCookie().some((c) => c.startsWith("ig_session=")));
});

test("usuário desativado perde a sessão", async () => {
  const u = await createUser({ active: false });
  const r = await client(srv.url, sessionCookie(u.id)).get("/auth/me");
  assert.equal(r.status, 401);
});

test("logout apaga o cookie", async () => {
  const r = await client(srv.url).post("/auth/logout");
  assert.equal(r.status, 204);
  assert.ok(r.headers.getSetCookie().some((c) => /ig_session=;/.test(c)));
});

test("PATCH /users/me valida fuso e agenda padrão", async () => {
  const u = await createUser();
  const c = client(srv.url, sessionCookie(u.id));
  const bad = await c.patch("/users/me", { timezone: "Lugar/Nenhum" });
  assert.equal(bad.status, 400);
  const badSchedule = await c.patch("/users/me", { defaultSchedule: [{ weekday: 7, times: ["10:00"] }] });
  assert.equal(badSchedule.status, 400);
  const badTime = await c.patch("/users/me", { defaultSchedule: [{ weekday: 1, times: ["25:00"] }] });
  assert.equal(badTime.status, 400);
  const ok = await c.patch("/users/me", {
    name: "Rod",
    timezone: "America/New_York",
    defaultSchedule: [{ weekday: 3, times: ["19:00", "09:00"] }, { weekday: 1, times: ["12:00"] }],
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.timezone, "America/New_York");
  assert.deepEqual(ok.body.defaultSchedule, [
    { weekday: 1, times: ["12:00"] },
    { weekday: 3, times: ["09:00", "19:00"] },
  ]);
});

test("admin: convites e usuários; creator recebe 403", async () => {
  const admin = await createUser({ role: "admin" });
  const creator = await createUser();
  const ca = client(srv.url, sessionCookie(admin.id));
  assert.equal((await client(srv.url, sessionCookie(creator.id)).get("/admin/users")).status, 403);

  const inv = await ca.post("/admin/invites", { email: "Nova@Example.com" });
  assert.equal(inv.status, 201);
  assert.equal(inv.body.email, "nova@example.com");
  assert.equal((await ca.post("/admin/invites", { email: "nova@example.com" })).status, 409);
  assert.equal((await ca.post("/admin/invites", { email: "nada" })).status, 400);
  assert.equal((await ca.get("/admin/invites")).body.length, 1);
  assert.equal((await ca.del(`/admin/invites/${inv.body.id}`)).status, 204);

  const users = await ca.get("/admin/users");
  assert.equal(users.body.length, 2);
  const off = await ca.patch(`/admin/users/${creator.id}`, { active: false });
  assert.equal(off.body.active, false);
  assert.equal((await client(srv.url, sessionCookie(creator.id)).get("/auth/me")).status, 401);
  assert.equal((await ca.patch(`/admin/users/${admin.id}`, { active: false })).status, 400);
});

test("DELETE /users/me apaga o usuário", async () => {
  const u = await createUser();
  const r = await client(srv.url, sessionCookie(u.id)).del("/users/me");
  assert.equal(r.status, 204);
  assert.equal(await User.countDocuments({ _id: u._id }), 0);
});
