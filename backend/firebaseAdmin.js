// firebaseAdmin.js (versão com Storage)

require('dotenv').config();
const admin = require("firebase-admin");

if (!process.env.FIREBASE_CREDENTIALS || !process.env.FIREBASE_STORAGE_BUCKET) {
  throw new Error('As variáveis FIREBASE_CREDENTIALS e FIREBASE_STORAGE_BUCKET devem ser definidas no .env');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

// Inicializa o app do Firebase com as credenciais E o endereço do Storage
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET // <-- Adicionamos esta linha
});

console.log('[Firebase Admin] SDK inicializado com sucesso.');

// Cria as instâncias dos serviços que vamos usar
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

// Exporta todos os serviços para serem usados no projeto
module.exports = { db, auth, storage, admin }; // <-- Adicionamos o admin aqui