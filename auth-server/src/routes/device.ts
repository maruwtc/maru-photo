import type { FastifyPluginAsync } from "fastify";
import type { DeviceRepository } from "../repositories/devices.js";

type Options = {
  deviceRepository: DeviceRepository;
};

export const deviceRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  fastify.post<{
    Body: {
      deviceId: string;
      platform: "ios" | "android";
      appVersion: string;
      pushToken?: string;
    };
  }>(
    "/v1/devices",
    {
      preHandler: fastify.authenticate
    },
    async (request) => {
      const deviceInput = {
        userId: request.sessionUser!.userId,
        deviceId: request.body.deviceId,
        platform: request.body.platform,
        appVersion: request.body.appVersion
      } as const;

      return options.deviceRepository.upsert(
        request.body.pushToken
          ? {
              ...deviceInput,
              pushToken: request.body.pushToken
            }
          : deviceInput
      );
    }
  );
};
