import fp from "fastify-plugin";
const authPlugin = async (fastify, options) => {
    fastify.decorate("authenticate", async (request) => {
        const authorization = request.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) {
            throw fastify.httpErrors.unauthorized("Missing bearer token");
        }
        const token = authorization.slice("Bearer ".length);
        let payload;
        try {
            payload = options.appTokenService.verifyAccessToken(token);
        }
        catch (error) {
            throw fastify.httpErrors.unauthorized(error.message);
        }
        request.sessionUser = {
            userId: payload.sub,
            firebaseUid: payload.firebaseUid,
            email: payload.email,
            isAdmin: payload.isAdmin ?? false
        };
    });
    fastify.decorate("requireAdmin", async (request) => {
        if (!request.sessionUser?.isAdmin) {
            throw fastify.httpErrors.forbidden("Admin access required");
        }
    });
};
export default fp(authPlugin);
