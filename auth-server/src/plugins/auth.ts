import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { AppTokenService } from "../services/app-token.js";
import type { AppTokenPayload, SessionUser } from "../types.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }

  interface FastifyInstance {
    authenticate: (request: import("fastify").FastifyRequest) => Promise<void>;
  }
}

type PluginOptions = {
  appTokenService: AppTokenService;
};

const authPlugin: FastifyPluginAsync<PluginOptions> = async (fastify, options) => {
  fastify.decorate("authenticate", async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw fastify.httpErrors.unauthorized("Missing bearer token");
    }

    const token = authorization.slice("Bearer ".length);
    let payload: AppTokenPayload;
    try {
      payload = options.appTokenService.verifyAccessToken(token);
    } catch (error) {
      throw fastify.httpErrors.unauthorized((error as Error).message);
    }

    request.sessionUser = {
      userId: payload.sub,
      firebaseUid: payload.firebaseUid,
      email: payload.email
    };
  });
};

export default fp(authPlugin);
