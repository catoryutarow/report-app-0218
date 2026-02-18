import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// Lazy initialization — avoid top-level calls that crash during SSR/prerender
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    if (!_auth) _auth = getAuth(getApp());
    return Reflect.get(_auth, prop, receiver);
  },
});

export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    if (!_db) _db = getFirestore(getApp());
    return Reflect.get(_db, prop, receiver);
  },
});
