import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { setupDb, teardownDb, clearDb, startServer, createUser, sessionCookie, client, createAccount, stubIg, restoreIg } from "./helpers";
import { config } from "../config";
import { FacebookPage } from "../models/FacebookPage";
import { InstagramAccount } from "../models/InstagramAccount";
import { ProfileAnalysis } from "../models/ProfileAnalysis";
import { IgApiError } from "../services/instagramApi";
import { computeMetrics, activityLevel, engagementLevel, RawPost } from "../services/profileMetrics";
import { normalizeUsername } from "../services/profileAnalysis";
import { encrypt } from "../lib/crypto";

let srv: Awaited<ReturnType<typeof startServer>>;
const NOW = new Date("2026-10-27T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

before(async () => {
  await setupDb();
  srv = await startServer();
  config.facebookAppId = "fb-app";
  config.facebookAppSecret = "fb-secret";
});
after(async () => {
  await srv.close();
  await teardownDb();
});
beforeEach(clearDb);
afterEach(restoreIg);

const post = (id: string, d: number, likes: number | undefined, comments: number | undefined, mediaType = "IMAGE", productType = "FEED"): RawPost => ({
  id, timestamp: daysAgo(d), likes, comments, mediaType, productType, caption: `legenda ${id}`, permalink: `https://instagram.example/p/${id}`,
});

test("métricas: ritmo, engajamento, mistura de conteúdo e atividade", () => {
  const posts = [
    post("a", 2, 100, 10),
    post("b", 9, 50, 0, "VIDEO", "REELS"),
    post("c", 16, 30, 5, "CAROUSEL_ALBUM"),
    post("d", 40, 20, 0),
  ];
  const m = computeMetrics({ username: "x", followers: 1000, mediaCount: 80 }, posts, NOW);
  assert.equal(m.postsAnalyzed, 4);
  assert.equal(m.daysSinceLastPost, 2);
  assert.equal(m.postsLast30d, 3);
  assert.equal(m.avgLikes, 50);
  assert.equal(m.avgComments, 3.8); // 15 / 4 arredondado a 1 casa
  assert.equal(m.engagementRate, 5.38); // (50 + 3.75) / 1000
  assert.deepEqual(m.contentMix, { image: 0.5, reel: 0.25, video: 0, carousel: 0.25, text: 0 });
  assert.equal(m.topPosts[0].id, "a");
  assert.equal(m.activity, "irregular"); // 4 posts em 90 dias: menos de 1 por semana
  assert.equal(m.engagementLevel, "high");
});

test("métricas: curtidas escondidas não viram taxa 0 e perfil parado é detectado", () => {
  const hidden = computeMetrics({ username: "x", followers: 500, mediaCount: 10 }, [post("a", 3, undefined, 4), post("b", 5, undefined, 1), post("c", 8, undefined, 0)], NOW);
  assert.equal(hidden.likesHidden, true);
  assert.equal(hidden.engagementRate, undefined);
  assert.equal(hidden.engagementLevel, "unknown");

  const stale = computeMetrics({ username: "x", followers: 500, mediaCount: 10 }, [post("a", 120, 5, 0), post("b", 130, 4, 0), post("c", 140, 3, 0)], NOW);
  assert.equal(stale.activity, "abandoned");
  assert.equal(stale.postsLast30d, 0);

  const none = computeMetrics({ username: "x", followers: 5, mediaCount: 0 }, [], NOW);
  assert.equal(none.activity, "abandoned");
  assert.equal(none.postsAnalyzed, 0);
  assert.equal(activityLevel(2, 3, 5), "insufficient");
  assert.equal(engagementLevel(0.4), "low");
});

test("métricas: lista cheia usa o intervalo observado, não 90 dias", () => {
  const posts = Array.from({ length: 50 }, (_, i) => post(`p${i}`, i * 0.7 + 1, 10, 1));
  const m = computeMetrics({ username: "x", followers: 1000, mediaCount: 900 }, posts, NOW);
  assert.ok(m.postsPerWeek > 8 && m.postsPerWeek < 12, `postsPerWeek=${m.postsPerWeek}`);
  assert.equal(m.activity, "active");
});

test("normalizeUsername aceita @, endereço e rejeita lixo", () => {
  assert.equal(normalizeUsername("@Barbearia.Exemplo"), "barbearia.exemplo");
  assert.equal(normalizeUsername("https://www.instagram.com/loja_x/?hl=pt"), "loja_x");
  assert.equal(normalizeUsername("nome com espaço"), null);
  assert.equal(normalizeUsername(""), null);
  assert.equal(normalizeUsername("a".repeat(31)), null);
});

const ownData = async () => ({
  profile: { username: "rod.creator", followers: 2000, mediaCount: 30, biography: "bio", website: "https://exemplo.test" },
  posts: [post("o1", 3, 80, 8), post("o2", 10, 60, 4), post("o3", 20, 40, 2)],
});

test("tela: calcula o perfil próprio na primeira visita e guarda", async () => {
  const u = await createUser();
  await createAccount(u._id);
  stubIg({ ownAnalysisData: ownData });
  const c = client(srv.url, sessionCookie(u.id));
  const r = await c.get("/analysis");
  assert.equal(r.status, 200);
  assert.equal(r.body.own.length, 1);
  assert.equal(r.body.own[0].analysis.metrics.followers, 2000);
  assert.equal(r.body.facebook.connected, false);
  assert.deepEqual(r.body.competitors, []);
  assert.equal(await ProfileAnalysis.countDocuments({ kind: "own" }), 1);
});

test("concorrente: sem Facebook conectado pede a conexão; com ele, analisa e entra no comparativo", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  stubIg({ ownAnalysisData: ownData });
  const c = client(srv.url, sessionCookie(u.id));

  const denied = await c.post("/analysis/competitors", { username: "@Concorrente.Um" });
  assert.equal(denied.status, 409);
  assert.equal(denied.body.error, "analysis_no_facebook");

  const seen: string[] = [];
  acc.set("fbPageTokenEnc", encrypt("page-token-1"));
  acc.fbIgUserId = "fb-ig-1";
  await acc.save();
  stubIg({
    businessDiscovery: async (igId, token, username) => {
      seen.push(`${igId}|${token}|${username}`);
      return { profile: { username, followers: 5000, mediaCount: 200 }, posts: [post("c1", 1, 300, 30), post("c2", 4, 200, 20), post("c3", 9, 100, 10)] };
    },
  });
  const added = await c.post("/analysis/competitors", { username: "@Concorrente.Um" });
  assert.equal(added.status, 201);
  assert.deepEqual(seen, ["fb-ig-1|page-token-1|concorrente.um"]);
  assert.equal(added.body.kind, "competitor");
  assert.equal(added.body.metrics.followers, 5000);

  const again = await c.post("/analysis/competitors", { username: "concorrente.um" });
  assert.equal(again.status, 201);
  assert.equal(seen.length, 1, "repetir logo em seguida usa o que já foi consultado");

  const list = await c.get("/analysis");
  assert.equal(list.body.competitors.length, 1);
  assert.equal(list.body.facebook.connected, true);

  const removed = await c.del(`/analysis/competitors/${added.body.id}`);
  assert.equal(removed.status, 204);
  assert.equal((await c.get("/analysis")).body.competitors.length, 0);
});

