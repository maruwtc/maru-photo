import crypto from "node:crypto";
import type { Config } from "../config.js";

export class CryptoService {
  private readonly key: Buffer;

  constructor(config: Config) {
    this.key = crypto.createHash("sha256").update(config.appJwtSecret).digest();
  }

  encrypt(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64url");
  }

  decrypt(payload: string): string {
    const buffer = Buffer.from(payload, "base64url");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
