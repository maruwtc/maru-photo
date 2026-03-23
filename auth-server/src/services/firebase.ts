import admin from "firebase-admin";
import type { App } from "firebase-admin/app";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Config } from "../config.js";

export class FirebaseService {
  private readonly app: App;
  private readonly auth: Auth;

  constructor(config: Config) {
    this.app = admin.apps[0] ?? admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        privateKey: config.firebasePrivateKey
      }),
      projectId: config.firebaseProjectId
    });

    this.auth = admin.auth(this.app);
  }

  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken, true);
  }
}
