export const deviceRoutes = async (fastify, options) => {
    fastify.post("/v1/devices", {
        preHandler: fastify.authenticate
    }, async (request) => {
        const deviceInput = {
            userId: request.sessionUser.userId,
            deviceId: request.body.deviceId,
            platform: request.body.platform,
            appVersion: request.body.appVersion
        };
        return options.deviceRepository.upsert(request.body.pushToken
            ? {
                ...deviceInput,
                pushToken: request.body.pushToken
            }
            : deviceInput);
    });
};
