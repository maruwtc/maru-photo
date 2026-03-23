import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";
import type { DeviceRepository } from "../repositories/devices.js";
import type { UploadRepository } from "../repositories/uploads.js";
import type { AssetRepository } from "../repositories/assets.js";
import type { MicrosoftAccountRepository } from "../repositories/microsoft-accounts.js";
import type { GraphService } from "../services/graph.js";

type Options = {
  config: Config;
  deviceRepository: DeviceRepository;
  uploadRepository: UploadRepository;
  assetRepository: AssetRepository;
  microsoftAccountRepository: MicrosoftAccountRepository;
  graphService: GraphService;
};

function buildStoragePath(rootFolder: string, userId: string, capturedAt: string | null, fileName: string): string {
  const date = capturedAt ? new Date(capturedAt) : new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return path.posix.join(rootFolder, userId, year, month, fileName);
}

export const uploadRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  fastify.post<{
    Body: {
      deviceId: string;
      localId?: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      sha256: string;
      capturedAt?: string;
    };
  }>(
    "/v1/uploads/initiate",
    {
      preHandler: fastify.authenticate
    },
    async (request) => {
      const user = request.sessionUser!;
      const device = await options.deviceRepository.findOwnedDevice(user.userId, request.body.deviceId);
      if (!device) {
        throw fastify.httpErrors.badRequest("Device not registered for this user");
      }

      const microsoftAccount = await options.microsoftAccountRepository.findByUserId(user.userId);
      if (!microsoftAccount) {
        throw fastify.httpErrors.badRequest("Microsoft storage account not connected");
      }

      const graphItemPath = buildStoragePath(
        options.config.graphRootFolder,
        user.userId,
        request.body.capturedAt ?? null,
        request.body.fileName
      );

      const providerSession = await options.graphService.createUploadSession(microsoftAccount, graphItemPath);

      const upload = await options.uploadRepository.create({
        userId: user.userId,
        deviceId: device.id,
        providerUploadUrl: providerSession.uploadUrl,
        graphItemPath,
        expectedBytes: request.body.fileSize,
        chunkSize: 5 * 1024 * 1024,
        fileName: request.body.fileName,
        mimeType: request.body.mimeType,
        sha256: request.body.sha256,
        capturedAt: request.body.capturedAt ?? null,
        expiresAt: providerSession.expirationDateTime
      });

      return {
        uploadId: upload.id,
        chunkSize: upload.chunkSize,
        uploadUrl: `/v1/uploads/${upload.id}/chunk`,
        expiresAt: upload.expiresAt
      };
    }
  );

  fastify.put<{
    Params: {
      uploadId: string;
    };
    Body: Buffer;
    Headers: {
      "content-range": string;
      "content-type"?: string;
    };
  }>(
    "/v1/uploads/:uploadId/chunk",
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const upload = await options.uploadRepository.findOwnedUpload(
        request.params.uploadId,
        request.sessionUser!.userId
      );
      if (!upload) {
        throw fastify.httpErrors.notFound("Upload session not found");
      }

      const contentRange = request.headers["content-range"];
      if (!contentRange) {
        throw fastify.httpErrors.badRequest("Missing Content-Range header");
      }

      const chunk = request.body;
      if (!Buffer.isBuffer(chunk)) {
        throw fastify.httpErrors.badRequest("Chunk body must be binary");
      }

      await options.graphService.uploadChunk(
        upload.providerUploadUrl,
        chunk,
        contentRange,
        request.headers["content-type"] ?? "application/octet-stream"
      );

      const byteRange = /bytes\s+(\d+)-(\d+)\/(\d+)/i.exec(contentRange);
      if (!byteRange) {
        throw fastify.httpErrors.badRequest("Invalid Content-Range format");
      }

      const receivedBytes = Number(byteRange[2]) + 1;
      await options.uploadRepository.markChunkReceived(upload.id, receivedBytes);

      return reply.code(202).send({
        uploadId: upload.id,
        receivedBytes
      });
    }
  );

  fastify.post<{
    Body: {
      uploadId: string;
    };
  }>(
    "/v1/uploads/complete",
    {
      preHandler: fastify.authenticate
    },
    async (request) => {
      const microsoftAccount = await options.microsoftAccountRepository.findByUserId(request.sessionUser!.userId);
      if (!microsoftAccount) {
        throw fastify.httpErrors.badRequest("Microsoft storage account not connected");
      }

      const upload = await options.uploadRepository.findOwnedUpload(
        request.body.uploadId,
        request.sessionUser!.userId
      );
      if (!upload) {
        throw fastify.httpErrors.notFound("Upload session not found");
      }

      if (upload.receivedBytes < upload.expectedBytes) {
        throw fastify.httpErrors.badRequest("Upload not complete");
      }

      await options.uploadRepository.complete(upload.id);

      const fileName = path.posix.basename(upload.graphItemPath);
      const asset = await options.assetRepository.create({
        userId: request.sessionUser!.userId,
        deviceId: upload.deviceUuid,
        fileName,
        storagePath: upload.graphItemPath,
        driveId: options.config.graphDriveId || microsoftAccount.driveId || "me",
        sha256: upload.sha256,
        mimeType: upload.mimeType,
        bytes: upload.expectedBytes,
        capturedAt: upload.capturedAt
      });

      return asset;
    }
  );
};
