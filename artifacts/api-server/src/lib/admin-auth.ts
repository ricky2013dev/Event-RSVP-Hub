import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const SESSION_MS = 12 * 60 * 60 * 1000;

// The password lives only in the server environment (.env), never in the frontend bundle.
function adminPassword(): string | undefined {
  return process.env["ADMIN_PASSWORD"] || undefined;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminConfigured(): boolean {
  return adminPassword() !== undefined;
}

export function checkPassword(candidate: string): boolean {
  const password = adminPassword();
  return password !== undefined && safeEqual(candidate, password);
}

// Token = "<expiry ms>.<hmac>", keyed by the password so changing it signs everyone out.
export function issueToken(): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_MS);
  const payload = String(expiresAt.getTime());
  return { token: `${payload}.${sign(payload, adminPassword()!)}`, expiresAt };
}

function verifyToken(token: string): boolean {
  const password = adminPassword();
  const [payload, signature] = token.split(".");
  if (!password || !payload || !signature) return false;
  if (!safeEqual(signature, sign(payload, password))) return false;
  return Number(payload) > Date.now();
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Admin sign-in required" });
    return;
  }
  next();
};
