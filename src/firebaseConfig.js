import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDgQGScK1MJcU9KOFKzKVaJaVxapGQfnu4",
  authDomain: "crm-plataform.firebaseapp.com",
  projectId: "crm-plataform",
  storageBucket: "crm-plataform.firebasestorage.app",
  messagingSenderId: "588876286066",
  appId: "1:588876286066:web:ae5f253354de51662f9aeb",
  measurementId: "G-SMMFBZDKFG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };