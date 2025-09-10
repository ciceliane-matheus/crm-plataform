// 1. Carrega as variáveis de ambiente do arquivo .env para a memória
require('dotenv').config();
const admin = require("firebase-admin");

// Validação para garantir que a variável de ambiente foi carregada
if (!process.env.FIREBASE_CREDENTIALS) {
  throw new Error('A variável de ambiente FIREBASE_CREDENTIALS não foi definida. Verifique seu arquivo .env');
}

// 2. Pega o conteúdo da variável de ambiente (que é um texto longo)
// e o transforma de volta em um objeto JSON que o Firebase entende.
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

// 3. Inicializa o app do Firebase com as credenciais carregadas da memória
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4. Exporta a instância do banco de dados para ser usada em outras partes do projeto
const db = admin.firestore();

module.exports = { db, admin };