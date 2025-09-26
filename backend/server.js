// Importações essenciais
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db, auth, storage } = require('./firebaseAdmin');

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const app = express();
const port = 3001;

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json({ limit: '50mb' }));

// =================================================================================
// --- MIDDLEWARE DE AUTORIZAÇÃO ---
// =================================================================================

const isAuthorized = async (req, res, next) => {
  const { authorization } = req.headers;

  // Passo 1: Verifica se o token de autorização existe
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).send('Acesso não autorizado: Token não fornecido.');
  }
  const token = authorization.split('Bearer ')[1];

  // Passo 2: Tenta obter o companyId do corpo (para POST) ou da query (para GET)
  let companyId = req.body?.companyId || req.query?.companyId;

  if (!companyId) {
    return res.status(400).send('Requisição inválida: companyId não foi encontrado no corpo ou na query da requisição.');
  }

  try {
    // Passo 3: Verifica a validade do token
    const decodedToken = await auth.verifyIdToken(token);
    const { uid } = decodedToken;

    console.log('[BACKEND AUTH] Recebido para verificação:', { companyId: companyId, uid: uid });

    // Passo 4: Verifica se o usuário pertence à empresa
    const userDocRef = db.collection('companies').doc(companyId).collection('users').doc(uid);
    console.log('[BACKEND AUTH] Verificando o caminho no Firestore:', userDocRef.path);
    
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      return next(); // Tudo certo, pode prosseguir!
    } else {
      return res.status(403).send('Acesso proibido: Você não tem permissão para acessar os dados desta empresa.');
    }
  } catch (error) {
    console.error("Erro na verificação do token:", error);
    return res.status(401).send('Acesso não autorizado: Token inválido ou expirado.');
  }
};

