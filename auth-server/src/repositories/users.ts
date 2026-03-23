import type { PoolClient } from "pg";
import type { DbPool } from "../db.js";
import type { SessionUser } from "../types.js";

export class UserRepository {
  constructor(private readonly db: DbPool) {}

  async upsertFromFirebase(input: {
    firebaseUid: string;
    email: string | null;
    provider: string;
  }): Promise<SessionUser> {
    const result = await this.db.query<{
      id: string;
      firebase_uid: string;
      email: string | null;
    }>(
      `
        INSERT INTO users (firebase_uid, email, provider)
        VALUES ($1, $2, $3)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          email = EXCLUDED.email,
          provider = EXCLUDED.provider,
          updated_at = NOW()
        RETURNING id, firebase_uid, email
      `,
      [input.firebaseUid, input.email, input.provider]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert user");
    }

    return {
      userId: row.id,
      firebaseUid: row.firebase_uid,
      email: row.email
    };
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
