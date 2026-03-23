import type { Config } from "../config.js";
import type { MicrosoftAccountRecord } from "../types.js";
import type { MicrosoftOAuthService } from "./microsoft-oauth.js";

type CreateUploadSessionResponse = {
  uploadUrl: string;
  expirationDateTime: string;
};

export class GraphService {
  constructor(
    private readonly config: Config,
    private readonly microsoftOAuthService: MicrosoftOAuthService
  ) {}

  async createUploadSession(
    account: MicrosoftAccountRecord,
    path: string
  ): Promise<CreateUploadSessionResponse> {
    const accessToken = await this.microsoftOAuthService.refreshAccessToken(account);
    const url = this.buildUploadSessionUrl(account, path);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace"
        },
        deferCommit: false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Graph createUploadSession failed: ${response.status} ${body}`);
    }

    const body = (await response.json()) as CreateUploadSessionResponse;
    return {
      uploadUrl: body.uploadUrl,
      expirationDateTime: body.expirationDateTime
    };
  }

  async uploadChunk(uploadUrl: string, body: Buffer, contentRange: string, mimeType: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(body.byteLength),
        "Content-Range": contentRange,
        "Content-Type": mimeType
      },
      body: new Uint8Array(body)
    });

    if (!response.ok && response.status !== 202 && response.status !== 201 && response.status !== 200) {
      const text = await response.text();
      throw new Error(`Graph chunk upload failed: ${response.status} ${text}`);
    }
  }

  private buildUploadSessionUrl(account: MicrosoftAccountRecord, path: string): string {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    if (this.config.graphSiteId && this.config.graphDriveId) {
      return (
        `https://graph.microsoft.com/v1.0/sites/${this.config.graphSiteId}` +
        `/drives/${this.config.graphDriveId}/root:/${encodedPath}:/createUploadSession`
      );
    }

    const driveId = account.driveId ?? "me";
    return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/createUploadSession`;
  }
}