// =================================================================================
// --- ROTAS DE ONBOARDING E GESTÃO DO WHATSAPP ---
// =================================================================================
app.post('/api/whatsapp/start-onboarding', async (req, res) => {
  const { companyId } = req.body;
  const META_APP_ID = process.env.META_APP_ID;
  const REDIRECT_URI = process.env.META_REDIRECT_URI;

  if (!META_APP_ID) {
    return res.status(500).json({ error: 'Meta App ID não configurado no servidor.' });
  }

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code&state=${companyId}`;
  res.status(200).json({ authUrl });
});

app.get('/api/whatsapp/callback', async (req, res) => {
  const { code, state: companyId } = req.query;
  const META_APP_ID = process.env.META_APP_ID;
  const META_APP_SECRET = process.env.META_APP_SECRET;
  const REDIRECT_URI = process.env.META_REDIRECT_URI; // Corrigido para usar a variável de ambiente

  if (!code) {
    return res.status(400).send('Erro: Código de autorização não encontrado.');
  }

  try {
    // 1. Troca o "code" pelo access_token do usuário
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
    const tokenResponse = await axios.get(tokenUrl);
    const accessToken = tokenResponse.data.access_token;

    // 2. Usa o accessToken para encontrar a Conta Empresarial do WhatsApp (WABA) do usuário
    const wabaApiUrl = `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${accessToken}`;
    const wabaResponse = await axios.get(wabaApiUrl);
    const wabaId = wabaResponse.data?.data?.[0]?.id; // Pega o ID da primeira conta encontrada

    if (!wabaId) {
      throw new Error("Nenhuma Conta Empresarial do WhatsApp (WABA) foi encontrada para este usuário.");
    }
    console.log(`[Callback] WABA ID encontrado: ${wabaId}`);

    // 3. Usa o ID da WABA para encontrar o ID do número de telefone
    const phoneNumberApiUrl = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
    const phoneNumberResponse = await axios.get(phoneNumberApiUrl);
    const phoneNumberId = phoneNumberResponse.data?.data?.[0]?.id; // Pega o ID do primeiro número

    if (!phoneNumberId) {
        throw new Error("Nenhum número de telefone encontrado para esta Conta Empresarial.");
    }
    console.log(`[Callback] Phone Number ID encontrado: ${phoneNumberId}`);

    // 4. Salva tudo no Firestore
    const companyRef = db.collection('companies').doc(companyId);
    await companyRef.set(
      {
        whatsappAccessToken: accessToken,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappConnected: true,
      },
      { merge: true }
    );

    console.log(`WhatsApp conectado com sucesso para a empresa ${companyId}.`);
    
    // Fecha a janela pop-up
    res.send('<script>window.close();</script>');

  } catch (error) {
    console.error(
      'Erro no fluxo de callback do WhatsApp:',
      error.response ? error.response.data : error.message
    );
    res.status(500).send('Falha ao obter o token de acesso ou os dados da conta. Verifique o log do servidor.');
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const { companyId } = req.body;
  try {
    const companyRef = db.collection('companies').doc(companyId);
    await companyRef.update({
      whatsappConnected: false,
      whatsappAccessToken: null,
      whatsappPhoneNumberId: null,
    });
    console.log(`Empresa ${companyId} desconectada do WhatsApp com sucesso.`);
    res.status(200).json({ success: true, message: 'Desconectado com sucesso.' });
  } catch (error) {
    console.error(`Erro ao desconectar a empresa ${companyId}:`, error);
    res.status(500).json({ error: 'Falha ao desconectar.' });
  }
});

// =================================================================================
// --- ROTAS DE MENSAGENS E WEBHOOKS DO WHATSAPP ---
// =================================================================================
app.post('/api/whatsapp/send-message', isAuthorized, async (req, res) => {
  const { recipientId, message, companyId } = req.body;
  if (!recipientId || !message || !companyId) {
    return res.status(400).json({ error: 'Recipient ID, message, and companyId are required.' });
  }

  try {
    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await companyRef.get();
    if (!companyDoc.exists() || !companyDoc.data().whatsappConnected) {
      return res.status(403).json({ error: 'O WhatsApp não está conectado para esta empresa.' });
    }

    const { whatsappAccessToken: accessToken, whatsappPhoneNumberId: fromPhoneNumberId } = companyDoc.data();
    if (!accessToken || !fromPhoneNumberId) {
      return res.status(500).json({ error: 'As credenciais da API do WhatsApp não estão totalmente configuradas para esta empresa.' });
    }

    const url = `https://graph.facebook.com/v19.0/${fromPhoneNumberId}/messages`;
    const data = {
      messaging_product: 'whatsapp', to: recipientId, type: 'text',
      text: { preview_url: false, body: message },
    };
    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    await axios.post(url, data, { headers });
    console.log(`[send-message] Mensagem para ${recipientId} enviada com sucesso em nome da empresa ${companyId}.`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[send-message] Falha ao enviar mensagem:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao enviar mensagem.' });
  }
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  const messageData = req.body;
  res.sendStatus(200); // responde rápido ao Meta

  try {
    const change = messageData.entry?.[0]?.changes?.[0];
    if (change?.field === 'messages' && Array.isArray(change?.value?.messages)) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) throw new Error("phone_number_id não encontrado no payload.");

      // Descobre a empresa pelo phone_number_id
      const companyQuery = await db
        .collection('companies')
        .where('whatsappPhoneNumberId', '==', phoneNumberId)
        .get();

      if (companyQuery.empty) {
        throw new Error(`Nenhuma empresa encontrada para o número ${phoneNumberId}`);
      }
      const companyId = companyQuery.docs[0].id;

      for (const messageDetails of change.value.messages) {
        const fromNumber = messageDetails.from;
        const messageType = messageDetails.type;
        let messageText = '';

        if (messageType === 'text') {
          messageText = messageDetails.text.body;
        } else {
          messageText = `[${messageType} recebido]`;
        }

        const contactDetails = change.value.contacts?.[0];
        const contactName = contactDetails?.profile?.name || fromNumber;

        // Firestore refs
        const companyRef = db.collection('companies').doc(companyId);
        const leadsRef = companyRef.collection('leads');
        const columnsDocRef = companyRef.collection('kanban_settings').doc('columns');
        const columnsDoc = await columnsDocRef.get();
        if (!columnsDoc.exists)
          throw new Error(`Configuração de colunas não encontrada para a empresa ${companyId}.`);

        const conclusionStatusNames = columnsDoc
          .data()
          .list.filter(
            (c) => c.type === 'positive_conclusion' || c.type === 'negative_conclusion'
          )
          .map((c) => c.name);

        // busca lead ativo
        const activeLeadQuery = leadsRef
          .where('phoneNumber', '==', fromNumber)
          .where(
            'status',
            'not-in',
            conclusionStatusNames.length > 0
              ? conclusionStatusNames
              : ['dummy_status_to_avoid_empty_error']
          );
        const activeLeadSnapshot = await activeLeadQuery.get();

        let leadDocRef, leadId;
        if (!activeLeadSnapshot.empty) {
          const existingLeadDoc = activeLeadSnapshot.docs[0];
          leadDocRef = existingLeadDoc.ref;
          leadId = existingLeadDoc.id;
          console.log(`[Webhook] Lead ativo encontrado (${leadId}). Adicionando mensagem.`);
          await leadDocRef.update({
            lastMessage: messageText,
            timestamp: new Date(parseInt(messageDetails.timestamp) * 1000),
          });
        } else {
          console.log(
            `[Webhook] Nenhum lead ativo encontrado para ${fromNumber}. Criando um novo lead.`
          );
          const initialStatus =
            columnsDoc.data().list.find((c) => c.type === 'initial')?.name || 'Em Contato';
          const newLeadDocRef = await leadsRef.add({
            name: contactName,
            phoneNumber: fromNumber,
            status: initialStatus,
            lastMessage: messageText,
            timestamp: new Date(parseInt(messageDetails.timestamp) * 1000),
            dateCreated: new Date().toISOString(),
            source: 'whatsapp',
            tags: [],
            details: { painPoints: '', solutionNotes: '', nextSteps: '' },
            interestSummary: '',
          });
          leadId = newLeadDocRef.id;
          leadDocRef = newLeadDocRef;
        }

        const messagesRef = leadDocRef.collection('messages');
        await messagesRef.add({
          from: 'contact',
          text: messageText,
          timestamp: new Date(parseInt(messageDetails.timestamp) * 1000),
        });

        // Envia para o n8n para que o agente possa processar
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      // --- LINHA DE DEPURAÇÃO ---
      console.log(`[DEPURAÇÃO] Valor lido da N8N_WEBHOOK_URL: ${n8nWebhookUrl}`);

      if (n8nWebhookUrl) {
        console.log(`[WEBHOOK] Encaminhando dados para o n8n para o lead ${leadId}`);
        
        try {
          await axios.post(n8nWebhookUrl, { 
            messageData: {
                from: fromNumber,
                name: contactName,
                text: messageText,
                timestamp: timestamp
            },
            leadId: leadId,
            companyId: companyId
          });
        } catch (n8nError) {
          console.error("[WEBHOOK] Erro ao encaminhar para o n8n:", n8nError.message);
        }
      } else {
        // --- AVISO DE DEPURAÇÃO ---
        console.log("[DEPURAÇÃO] A variável n8nWebhookUrl está vazia ou não foi encontrada, por isso o envio para o n8n foi pulado.");
      }
      }
    } else {
      console.log('Webhook recebido mas não é mensagem. Ignorando.');
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
  }
});

