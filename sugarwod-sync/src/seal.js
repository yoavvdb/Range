// Encrypts the workout file so it can sit on a public site: AES-256-GCM, key from your passphrase (PBKDF2).
// The Range app decrypts it with the same passphrase using the browser's Web Crypto API.
import { webcrypto as crypto } from "node:crypto";

const ITER = 250000;
const b64 = (buf) => Buffer.from(buf).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
  return { format: "range-sealed/1", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function unseal(box, pass) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await keyFrom(pass, unb64(box.salt)), unb64(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
