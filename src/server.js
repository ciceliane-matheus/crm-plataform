// Arquivo: server.js
// Para executar, certifique-se de ter Node.js instalado e Express.
// Instale as dependências com: npm init -y && npm install express body-parser cors whatsapp-web.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações e Middlewares
// Habilita o CORS para permitir que o front-end (em outro domínio) se comunique com o backend.
app.use(cors());
// Permite que o servidor analise corpos de requisição em JSON.
app.use(bodyParser.json());

// =================================================================================
// --- LÓGICA DE INTEGRAÇÃO DO WHATSAPP ---
// =================================================================================

// Cria uma nova instância do cliente do WhatsApp.
// O LocalAuth salva as informações da sessão no disco para que a autenticação
// não precise ser feita a cada reinicialização do servidor.
const client = new Client({
  authStrategy: new LocalAuth()
});

// Evento: `qr`
// Este evento é disparado quando um novo QR Code é gerado para autenticação.
client.on('qr', (qr) => {
  // O QR Code gerado deve ser enviado para o front-end.
  // Em uma aplicação real, você usaria WebSockets (como Socket.io) para
  // enviar o QR Code em tempo real.
  console.log('NOVO QR CODE GERADO:', qr);
  // Simulação de como o front-end receberia o QR Code:
  // (Este log é apenas para visualização no console do servidor)
  // socket.emit('qr', qr);
});

// Evento: `ready`
// Este evento é disparado quando o cliente do WhatsApp está pronto.
client.on('ready', () => {
  console.log('Cliente do WhatsApp está pronto!');
  // Aqui você pode notificar o front-end que a conexão foi estabelecida.
  // Exemplo: socket.emit('whatsapp-connected');
});

// Evento: `message_create`
// Este evento é disparado quando uma nova mensagem é recebida ou enviada.
client.on('message_create', (message) => {
  // A mensagem só deve ser processada se for de um contato ou grupo e não for enviada pelo próprio bot.
  if (message.fromMe) {
    return;
  }

  // 1. Recebe a mensagem do lead.
  console.log('Mensagem recebida:', message.body);
  const senderNumber = message.from;
  const messageText = message.body;

  // 2. Procura o lead correspondente no seu banco de dados (Firestore).
  // A lógica de integração com o Firestore seria colocada aqui.

  // 3. Envia a mensagem recebida para o front-end.
  // Em uma aplicação real, você usaria WebSockets.

  // 4. Aciona a lógica de IA para análise e resposta.
  // A sua função que chama a API do Gemini seria executada aqui, usando o `messageText`.
  // Por exemplo: const aiResponse = await getGeminiResponse(messageText);

  // 5. Envia a resposta da IA de volta para o lead no WhatsApp.
  // client.sendMessage(senderNumber, aiResponse);
});

// Inicializa o cliente do WhatsApp.
client.initialize();

// =================================================================================
// --- ENDPOINTS DA API PARA O FRONT-END ---
// =================================================================================

// Endpoint para iniciar o processo de conexão do WhatsApp.
// O front-end irá chamar este endpoint.
app.post('/api/whatsapp/connect', (req, res) => {
  console.log('Requisição recebida para /api/whatsapp/connect');
  
  // A lógica de inicialização já é tratada acima pelo `client.initialize()`.
  // Aqui, o endpoint simplesmente notifica o front-end que o processo
  // de geração de QR Code foi iniciado e que ele deve aguardar pelo evento via WebSocket.
  res.status(200).json({ 
    status: 'pending', 
    message: 'Processo de conexão iniciado. Aguardando QR Code...' 
  });
});

// Endpoint para enviar uma mensagem do front-end para o WhatsApp.
app.post('/api/whatsapp/send-message', async (req, res) => {
  const { number, message } = req.body;
  console.log(`Requisição para enviar mensagem para ${number}: "${message}"`);

  // Verifica se a sessão do WhatsApp está conectada.
  if (client.info) {
    try {
      // Usa a função de envio da biblioteca do WhatsApp.
      const result = await client.sendMessage(number, message);
      console.log(`Mensagem enviada com sucesso para ${number}.`);
      res.status(200).json({ status: 'success', message: 'Mensagem enviada com sucesso!' });
    } catch (e) {
      console.error(`Erro ao enviar mensagem: ${e.message}`);
      res.status(500).json({ status: 'error', message: 'Falha ao enviar a mensagem.' });
    }
  } else {
    res.status(400).json({ status: 'error', message: 'WhatsApp não está conectado.' });
  }
});

// Endpoint de Webhook para receber mensagens do WhatsApp.
// Este endpoint é o mais importante! Ele seria configurado na plataforma
// do provedor da API do WhatsApp para receber mensagens de entrada.
app.post('/api/whatsapp/webhook', (req, res) => {
  // A lógica para o webhook já é tratada pelo evento `message_create` acima.
  // Este endpoint serve apenas como um ponto de entrada para o provedor de API.
  const incomingMessage = req.body;
  console.log('Mensagem recebida via Webhook:', incomingMessage);
  
  res.status(200).send('Webhook processado com sucesso.');
});

// Endpoint para obter o status da conexão.
app.get('/api/whatsapp/status', (req, res) => {
  res.status(200).json({ status: client.info ? 'connected' : 'disconnected' });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});