app.get('/api/whatsapp/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === verify_token) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// =================================================================================
// --- OUTRAS ROTAS (ANÁLISE, AUTOMAÇÃO, ETC.) ---
// =================================================================================
app.post('/api/analise/gemini', async (req, res) => {
    const { textToAnalyze } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'Chave de API do Gemini não configurada.' });
    if (!textToAnalyze) return res.status(400).json({ error: 'Nenhum texto para analisar foi fornecido.' });

    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent";
    const prompt = `Analise o seguinte texto de uma conversa com um cliente e identifique: 1. O principal sentimento (positivo, negativo, neutro). 2. O principal problema ou necessidade do cliente. 3. Sugestões de melhoria para o atendimento. 4. Qual seria o próximo passo ideal para o time de vendas ou suporte. Responda em formato de JSON com as chaves "sentimento", "problema", "sugestoes" (array de strings) e "proximo_passo". O texto a ser analisado é: "${textToAnalyze}"`;
    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } };

    try {
        const response = await axios.post(`${API_URL}?key=${apiKey}`, payload);
        let geminiTextResponse = response.data.candidates[0].content.parts[0].text;
        const jsonMatch = geminiTextResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) geminiTextResponse = jsonMatch[0];
        const jsonResponse = JSON.parse(geminiTextResponse);
        res.status(200).json(jsonResponse);
    } catch (error) {
        console.error("Erro na API do Gemini:", error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 429) return res.status(429).json({ error: "Cota de uso da API do Gemini excedida." });
        res.status(500).json({ error: "Falha ao se comunicar com a IA." });
    }
});

