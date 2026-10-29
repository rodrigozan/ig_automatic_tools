import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers";

let srv: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  srv = await startServer();
});

after(async () => {
  await srv.close();
});

test("GET /ig/api/health responde 200", async () => {
  const res = await fetch(`${srv.url}/ig/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("GET /api/health sem prefixo também responde 200", async () => {
  const res = await fetch(`${srv.url}/api/health`);
  assert.equal(res.status, 200);
});

test("rota desconhecida da API devolve 404 em JSON", async () => {
  const res = await fetch(`${srv.url}/ig/api/nada`);
  assert.equal(res.status, 404);
});

test("webhook GET devolve o desafio com o token certo e 403 com o errado", async () => {
  const { config } = await import("../config");
  config.metaWebhookVerifyToken = "tok-teste";
  const ok = await fetch(`${srv.url}/ig/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=tok-teste&hub.challenge=123`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "123");
  const bad = await fetch(`${srv.url}/ig/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123`);
  assert.equal(bad.status, 403);
});

test("painel é servido em /ig com retorno ao index.html", async () => {
  const fs = await import("fs");
  const { config } = await import("../config");
  if (!fs.existsSync(config.webDist)) return;
  const res = await fetch(`${srv.url}/ig/publicacoes`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id="root">/);
});


test("config pública usa o nome da API e expõe apenas esse campo", async () => {
  const { config } = await import("../config");
  const previous = config.appName;
  try {
    config.appName = "Nome configurado para teste";
    for (const prefix of ["/ig/api", "/api"]) {
      const res = await fetch(`${srv.url}${prefix}/config`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(await res.json(), { appName: config.appName });
    }
  } finally {
    config.appName = previous;
  }
});
