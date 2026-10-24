import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers";
import { decrypt, encrypt } from "../lib/crypto";

test("criptografia AES-256-GCM ida e volta", () => {
  const enc = encrypt("token-secreto-123");
  assert.ok(enc.data && enc.iv && enc.tag);
  assert.notEqual(enc.data, "token-secreto-123");
  assert.equal(decrypt(enc), "token-secreto-123");
});

test("cada cifragem usa um iv diferente", () => {
  assert.notEqual(encrypt("x").iv, encrypt("x").iv);
});

test("dado adulterado não decifra", () => {
  const enc = encrypt("token");
  const tampered = { ...enc, data: Buffer.from("outro").toString("base64") };
  assert.throws(() => decrypt(tampered));
});
