import admin from "firebase-admin";
export class FirebaseService {
    app;
    auth;
    constructor(config) {
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
    verifyIdToken(idToken) {
        return this.auth.verifyIdToken(idToken, true);
    }
}
