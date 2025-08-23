// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDgQGScK1MJcU9KOFKzKVaJaVxapGQfnu4",
  authDomain: "crm-plataform.firebaseapp.com",
  projectId: "crm-plataform",
  storageBucket: "crm-plataform.firebasestorage.app",
  messagingSenderId: "588876286066",
  appId: "1:588876286066:web:ae5f253354de51662f9aeb",
  measurementId: "G-SMMFBZDKFG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);