app.post('/api/automations/execute', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.CRON_JOB_SECRET) {
    return res.status(401).send('Acesso não autorizado.');
  }

  console.log('Iniciando execução das automações...');
  const companyId = '3bHx7UfBFve1907kwqqT'; // Fixo por enquanto

  try {
    const companyRef = db.collection('companies').doc(companyId);
    
    const automationsRef = companyRef.collection('automations');
    const qAutomations = automationsRef.where('isActive', '==', true);
    const automationsSnapshot = await qAutomations.get();

    if (automationsSnapshot.empty) {
      console.log('Nenhuma regra de automação ativa para executar.');
      return res.status(200).send('Nenhuma regra de automação ativa encontrada.');
    }

    for (const ruleDoc of automationsSnapshot.docs) {
      const rule = ruleDoc.data();
      console.log(`Processando regra: "${rule.name}"`);

      if (rule.triggerType === 'time_in_status') {
        const { columnName, days } = rule.triggerValue;
        const messageTemplate = rule.actionValue.message;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);

        const leadsRef = companyRef.collection('leads');
        const qLeads = leadsRef
          .where('status', '==', columnName)
          .where('timestamp', '<=', targetDate);

        const leadsSnapshot = await qLeads.get();

        if (leadsSnapshot.empty) {
          console.log(`Nenhum lead encontrado para a regra "${rule.name}".`);
          continue;
        }

        console.log(`${leadsSnapshot.size} leads encontrados para a regra "${rule.name}". Disparando ações...`);

        for (const leadDoc of leadsSnapshot.docs) {
          const lead = leadDoc.data();
        
          if (!lead.phoneNumber) {
            console.log(`Lead ${lead.name} (${leadDoc.id}) pulado: sem número de telefone.`);
            continue; 
          }

          const message = messageTemplate.replace(/\[Nome do Lead\]/g, lead.name);
          const companyData = (await companyRef.get()).data();
          const { whatsappAccessToken: accessToken, whatsappPhoneNumberId: fromPhoneNumberId } = companyData;
          
          if (!accessToken || !fromPhoneNumberId) {
            console.error(`Credenciais do WhatsApp não encontradas para a empresa ${companyId}. Pulando ação.`);
            continue;
          }

          const url = `https://graph.facebook.com/v19.0/${fromPhoneNumberId}/messages`;
          const data = {
            messaging_product: 'whatsapp',
            to: lead.phoneNumber,
            type: 'text',
            text: { preview_url: false, body: message },
          };
          const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
          
          await axios.post(url, data, { headers });
          console.log(`Mensagem de automação enviada para ${lead.name} (${lead.phoneNumber}).`);
          
          await leadDoc.ref.update({ timestamp: new Date() });
        }
      }
    }

    console.log('Execução das automações concluída.');
    res.status(200).send('Automações executadas com sucesso.');

  } catch (error) {
    console.error('Erro geral ao executar automações:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    res.status(500).send('Erro no servidor ao executar automações.');
  }
});

app.post('/api/perform-daily-snapshot', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.CRON_JOB_SECRET) {
    return res.status(401).send('Acesso não autorizado.');
  }

  const companyId = '3bHx7UfBFve1907kwqqT';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    console.log('Iniciando snapshot de performance diária...');
    const companiesRef = db.collection('companies').doc(companyId);
    
    const columnsDocRef = companiesRef.collection('kanban_settings').doc('columns');
    const columnsDoc = await columnsDocRef.get();
    if (!columnsDoc.exists) {
      throw new Error('Configuração de colunas não encontrada.');
    }
    const positiveConclusionStatusNames = columnsDoc.data().list
      .filter(c => c.type === 'positive_conclusion')
      .map(c => c.name);

    if (positiveConclusionStatusNames.length === 0) {
      console.log('Nenhuma coluna de conclusão positiva configurada. Snapshot não necessário.');
      return res.status(200).send('Nenhuma coluna de sucesso configurada.');
    }

    const leadsRef = companiesRef.collection('leads');
    const q = leadsRef.where('status', 'in', positiveConclusionStatusNames);
    const querySnapshot = await q.get();
    
    const todaysQualifiedCount = querySnapshot.size;
    console.log(`Total de leads em status de sucesso hoje: ${todaysQualifiedCount}`);

    const performanceRef = companiesRef.collection('daily_performance').doc(today.toISOString().slice(0, 10));
    await performanceRef.set({
      date: today,
      qualifiedCount: todaysQualifiedCount
    });

    console.log('Snapshot de performance diária concluído com sucesso.');
    res.status(200).send('Snapshot concluído com sucesso.');

  } catch (error) {
    console.error('Erro ao executar o snapshot diário:', error);
    res.status(500).send('Erro no servidor ao executar snapshot.');
  }
});

