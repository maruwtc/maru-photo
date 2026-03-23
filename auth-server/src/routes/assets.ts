import type { FastifyPluginAsync } from "fastify";
import type { AssetRepository } from "../repositories/assets.js";

type Options = {
  assetRepository: AssetRepository;
};

export const assetRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  fastify.get(
    "/v1/assets",
    {
      preHandler: fastify.authenticate
    },
    async (request) => {
      return options.assetRepository.listByUser(request.sessionUser!.userId);
    }
  );
};
