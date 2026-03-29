import type { FastifyPluginAsync } from "fastify";
import type { AssetRepository } from "../repositories/assets.js";
import type { MicrosoftAccountRepository } from "../repositories/microsoft-accounts.js";
import type { GraphService } from "../services/graph.js";

type Options = {
  assetRepository: AssetRepository;
  microsoftAccountRepository: MicrosoftAccountRepository;
  graphService: GraphService;
};

const VALID_SIZES = new Set(["small", "medium", "large"]);

export const assetRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  fastify.get(
    "/v1/assets",
    { preHandler: fastify.authenticate },
    async (request) => {
      return options.assetRepository.listByUser(request.sessionUser!.userId);
    }
  );

  /**
   * GET /v1/assets/:id/thumbnail?size=small|medium|large
   *
   * Resolves a pre-signed Microsoft Graph CDN thumbnail URL and issues a 302 redirect
   * so the client fetches the image directly from Microsoft's CDN — no byte proxying.
   * The CDN URL is unauthenticated (token is embedded in the URL) and valid for ~1 hour.
   */
  fastify.get<{ Params: { id: string }; Querystring: { size?: string } }>(
    "/v1/assets/:id/thumbnail",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params;
      const sizeParam = request.query.size ?? "medium";
      const size = VALID_SIZES.has(sizeParam) ? (sizeParam as "small" | "medium" | "large") : "medium";

      const asset = await options.assetRepository.getByIdForUser(id, request.sessionUser!.userId);
      if (!asset) {
        throw fastify.httpErrors.notFound("Asset not found");
      }

      const msAccount = await options.microsoftAccountRepository.findByUserId(request.sessionUser!.userId);
      if (!msAccount) {
        throw fastify.httpErrors.badRequest("Microsoft account not connected");
      }

      let cdnUrl: string | null;
      try {
        cdnUrl = await options.graphService.getThumbnailCdnUrl(
          msAccount,
          asset.driveId,
          asset.driveItemId,
          asset.storagePath,
          size
        );
      } catch (err) {
        fastify.log.warn({ assetId: id, driveId: asset.driveId, storagePath: asset.storagePath, err }, "getThumbnailCdnUrl failed");
        throw fastify.httpErrors.notFound("Thumbnail not available");
      }

      if (!cdnUrl) {
        fastify.log.warn({ assetId: id }, "No thumbnail CDN URL returned by Graph");
        throw fastify.httpErrors.notFound("Thumbnail not available");
      }

      // Redirect client directly to the CDN — avoids byte-streaming through the backend.
      return reply.redirect(cdnUrl, 302);
    }
  );
};