// =================================================================================
// --- ROTAS PARA EVOLUTION API (QR CODE) ---
// =================================================================================

// URL e Chave da sua instância da Evolution API (lidas do .env)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

app.post('/api/evolution/send-message', isAuthorized, async (req, res) => {
  const { recipientId, message, companyId, leadId } = req.body; // Adicionado leadId para salvar a mensagem
  if (!recipientId || !message || !companyId || !leadId) {
    return res.status(400).json({ error: 'recipientId, message, companyId e leadId são obrigatórios.' });
  }

  // Garante que o número está no formato DDI+DDD+NUMERO (ex: 5511999998888)
  const formattedRecipient = recipientId.replace(/\D/g, '');

  try {
    const url = `${EVOLUTION_API_URL}/message/sendText/CRM_V1`; // Usando o nome da sua instância: CRM_V1
    const data = {
      number: formattedRecipient,
      options: {
        delay: 1200,
        presence: "composing"
      },
      textMessage: {
        text: message
      }
    };
    
    const headers = {
      'apikey': EVOLUTION_API_KEY,
      'Content-Type': 'application/json'
    };

    console.log(`[EVOLUTION SEND] Enviando para: ${url}`);
    await axios.post(url, data, { headers });

    // Salva a mensagem enviada no nosso banco de dados (Firestore)
    const messageRef = db.collection('companies').doc(companyId).collection('leads').doc(leadId).collection('messages');
    await messageRef.add({
      from: 'me',
      text: message,
      timestamp: new Date(),
    });

    console.log(`[EVOLUTION SEND] Mensagem para ${formattedRecipient} enviada com sucesso e salva no Firestore.`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('[EVOLUTION SEND] Falha ao enviar mensagem:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao enviar mensagem pela Evolution API.' });
  }
});

async function handleMediaUpload(eventData) {
  try {
    console.log('[MEDIA HELPER] Iniciando download da Evolution...');

    const messageId = eventData.data.key.id;
    if (!messageId) throw new Error("ID da mídia não encontrado no evento.");

    const url = `${EVOLUTION_API_URL}/chat/downloadMedia/CRM_V1/${messageId}`;
    const mediaResponse = await axios.get(url, {
      headers: { apikey: EVOLUTION_API_KEY }
    });

    const base64Data = mediaResponse.data.base64;
    if (!base64Data) throw new Error('Base64 não retornado pela Evolution API.');

    console.log('[MEDIA HELPER] Download concluído. Fazendo upload para o Firebase Storage...');

    const buffer = Buffer.from(base64Data, 'base64');

    const mimeType =
      eventData.data.message.imageMessage?.mimetype ||
      eventData.data.message.audioMessage?.mimetype ||
      eventData.data.message.videoMessage?.mimetype ||
      eventData.data.message.documentMessage?.mimetype ||
      'application/octet-stream';

    const fileExtension = mimeType.split('/')[1] || 'bin';
    const fileName = `media/${Date.now()}.${fileExtension}`;

    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
      public: true
    });

    console.log("[MEDIA HELPER] URL da mídia:", mediaMessage?.url);

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`[MEDIA HELPER] Upload concluído. URL Pública: ${publicUrl}`);

    return {
      mediaUrl: publicUrl,
      mediaType: mimeType.split('/')[0]
    };
  } catch (error) {
    console.error('[MEDIA HELPER] Erro no processamento de mídia:', error.message);
    return null;
  }
}

