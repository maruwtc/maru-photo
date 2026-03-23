import type { DbPool } from "../db.js";
import type { MicrosoftAccountRecord } from "../types.js";

export class MicrosoftAccountRepository {
  constructor(private readonly db: DbPool) {}

  async upsert(input: {
    userId: string;
    microsoftUserId: string;
    email: string | null;
    displayName: string | null;
    encryptedRefreshToken: string;
    scope: string;
    tokenExpiresAt: string | null;
    driveId: string | null;
    driveType: string | null;
  }): Promise<void> {
    await this.db.query(
      `
        INSERT INTO microsoft_accounts (
          user_id,
          microsoft_user_id,
          email,
          display_name,
          encrypted_refresh_token,
          scope,
          token_expires_at,
          drive_id,
          drive_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id)
        DO UPDATE SET
          microsoft_user_id = EXCLUDED.microsoft_user_id,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          scope = EXCLUDED.scope,
          token_expires_at = EXCLUDED.token_expires_at,
          drive_id = EXCLUDED.drive_id,
          drive_type = EXCLUDED.drive_type,
          updated_at = NOW()
      `,
      [
        input.userId,
        input.microsoftUserId,
        input.email,
        input.displayName,
        input.encryptedRefreshToken,
        input.scope,
        input.tokenExpiresAt,
        input.driveId,
        input.driveType
      ]
    );
  }

  async findByUserId(userId: string): Promise<MicrosoftAccountRecord | null> {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      microsoft_user_id: string;
      email: string | null;
      display_name: string | null;
      encrypted_refresh_token: string;
      scope: string;
      token_expires_at: string | null;
      drive_id: string | null;
      drive_type: string | null;
    }>(
      `
        SELECT
          id,
          user_id,
          microsoft_user_id,
          email,
          display_name,
          encrypted_refresh_token,
          scope,
          token_expires_at,
          drive_id,
          drive_type
        FROM microsoft_accounts
        WHERE user_id = $1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      microsoftUserId: row.microsoft_user_id,
      email: row.email,
      displayName: row.display_name,
      encryptedRefreshToken: row.encrypted_refresh_token,
      scope: row.scope,
      tokenExpiresAt: row.token_expires_at,
      driveId: row.drive_id,
      driveType: row.drive_type
    };
  }
}
