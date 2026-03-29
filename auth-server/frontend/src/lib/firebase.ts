"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

let app: FirebaseApp | null = null;

async function ensureFirebase(): Promise<FirebaseApp> {
  if (app ?? getApps()[0]) return app ?? getApps()[0]!;
  const res = await fetch(`${API_URL}/v1/public/firebase-config`);
  if (!res.ok) throw new Error("Failed to load Firebase config from server");
  const config = await res.json();
  app = initializeApp(config);
  return app;
}

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