app.post('/api/evolution/webhook', async (req, res) => {
  const eventData = req.body;
  res.status(200).send('Webhook recebido.');

  console.log(`[EVOLUTION WEBHOOK] Evento recebido: ${eventData.event}`);

  // --- Conexão ---
  if (eventData.event === 'connection.update') {
    const state = eventData.data.state;
    const companyId = '3bHx7UfBFve1907kwqqT';
    const companyRef = db.collection('companies').doc(companyId);
    try {
      if (state === 'CONNECTED' || state === 'open') {
        console.log(`[EVOLUTION WEBHOOK] Conexão estabelecida. Atualizando Firestore...`);
        await companyRef.update({ whatsappConnected: true });
      } else if (state === 'close') {
        console.log(`[EVOLUTION WEBHOOK] Conexão fechada. Atualizando Firestore...`);
        await companyRef.update({ whatsappConnected: false });
      }
    } catch (error) {
      console.error("[EVOLUTION WEBHOOK] Erro ao atualizar status:", error);
    }
  }

  // --- Mensagens ---
  if (eventData.event === 'messages.upsert') {
    try {
      const isFromMe = eventData.data.key.fromMe;
      const contactNumber = eventData.data.key.remoteJid.split('@')[0];
      const messageDetails = eventData.data.message;
      const contactName = eventData.data.pushName || contactNumber;
      const timestamp = new Date(eventData.data.messageTimestamp * 1000);
      const companyId = '3bHx7UfBFve1907kwqqT';
      const leadsRef = db.collection('companies').doc(companyId).collection('leads');
      const leadQuery = await leadsRef.where('phone', '==', contactNumber).get();

      let leadDocRef, leadId;
      let messageToSave = {
        from: isFromMe ? 'me' : 'contact',
        timestamp: timestamp
      };

      // --- Tratamento de texto ---
      if (messageDetails?.conversation || messageDetails?.extendedTextMessage) {
        messageToSave.text = messageDetails.conversation || messageDetails.extendedTextMessage.text;
      }
      // --- Tratamento de mídia ---
      else if (
        messageDetails?.imageMessage ||
        messageDetails?.audioMessage ||
        messageDetails?.videoMessage ||
        messageDetails?.documentMessage
      ) {
        const mediaInfo = await handleMediaUpload(eventData);
        if (mediaInfo) {
          messageToSave.mediaUrl = mediaInfo.mediaUrl;
          messageToSave.mediaType = mediaInfo.mediaType;
          messageToSave.text =
            `[${mediaInfo.mediaType.charAt(0).toUpperCase() + mediaInfo.mediaType.slice(1)}]`;
        } else {
          messageToSave.text = '[Erro ao processar mídia]';
        }
      }
      // --- Caso não reconheça ---
      else {
        messageToSave.text = '[Mensagem não suportada]';
      }

      // --- Lógica para encontrar/criar o lead ---
      if (leadQuery.empty && !isFromMe) {
        const newLead = await leadsRef.add({
          name: contactName,
          phone: contactNumber,
          status: 'Em Contato',
          lastMessage: messageToSave.text,
          timestamp: timestamp,
          dateCreated: new Date().toISOString(),
          source: 'whatsapp',
          tags: [],
          details: {}
        });
        leadDocRef = newLead;
        leadId = newLead.id;
      } else if (!leadQuery.empty) {
        leadDocRef = leadQuery.docs[0].ref;
        leadId = leadQuery.docs[0].id;
        await leadDocRef.update({
          lastMessage: messageToSave.text,
          timestamp: timestamp
        });
      } else {
        return;
      }

      // --- Salva mensagem no Firestore ---
      const messagesRef = leadDocRef.collection('messages');
      await messagesRef.add(messageToSave);
      console.log(`[EVOLUTION WEBHOOK] Mensagem de '${messageToSave.from}' salva para o lead ${leadId}`);

      // --- Encaminha para o n8n se for mensagem de contato ---
      if (!isFromMe) {
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (n8nWebhookUrl) {
          console.log(`[WEBHOOK] Encaminhando dados para o n8n para o lead ${leadId}`);
          try {
            await axios.post(n8nWebhookUrl, {
              messageData: {
                from: contactNumber,
                name: contactName,
                text: messageToSave.text,
                mediaUrl: messageToSave.mediaUrl || null,
                mediaType: messageToSave.mediaType || null,
                timestamp: timestamp
              },
              leadId: leadId,
              companyId: companyId
            });
          } catch (n8nError) {
            console.error("[WEBHOOK] Erro ao encaminhar para o n8n:", n8nError.message);
          }
        }
      }

    } catch (error) {
      console.error('[EVOLUTION WEBHOOK] Erro ao processar mensagem (upsert):', error);
    }
  }
});

