// src/firebaseClient.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

// (optionnel) petit sanity check
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) console.warn(`Firebase config missing: ${k}=${String(v)}`);
}

// Initialise une seule fois
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Exporte les singletons
export const db = getFirestore(app);
export const auth = getAuth(app);
