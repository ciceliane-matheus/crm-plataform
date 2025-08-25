// Replace the placeholders with your Firebase project values or keep using env variables.
// If you already have your config object, you can paste it directly here.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgQGScK1MJcU9KOFKzKVaJaVxapGQfnu4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crm-plataform.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "crm-plataform",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "crm-plataform.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "588876286066",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:588876286066:web:ae5f253354de51662f9aeb",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