test("concorrente: o próprio perfil e nomes inválidos são recusados", async () => {
  const u = await createUser();
  await createAccount(u._id);
  stubIg({ ownAnalysisData: ownData });
  const c = client(srv.url, sessionCookie(u.id));
  assert.equal((await c.post("/analysis/competitors", { username: "rod.creator" })).status, 400);
  assert.equal((await c.post("/analysis/competitors", { username: "com espaço" })).status, 400);
});

test("erros da API viram mensagens claras e nada fica salvo", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  acc.set("fbPageTokenEnc", encrypt("t"));
  acc.fbIgUserId = "fb-ig-1";
  await acc.save();
  const c = client(srv.url, sessionCookie(u.id));
  stubIg({ businessDiscovery: async () => { throw new IgApiError("Invalid user id", 110, 2207013); } });
  const personal = await c.post("/analysis/competitors", { username: "pessoal" });
  assert.equal(personal.status, 404);
  assert.equal(personal.body.error, "analysis_profile_unavailable");
  stubIg({ businessDiscovery: async () => { throw new IgApiError("rate", 4); } });
  assert.equal((await c.post("/analysis/competitors", { username: "outro" })).status, 429);
  stubIg({ businessDiscovery: async () => { throw new IgApiError("expired", 190); } });
  assert.equal((await c.post("/analysis/competitors", { username: "terceiro" })).body.error, "analysis_token");
  assert.equal(await ProfileAnalysis.countDocuments({ kind: "competitor" }), 0);
});