app.get('/api/evolution/instance/qr/:instanceName', isAuthorized, async (req, res) => {
  const { instanceName } = req.params;
  if (!instanceName) {
    return res.status(400).json({ error: 'O nome da instância é obrigatório.' });
  }

  try {
    console.log(`[QR Code] Buscando QR Code para a instância: ${instanceName}`);
    
    // Este é o endpoint da Evolution API para gerar/buscar o QR Code
    const url = `${EVOLUTION_API_URL}/instance/connect/${instanceName}`;
    
    const headers = {
      'apikey': EVOLUTION_API_KEY
    };

    const response = await axios.get(url, { headers });

    // A Evolution API retorna os dados do QR Code em um campo chamado "base64"
    const qrCodeBase64 = response.data.base64;

    if (qrCodeBase64) {
      console.log(`[QR Code] QR Code (base64) encontrado para ${instanceName}.`);
      res.status(200).json({ qrCodeBase64: qrCodeBase64 });
    } else {
       // Isso pode acontecer se a instância já estiver conectada
      console.log(`[QR Code] Nenhum QR Code retornado. A instância ${instanceName} pode já estar conectada.`);
      res.status(200).json({ message: 'Instância já conectada ou aguardando geração de QR Code.' });
    }

  } catch (error) {
    console.error(`[QR Code] Falha ao buscar QR Code para ${instanceName}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao buscar o QR Code da Evolution API.' });
  }
});

app.get('/api/evolution/instance/status/:instanceName', isAuthorized, async (req, res) => {
  const { instanceName } = req.params;
  const { companyId } = req.query; // Recebendo o companyId pela query

  try {
    const url = `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`;
    const headers = { 'apikey': EVOLUTION_API_KEY };
    const response = await axios.get(url, { headers });

    const connectionState = response.data.state; // ex: "CONNECTED" ou "DISCONNECTED"

    // Se a conexão for bem-sucedida, atualizamos nosso banco de dados!
    if (connectionState === 'CONNECTED' && companyId) {
      console.log(`[Status] Instância ${instanceName} conectada. Atualizando Firestore para companyId: ${companyId}`);
      const companyRef = db.collection('companies').doc(companyId);
      await companyRef.update({ whatsappConnected: true });
    }

    res.status(200).json({ status: connectionState });

  } catch (error) {
    console.error(`[Status] Falha ao buscar status para ${instanceName}:`, error.message);
    res.status(500).json({ error: 'Falha ao buscar o status da instância.' });
  }
});

app.post('/api/evolution/instance/logout', isAuthorized, async (req, res) => {
  const { instanceName, companyId } = req.body;
  
  try {
    console.log(`[LOGOUT] Desconectando a instância: ${instanceName}`);
    
    const url = `${EVOLUTION_API_URL}/instance/logout/${instanceName}`;
    const headers = { 'apikey': EVOLUTION_API_KEY };

    await axios.delete(url, { headers }); // O logout é geralmente um método DELETE

    // Se o logout na API foi bem-sucedido, atualiza nosso banco de dados
    const companyRef = db.collection('companies').doc(companyId);
    await companyRef.update({ whatsappConnected: false });

    console.log(`[LOGOUT] Instância ${instanceName} desconectada e Firestore atualizado.`);
    res.status(200).json({ success: true, message: 'Instância desconectada com sucesso.' });

  } catch (error) {
    console.error(`[LOGOUT] Falha ao desconectar instância ${instanceName}:`, error.message);
    res.status(500).json({ error: 'Falha ao desconectar a instância.' });
  }
});

// =================================================================================
// --- INICIALIZAÇÃO DO SERVIDOR ---
// =================================================================================
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});