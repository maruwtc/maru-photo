import type { Config } from "../config.js";
import type { MicrosoftAccountRecord } from "../types.js";
import type { MicrosoftOAuthService } from "./microsoft-oauth.js";

type CreateUploadSessionResponse = {
  uploadUrl: string;
  expirationDateTime: string;
};

// Thumbnail CDN URLs from Graph are pre-signed and valid for ~1 hour.
// Cache them to avoid hitting the Graph API on every thumbnail request.
type CachedUrl = { url: string; expiresAt: number };

export class GraphService {
  private readonly _thumbnailCache = new Map<string, CachedUrl>();

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

  /**
   * Resolve the OneDrive/SharePoint item ID for a file stored at the given path.
   * Called after upload completion so the item ID can be persisted for fast thumbnail access.
   */
  async resolveItemId(account: MicrosoftAccountRecord, driveId: string, storagePath: string): Promise<string | null> {
    try {
      const accessToken = await this.microsoftOAuthService.refreshAccessToken(account);
      const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
      const url = this.buildItemUrl(driveId, encodedPath) + "?$select=id";
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return null;
      const item = (await response.json()) as { id?: string };
      return item.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Returns a pre-signed CDN URL for the thumbnail.
   * Calls the Graph /thumbnails endpoint (JSON) which returns temporary CDN URLs
   * that the client can fetch directly without auth headers.
   * Falls back to proxying the bytes directly if the JSON endpoint doesn't return a URL.
   */
  async getThumbnailCdnUrl(
    account: MicrosoftAccountRecord,
    driveId: string,
    driveItemId: string | null,
    storagePath: string,
    size: "small" | "medium" | "large" = "medium"
  ): Promise<string | null> {
    // Return cached URL if still valid (leave a 5 min buffer before the ~1h expiry)
    const cacheKey = `${driveItemId ?? storagePath}:${size}`;
    const cached = this._thumbnailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const accessToken = await this.microsoftOAuthService.refreshAccessToken(account);

    const itemBase = driveItemId
      ? this.buildItemUrl(driveId, undefined, driveItemId)
      : (() => {
          const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
          return this.buildItemUrl(driveId, encodedPath) + ":";
        })();

    // The /thumbnails endpoint returns JSON with pre-signed CDN URLs — no redirect chasing needed.
    const thumbnailsEndpoint = `${itemBase}/thumbnails`;
    const response = await fetch(thumbnailsEndpoint, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Graph thumbnails failed (${response.status}): ${text.slice(0, 300)}`);
    }

    type ThumbnailSize = { url: string; width: number; height: number };
    type ThumbnailSet = { id: string; small?: ThumbnailSize; medium?: ThumbnailSize; large?: ThumbnailSize };
    const data = (await response.json()) as { value: ThumbnailSet[] };

    const set = data.value[0];
    if (!set) return null;

    const url = set[size]?.url ?? set.large?.url ?? set.medium?.url ?? set.small?.url ?? null;
    if (url) {
      // Cache for 55 minutes (Graph CDN URLs are valid ~1h; 5 min buffer)
      this._thumbnailCache.set(cacheKey, { url, expiresAt: Date.now() + 55 * 60 * 1000 });
    }
    return url;
  }

  /**
   * Build a Graph item URL that is consistent with the upload session URL format.
   * Handles both personal OneDrive and SharePoint drives.
   *   - With itemId:  …/drives/{id}/items/{itemId}
   *   - With path:    …/drives/{id}/root:/{encodedPath}  (caller appends :/ suffix)
   *   - driveId "me": falls back to /me/drive/…
   */
  private buildItemUrl(driveId: string, encodedPath?: string, itemId?: string): string {
    const base = "https://graph.microsoft.com/v1.0";

    // Resolve the drive prefix — prefer site+drive form for SharePoint when configured
    let drivePrefix: string;
    if (driveId === "me") {
      drivePrefix = `${base}/me/drive`;
    } else if (this.config.graphSiteId && driveId === this.config.graphDriveId) {
      drivePrefix = `${base}/sites/${this.config.graphSiteId}/drives/${driveId}`;
    } else {
      drivePrefix = `${base}/drives/${driveId}`;
    }

    if (itemId) return `${drivePrefix}/items/${itemId}`;
    if (encodedPath) return `${drivePrefix}/root:/${encodedPath}`;
    return `${drivePrefix}/root`;
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
