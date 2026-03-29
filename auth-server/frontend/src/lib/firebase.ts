"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

let app: FirebaseApp | null = null;
let initPromise: Promise<FirebaseApp> | null = null;

async function ensureFirebase(): Promise<FirebaseApp> {
  if (app ?? getApps()[0]) return app ?? getApps()[0]!;
  if (!initPromise) {
    initPromise = fetch(`${API_URL}/v1/public/firebase-config`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load Firebase config from server");
        return res.json();
      })
      .then(config => {
        app = initializeApp(config);
        return app;
      });
  }
  return initPromise;
}

// Pre-initialize on module load so Firebase is ready before the user clicks
ensureFirebase().catch(() => { /* will surface on sign-in */ });

export async function googleSignIn(): Promise<string> {
  const firebaseApp = await ensureFirebase();
  const auth = getAuth(firebaseApp);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}

export async function firebaseSignOut(): Promise<void> {
  if (!app && !getApps()[0]) return;
  const auth = getAuth(app ?? getApps()[0]!);
  await auth.signOut();
}