test("consulta avulsa do agente: escopo e segredo próprios, cache de 24 h, fora do comparativo", async () => {
  const u = await createUser({ email: "rod@example.com" });
  config.agentUserEmail = "rod@example.com";
  config.analysisJwtSecret = "segredo-analise";
  const acc = await createAccount(u._id);
  acc.set("fbPageTokenEnc", encrypt("page-token-1"));
  acc.fbIgUserId = "fb-ig-1";
  await acc.save();
  let calls = 0;
  stubIg({
    businessDiscovery: async (_i, _t, username) => {
      calls += 1;
      return { profile: { username, followers: 900, mediaCount: 40, biography: "atendimento 24h" }, posts: [post("l1", 5, 20, 2), post("l2", 15, 10, 1), post("l3", 30, 8, 0)] };
    },
  });
  const sign = (over: object = {}, secret = "segredo-analise") =>
    jwt.sign({ iss: "phanter-scrapper", aud: "ig-automatic-tools", agentId: "phanter-scrapper", scope: "instagram:analyze", ...over }, secret, { expiresIn: 600 });
  const c = client(srv.url);
  const ask = (token: string) => c.get("/analysis/lookup?username=lead.exemplo").then(() => fetch(`${srv.url}/ig/api/analysis/lookup?username=lead.exemplo`, { headers: { authorization: `Bearer ${token}` } }));

  assert.equal((await ask(sign())).status, 200);
  const second = await (await ask(sign())).json();
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  assert.equal(second.profile.biography, "atendimento 24h");
  assert.equal(second.metrics.followers, 900);

  assert.equal((await ask(sign({}, "outro-segredo"))).status, 401);
  assert.equal((await ask(sign({ scope: "instagram:publish" }))).status, 403);
  assert.equal((await ask(sign({ agentId: "intruso" }))).status, 403);
  // O segredo de publicação não serve para consultar, e o de consulta não serve para publicar.
  config.agentJwtSecret = "segredo-publicacao";
  assert.equal((await ask(sign({}, "segredo-publicacao"))).status, 401);

  const owner = client(srv.url, sessionCookie(u.id));
  assert.equal((await owner.get("/analysis")).body.competitors.length, 0, "consulta avulsa não vira concorrente");
  config.agentJwtSecret = "";
  config.analysisJwtSecret = "";
});

