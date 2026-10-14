// Passwords, sessions and the credential vault.
// - Account passwords: scrypt with a per-user salt (never stored or logged in clear).
// - Sessions: random 256-bit tokens in an HttpOnly cookie; only their SHA-256 is stored.
// - Connected-platform logins (e.g. a SugarWOD password): AES-256-GCM with the server's master key, bound to
//   the user and connection ids so a sealed blob can't be moved to another account. Decrypted only in memory
//   while a sync runs.
import crypto from "node:crypto";

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32, SCRYPT);
  return `s1$${salt.toString("base64")}$${h.toString("base64")}`;
}

export function checkPassword(pw, stored) {
  const [v, s, h] = String(stored || "").split("$");
  if (v !== "s1" || !s || !h) return false;
  const want = Buffer.from(h, "base64");
  const got = crypto.scryptSync(pw, Buffer.from(s, "base64"), want.length, SCRYPT);
  return crypto.timingSafeEqual(want, got);
}

// hashing a dummy keeps "no such user" as slow as "wrong password"
const DUMMY = hashPassword("not-a-real-password");
export const burnPasswordTime = (pw) => checkPassword(pw, DUMMY);

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const tokenHash = (t) => crypto.createHash("sha256").update(String(t)).digest("base64url");
export const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;

export function makeVault(masterB64) {
  const key = Buffer.from(String(masterB64 || ""), "base64");
  if (key.length !== 32) throw new Error("RANGE_MASTER_KEY must be 32 random bytes in base64. Generate one with: openssl rand -base64 32");
  return {
    seal(value, aad) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv("aes-256-gcm", key, iv);
      c.setAAD(Buffer.from(aad));
      const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
      return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), ct]);
    },
    open(blob, aad) {
      if (!blob) return null;
      const b = Buffer.from(blob);
      if (b[0] !== 1) throw new Error("Unknown vault format");
      const d = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(1, 13));
      d.setAAD(Buffer.from(aad));
      d.setAuthTag(b.subarray(13, 29));
      return JSON.parse(Buffer.concat([d.update(b.subarray(29)), d.final()]).toString("utf8"));
    },
  };
}
