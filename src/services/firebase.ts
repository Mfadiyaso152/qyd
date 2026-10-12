/**
 * Firebase Initialization and Configuration Service
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const userProvidedFirebaseConfig = {
  apiKey: "AIzaSyC_-kreCKvKE0GdhwE79visEY-Ld4fTGNM",
  authDomain: "qyd-c6de6.firebaseapp.com",
  projectId: "qyd-c6de6",
  storageBucket: "qyd-c6de6.firebasestorage.app",
  messagingSenderId: "117487698518",
  appId: "1:117487698518:web:8a3a8d109b7b9e0581b1f7",
  measurementId: "G-2B30QJW2P0"
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || userProvidedFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || userProvidedFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || userProvidedFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || userProvidedFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || userProvidedFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || userProvidedFirebaseConfig.appId,
};

export const isConfigured = Boolean(firebaseConfig.apiKey);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