test("conectar o Facebook liga a Página à conta certa e guarda o token cifrado", async () => {
  const u = await createUser();
  const acc = await createAccount(u._id);
  stubIg({ fbPages: async () => [
    { pageId: "p1", pageName: "Outra", pageToken: "tok-outra", igUserId: "999", igUsername: "alguem" },
    { pageId: "p2", pageName: "Minha página", pageToken: "tok-minha", igUserId: acc.igUserId, igUsername: acc.username },
  ] });
  const cookie = sessionCookie(u.id);
  config.facebookConfigId = "";
  const start = await fetch(`${srv.url}/ig/api/analysis/facebook/connect`, { redirect: "manual", headers: { cookie } });
  assert.match(start.headers.get("location")!, /facebook\.com\/v23\.0\/dialog\/oauth/);
  assert.match(start.headers.get("location")!, /instagram_basic/);
  config.facebookConfigId = "cfg123";
  const withConfig = await fetch(`${srv.url}/ig/api/analysis/facebook/connect`, { redirect: "manual", headers: { cookie } });
  assert.match(withConfig.headers.get("location")!, /config_id=cfg123/);
  assert.doesNotMatch(withConfig.headers.get("location")!, /scope=/);
  config.facebookConfigId = "";
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith("ig_fb_analysis="))!.split(";")[0];
  const done = await fetch(`${srv.url}/ig/api/analysis/facebook/callback?code=abc&state=${state}`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
  assert.equal(done.headers.get("location"), "https://exemplo.test/ig/analise?conectado=1");
  const saved = await InstagramAccount.findById(acc._id);
  assert.equal(saved!.fbIgUserId, acc.igUserId);
  assert.equal(saved!.fbPageName, "Minha página");
  assert.notEqual(saved!.fbPageTokenEnc!.data, "tok-minha");
  const shown = await client(srv.url, cookie).get("/instagram/accounts");
  assert.equal(JSON.stringify(shown.body).includes("tok-minha"), false);

  const bad = await fetch(`${srv.url}/ig/api/analysis/facebook/callback?code=abc&state=errado`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
  assert.match(bad.headers.get("location")!, /erro=falha/);
});

test("conectar o Facebook sem Instagram ligado a Página guarda as Páginas e avisa", async () => {
  const u = await createUser();
  await createAccount(u._id);
  stubIg({ fbPages: async () => [{ pageId: "p1", pageName: "Outra", pageToken: "t" }] });
  const cookie = sessionCookie(u.id);
  const start = await fetch(`${srv.url}/ig/api/analysis/facebook/connect`, { redirect: "manual", headers: { cookie } });
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith("ig_fb_analysis="))!.split(";")[0];
  const done = await fetch(`${srv.url}/ig/api/analysis/facebook/callback?code=abc&state=${state}`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
  assert.match(done.headers.get("location")!, /conectado=paginas/);
  assert.equal(await FacebookPage.countDocuments({ userId: u._id, pageId: "p1" }), 1);

  stubIg({ fbPages: async () => [] });
  const start2 = await fetch(`${srv.url}/ig/api/analysis/facebook/connect`, { redirect: "manual", headers: { cookie } });
  const state2 = new URL(start2.headers.get("location")!).searchParams.get("state")!;
  const stateCookie2 = start2.headers.getSetCookie().find((c) => c.startsWith("ig_fb_analysis="))!.split(";")[0];
  const none = await fetch(`${srv.url}/ig/api/analysis/facebook/callback?code=abc&state=${state2}`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie2}` } });
  assert.match(none.headers.get("location")!, /erro=sem_pagina/);
});

test("sem vínculo da própria conta, o Instagram de outra Página do usuário serve de ponto de partida", async () => {
  const u = await createUser();
  await createAccount(u._id);
  stubIg({ fbPages: async () => [{ pageId: "p9", pageName: "Outra", pageToken: "tok-outra", igUserId: "999", igUsername: "alguem" }] });
  const cookie = sessionCookie(u.id);
  const start = await fetch(`${srv.url}/ig/api/analysis/facebook/connect`, { redirect: "manual", headers: { cookie } });
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith("ig_fb_analysis="))!.split(";")[0];
  const done = await fetch(`${srv.url}/ig/api/analysis/facebook/callback?code=abc&state=${state}`, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
  assert.match(done.headers.get("location")!, /conectado=1/);
  const overview = await client(srv.url, cookie).get("/analysis");
  assert.equal(overview.body.facebook.connected, true);
});
