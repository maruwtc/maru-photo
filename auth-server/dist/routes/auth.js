import fs from "node:fs/promises";
import path from "node:path";
export const authRoutes = async (fastify, options) => {
    fastify.get("/v1/public/firebase-config", async () => {
        const configPath = path.resolve(process.cwd(), "firebase", "config.json");
        const raw = await fs.readFile(configPath, "utf8");
        return JSON.parse(raw);
    });
    fastify.post("/v1/auth/firebase", async (request) => {
        const decoded = await options.firebaseService.verifyIdToken(request.body.idToken);
        enforceFirebaseAccessPolicy(options.config, decoded.email ?? null, fastify);
        const user = await options.userRepository.upsertFromFirebase({
            firebaseUid: decoded.uid,
            email: decoded.email ?? null,
            provider: decoded.firebase.sign_in_provider ?? "google"
        });
        void options.auditLogRepository.log({
            userId: user.userId,
            actorEmail: user.email,
            action: "user.signin",
            resourceType: "user",
            resourceId: user.userId,
            metadata: { provider: decoded.firebase.sign_in_provider },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
        });
        return options.appTokenService.issueTokenPair(user);
    });
    fastify.get("/v1/microsoft/connect-url", {
        preHandler: fastify.authenticate
    }, async (request) => ({
        url: options.microsoftOAuthService.createConnectUrl(request.sessionUser.userId)
    }));
    fastify.get("/v1/microsoft/status", {
        preHandler: fastify.authenticate
    }, async (request) => {
        const account = await options.microsoftAccountRepository.findByUserId(request.sessionUser.userId);
        return {
            connected: Boolean(account),
            account: account
                ? {
                    email: account.email,
                    displayName: account.displayName,
                    driveId: account.driveId,
                    driveType: account.driveType
                }
                : null
        };
    });
    fastify.get("/v1/microsoft/callback", async (request, reply) => {
        try {
            if (request.query.error) {
                throw new Error(request.query.error_description ?? request.query.error);
            }
            if (!request.query.code || !request.query.state) {
                throw new Error("Missing Microsoft OAuth code or state");
            }
            const { userId } = options.microsoftOAuthService.verifyState(request.query.state);
            const account = await options.microsoftOAuthService.exchangeCodeForAccount(request.query.code);
            await options.microsoftAccountRepository.upsert({
                userId,
                microsoftUserId: account.profile.id,
                email: account.profile.mail ?? account.profile.userPrincipalName ?? null,
                displayName: account.profile.displayName ?? null,
                encryptedRefreshToken: account.encryptedRefreshToken,
                scope: account.scope,
                tokenExpiresAt: account.tokenExpiresAt,
                driveId: account.drive.id,
                driveType: account.drive.driveType ?? null
            });
            void options.auditLogRepository.log({
                userId,
                action: "user.microsoft_connect",
                resourceType: "microsoft_account",
                resourceId: account.profile.id,
                metadata: { driveType: account.drive.driveType, email: account.profile.mail }
            });
            return reply
                .type("text/html")
                .send(buildMicrosoftCallbackHtml({ ok: true, message: "Microsoft storage connected" }));
        }
        catch (error) {
            return reply
                .status(400)
                .type("text/html")
                .send(buildMicrosoftCallbackHtml({
                ok: false,
                message: error instanceof Error ? error.message : String(error)
            }));
        }
    });
};
function enforceFirebaseAccessPolicy(config, email, fastify) {
    const hasEmailAllowlist = config.authAllowedEmails.length > 0;
    const hasDomainAllowlist = config.authAllowedDomains.length > 0;
    if (!hasEmailAllowlist && !hasDomainAllowlist) {
        return;
    }
    const normalizedEmail = email?.trim().toLowerCase() ?? null;
    if (!normalizedEmail) {
        throw fastify.httpErrors.forbidden("This account is not allowed");
    }
    if (hasEmailAllowlist && config.authAllowedEmails.includes(normalizedEmail)) {
        return;
    }
    if (hasDomainAllowlist) {
        const domain = normalizedEmail.split("@")[1] ?? "";
        if (config.authAllowedDomains.includes(domain)) {
            return;
        }
    }
    throw fastify.httpErrors.forbidden("This account is not allowed");
}
function buildMicrosoftCallbackHtml(input) {
    const payload = JSON.stringify(input);
    return `<!doctype html>
<html lang="en">
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage(${payload}, "*");
      }
      window.close();
    </script>
    <p>${input.message}</p>
  </body>
</html>`;
}
