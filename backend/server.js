// Importações essenciais
const express = require('express');
const { db } = require('./firebaseAdmin');
const app = express();
const port = 3001; // Usaremos uma porta diferente do frontend

require('dotenv').config();

// Use um CORS para permitir requisições do seu frontend (http://localhost:3000)
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Importe sua biblioteca do WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');

// Mapeia o client do WhatsApp para o companyId
const clients = new Map();

// 🚀 Função auxiliar para logar onde o QR foi salvo
async function saveSessionToFirestore(companyId, data) {
  console.log(`[Firestore] Salvando sessão em companies/${companyId}/whatsapp_sessions/main`);
  await db
    .collection('companies')
    .doc(companyId)
    .collection('whatsapp_sessions')
    .doc('main')
    .set(data, { merge: true });
  console.log('[Firestore] Dados salvos:', data);
}

// Rota para iniciar a sessão do WhatsApp
app.post('/api/whatsapp/start-session', async (req, res) => {
  const { companyId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  if (clients.has(companyId)) {
    return res.status(200).json({ message: 'WhatsApp session already started.' });
  }

  const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false, // 👉 abre a janela do navegador real
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
  });

  clients.set(companyId, client);

  try {
    client.on('qr', async (qr) => {
      console.log('QR CODE RECEIVED for company:', companyId);
      await saveSessionToFirestore(companyId, {
        qrCode: qr,
        status: 'qrCode',
        lastUpdated: new Date()
      });
    });

    client.on('ready', async () => {
      console.log('WhatsApp client is ready for company:', companyId);
      await saveSessionToFirestore(companyId, {
        status: 'conectado',
        qrCode: null,
        lastUpdated: new Date()
      });
    });

    client.on('authenticated', () => {
      console.log('WhatsApp client authenticated for company:', companyId);
    });

    client.on('message', async (msg) => {
      if (msg.fromMe) return;

      const conversationRef = db
        .collection('companies')
        .doc(companyId)
        .collection('whatsapp_conversations')
        .doc(msg.from);

      const conversationSnap = await conversationRef.get();

      let contactName = msg.from;
      if (msg.author) {
        const contact = await client.getContactById(msg.author);
        contactName = contact.name || contact.pushname || msg.author;
      }

      if (!conversationSnap.exists) {
        await conversationRef.set({
          contactName: contactName,
          lastMessage: msg.body,
          timestamp: new Date()
        });
      } else {
        await conversationRef.update({
          lastMessage: msg.body,
          timestamp: new Date()
        });
      }

      const messagesRef = conversationRef.collection('messages');
      await messagesRef.add({
        from: 'contact',
        text: msg.body,
        timestamp: new Date()
      });
    });

    client.initialize();

    res.status(200).json({ message: 'WhatsApp session started. Check your Firestore for the QR code.' });

  } catch (error) {
    console.error('Erro ao iniciar a sessão do WhatsApp:', error);
    res.status(500).json({ error: 'Failed to start WhatsApp session.' });
  }
});

// Rota para enviar mensagens
app.post('/api/whatsapp/send-message', async (req, res) => {
  const { companyId, recipientId, message } = req.body;

  const client = clients.get(companyId);
  if (!client) {
    return res.status(400).json({ error: 'WhatsApp client not found for this company.' });
  }

  try {
    await client.sendMessage(recipientId, message);

    const messagesRef = db
      .collection('companies')
      .doc(companyId)
      .collection('whatsapp_conversations')
      .doc(recipientId)
      .collection('messages');

    await messagesRef.add({
      from: 'me',
      text: message,
      timestamp: new Date()
    });

    res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

app.listen(port, () => {
  console.log(`WhatsApp backend server listening on http://localhost:${port}`);
});