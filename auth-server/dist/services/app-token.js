import crypto from "node:crypto";
function base64UrlEncode(value) {
    return Buffer.from(value, "utf8").toString("base64url");
}
function base64UrlDecode(value) {
    return Buffer.from(value, "base64url").toString("utf8");
}
export class AppTokenService {
    config;
    constructor(config) {
        this.config = config;
    }
    issueTokenPair(user) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = 60 * 60;
        const payload = {
            sub: user.userId,
            firebaseUid: user.firebaseUid,
            email: user.email,
            isAdmin: user.isAdmin,
            aud: this.config.appJwtAudience,
            iss: this.config.appJwtIssuer,
            iat: now,
            exp: now + expiresIn
        };
        return {
            accessToken: this.sign(payload),
            refreshToken: crypto.randomBytes(32).toString("base64url"),
            expiresIn
        };
    }
    verifyAccessToken(token) {
        const [encodedHeader, encodedPayload, signature] = token.split(".");
        if (!encodedHeader || !encodedPayload || !signature) {
            throw new Error("Malformed access token");
        }
        const expectedSignature = this.createSignature(`${encodedHeader}.${encodedPayload}`);
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            throw new Error("Invalid token signature");
        }
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) {
            throw new Error("Access token expired");
        }
        if (payload.iss !== this.config.appJwtIssuer || payload.aud !== this.config.appJwtAudience) {
            throw new Error("Invalid token audience or issuer");
        }
        return payload;
    }
    sign(payload) {
        const header = {
            alg: "HS256",
            typ: "JWT"
        };
        const encodedHeader = base64UrlEncode(JSON.stringify(header));
        const encodedPayload = base64UrlEncode(JSON.stringify(payload));
        const signature = this.createSignature(`${encodedHeader}.${encodedPayload}`);
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }
    createSignature(value) {
        return crypto.createHmac("sha256", this.config.appJwtSecret).update(value).digest("base64url");
    }
}
