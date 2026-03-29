import crypto from "node:crypto";
export class MicrosoftOAuthService {
    config;
    cryptoService;
    constructor(config, cryptoService) {
        this.config = config;
        this.cryptoService = cryptoService;
    }
    createConnectUrl(userId) {
        const state = this.signState(userId);
        const params = new URLSearchParams({
            client_id: this.config.graphClientId,
            response_type: "code",
            redirect_uri: this.config.graphRedirectUri,
            response_mode: "query",
            scope: this.config.graphScopes,
            state
        });
        return `https://login.microsoftonline.com/${this.config.graphTenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    }
    verifyState(state) {
        const [encodedPayload, signature] = state.split(".");
        if (!encodedPayload || !signature) {
            throw new Error("Invalid Microsoft OAuth state");
        }
        const expected = crypto
            .createHmac("sha256", this.config.appJwtSecret)
            .update(encodedPayload)
            .digest("base64url");
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            throw new Error("Invalid Microsoft OAuth state signature");
        }
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            throw new Error("Microsoft OAuth state expired");
        }
        return {
            userId: payload.userId
        };
    }
    async exchangeCodeForAccount(code) {
        const token = await this.requestToken(new URLSearchParams({
            client_id: this.config.graphClientId,
            client_secret: this.config.graphClientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: this.config.graphRedirectUri,
            scope: this.config.graphScopes
        }));
        if (!token.refresh_token) {
            throw new Error("Microsoft OAuth response missing refresh token");
        }
        const profile = (await this.graphFetch("/me", token.access_token));
        const drive = (await this.graphFetch("/me/drive", token.access_token));
        return {
            profile,
            drive,
            encryptedRefreshToken: this.cryptoService.encrypt(token.refresh_token),
            scope: token.scope ?? this.config.graphScopes,
            tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString()
        };
    }
    async refreshAccessToken(account) {
        const refreshToken = this.cryptoService.decrypt(account.encryptedRefreshToken);
        const token = await this.requestToken(new URLSearchParams({
            client_id: this.config.graphClientId,
            client_secret: this.config.graphClientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            redirect_uri: this.config.graphRedirectUri,
            scope: this.config.graphScopes
        }));
        return token.access_token;
    }
    signState(userId) {
        const payload = Buffer.from(JSON.stringify({
            userId,
            exp: Math.floor(Date.now() / 1000) + 10 * 60
        }), "utf8").toString("base64url");
        const signature = crypto
            .createHmac("sha256", this.config.appJwtSecret)
            .update(payload)
            .digest("base64url");
        return `${payload}.${signature}`;
    }
    async requestToken(body) {
        const response = await fetch(`https://login.microsoftonline.com/${this.config.graphTenantId}/oauth2/v2.0/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Graph token request failed: ${response.status} ${text}`);
        }
        return (await response.json());
    }
    async graphFetch(path, accessToken) {
        const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Graph profile request failed: ${response.status} ${text}`);
        }
        return response.json();
    }
}
