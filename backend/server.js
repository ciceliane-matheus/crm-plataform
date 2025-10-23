// Importações essenciais
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db, auth, storage, admin } = require('./firebaseAdmin');

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
// --- NOVAS ROTAS DA EVOLUTION API ---
// =================================================================================
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'CRM_V1';

// =================================================================================
// --- ROTA INTELIGENTE DE CRIAÇÃO/OBTENÇÃO DE QR CODE (DINÂMICO) ---
// =================================================================================
app.get('/api/evolution/instance/qr', isAuthorized, async (req, res) => {
  const { companyId } = req.query;

  // Validação essencial que o middleware 'isAuthorized' já espera
  if (!companyId) {
    return res.status(400).send('companyId é obrigatório na query.');
  }

  const instanceName = `CRM_${companyId}`; // 🔹 Instância única por empresa
  console.log(`[EVOLUTION QR] Requisição de QR Code para a empresa: ${companyId} (instância: ${instanceName})`);

  // Define os headers que serão usados em TODAS as chamadas
  const headers = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY // 🔹 Pega a chave do .env
  };

  try {
    // 1️⃣ Verifica se a instância existe
    try {
      // Tenta buscar a instância (requer 'apikey' no header)
      await axios.get(`${EVOLUTION_API_URL}/instance/${instanceName}`, { headers });
      console.log(`[EVOLUTION QR] Instância ${instanceName} já existe.`);
      
    } catch (err) {
      // Se der 404 (Não encontrada), nós a criamos
      if (err.response?.status === 404) {
        console.log(`[EVOLUTION QR] Instância ${instanceName} não encontrada. Criando...`);
        
        await axios.post(
          `${EVOLUTION_API_URL}/instance/create`,
          {
            instanceName,
            webhookUrl: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/evolution/webhook/${companyId}` // (Corrigido para ser dinâmico)
          },
          { headers } 
        );

        // ----------------------------------------------------
        // 🔹 CORREÇÃO DE TIMING (COM POLLING)
        // Vamos verificar ativamente se a instância está pronta
        // ----------------------------------------------------
        console.log(`[EVOLUTION QR] Instância ${instanceName} criada. Aguardando provisionamento...`);
        let isInstanceReady = false;
        const maxAttempts = 5; // 5 tentativas (total 10 segundos)
        const delay = 2000; // 2 segundos entre tentativas

        for (let i = 0; i < maxAttempts; i++) {
          try {
            // Tenta buscar a instância recém-criada
            await axios.get(`${EVOLUTION_API_URL}/instance/${instanceName}`, { headers });
            
            // Se o comando acima NÃO falhar (não der 404), a instância está pronta.
            isInstanceReady = true;
            console.log(`[EVOLUTION QR] ...Instância provisionada (Tentativa ${i + 1}).`);
            break; // Sai do loop
          } catch (checkErr) {
            // Se ainda der 404, significa que não está pronta. Espera e tenta de novo.
            if (checkErr.response?.status === 404) {
              console.log(`[EVOLUTION QR] ...Aguardando (Tentativa ${i + 1})...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              // Se for outro erro (500, 401), joga o erro para o catch principal
              throw checkErr;
            }
          }
        }

        if (!isInstanceReady) {
          // Se o loop terminar e a instância não estiver pronta
          console.error("[EVOLUTION QR] Erro: Instância não ficou pronta após 10 segundos.");
          throw new Error("Falha ao provisionar a instância na Evolution API a tempo.");
        }
        // ----------------------------------------------------

      } else {
        // Outro erro ao verificar (ex: 500 na Evolution, ou 401 se a key estiver errada)
        throw err; 
      }
    }

    // 2️⃣ Busca o QR Code (agora que sabemos que a instância existe)
    const qrResponse = await axios.get(`${EVOLUTION_API_URL}/instance/qr/${instanceName}`, { headers });

    // Se já estiver conectado
    if (qrResponse.data.status === 'CONNECTED' || qrResponse.data.state === 'CONNECTED') {
      await db.collection('companies').doc(companyId).update({ whatsappConnected: true });
      return res.status(200).json({ status: 'CONNECTED', message: 'Instância já está conectada.' });
    }

    // Se houver QR Code
    if (qrResponse.data.qrcode) {
      return res.status(200).json({
        qrCodeBase64: `data:image/png;base64,${qrResponse.data.qrcode}`
      });
    }

    // Outro caso (ex: expirado)
    return res.status(404).json({ error: 'QR Code não encontrado ou expirado.' });
  
  } catch (error) {
    // Pega o erro 401 se a chave estiver errada, ou qualquer outro erro
    const errorData = error.response ? error.response.data : error.message;
    console.error(`[EVOLUTION QR] Erro geral:`, errorData);
    
    if (error.response?.status === 401) {
         return res.status(401).json({ error: 'Falha na autenticação com a Evolution API. Verifique a EVOLUTION_API_KEY.' });
    }
    
    res.status(500).json({ error: 'Falha ao buscar ou criar instância na Evolution API.' });
  }
});

// Rota para verificar o status da instância da Evolution API (já implementada)
app.get('/api/evolution/instance/status', isAuthorized, async (req, res) => {
  const { companyId } = req.query;
  try {
    const instanceName = `CRM_${companyId}`;
    const url = `${EVOLUTION_API_URL}/instance/status/${instanceName}`;
    const headers = { 'apikey': EVOLUTION_API_KEY };
    const response = await axios.get(url, { headers });
    
    // Atualiza o Firestore se a conexão estiver ativa
    if (response.data.instance.status === 'CONNECTED') {
      await db.collection('companies').doc(companyId).update({ whatsappConnected: true });
    }
    
    res.status(200).json({ status: response.data.instance.status });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao verificar status da Evolution API.' });
  }
});

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
  const REDIRECT_URI = process.env.META_REDIRECT_URI;

  if (!code) {
    return res.status(400).send('Erro: Código de autorização não encontrado.');
  }

  try {
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
    const tokenResponse = await axios.get(tokenUrl);
    const accessToken = tokenResponse.data.access_token;

    const wabaApiUrl = `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${accessToken}`;
    const wabaResponse = await axios.get(wabaApiUrl);
    const wabaId = wabaResponse.data?.data?.[0]?.id;

    if (!wabaId) {
      throw new Error("Nenhuma Conta Empresarial do WhatsApp (WABA) foi encontrada para este usuário.");
    }
    console.log(`[Callback] WABA ID encontrado: ${wabaId}`);

    const phoneNumberApiUrl = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
    const phoneNumberResponse = await axios.get(phoneNumberApiUrl);
    const phoneNumberId = phoneNumberResponse.data?.data?.[0]?.id;

    if (!phoneNumberId) {
        throw new Error("Nenhum número de telefone encontrado para esta Conta Empresarial.");
    }
    console.log(`[Callback] Phone Number ID encontrado: ${phoneNumberId}`);

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
  const { recipientId, message, companyId, leadId } = req.body;
  if (!recipientId || !message || !companyId || !leadId) {
    return res.status(400).json({ error: 'recipientId, message, companyId e leadId são obrigatórios.' });
  }

  let formattedRecipient = recipientId.replace(/\D/g, '');
  if (!formattedRecipient.startsWith('55')) {
    formattedRecipient = `55${formattedRecipient}`;
  }
  const recipientJid = `${formattedRecipient}@c.us`;

  try {
    const instanceName = `CRM_${companyId}`;
    const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
    const data = {
      number: recipientJid,
      options: {
        delay: 1200,
        presence: "composing"
      },
      textMessage: {
        text: message
      }
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY
    };


    console.log(`[EVOLUTION SEND] Enviando para: ${recipientJid}`);
    await axios.post(url, data, { headers });

    const messageRef = db.collection('companies').doc(companyId).collection('leads').doc(leadId).collection('messages');
    await messageRef.add({
      from: 'me',
      text: message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[EVOLUTION SEND] Mensagem para ${recipientJid} enviada e salva com sucesso.`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('[EVOLUTION SEND] Falha ao enviar mensagem:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao enviar mensagem pela Evolution API.' });
  }
});

async function handleMediaUpload(messageData, companyId) { // 1. Recebe o companyId
  const instanceName = `CRM_${companyId}`; // 2. Cria o nome dinâmico
  try {
    console.log('[MEDIA HELPER] Iniciando download da Evolution...');
    const url = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`; // 3. Usa o nome dinâmico
    const messageDetails = messageData.message;
    const messageId = messageData.key?.id;
    if (!messageId) throw new Error("Não foi possível encontrar um ID na chave da mensagem de mídia.");

    const payload = { message: { key: { id: messageId } } };
    const mediaResponse = await axios.post(url, payload, { headers: { 'apikey': EVOLUTION_API_KEY } });
    const base64Data = mediaResponse.data.base64;
    if (!base64Data) throw new Error('Base64 não retornado pela Evolution API.');

    console.log('[MEDIA HELPER] Download concluído. Fazendo upload...');
    const buffer = Buffer.from(base64Data, 'base64');

    const mimeType = messageDetails.imageMessage?.mimetype || messageDetails.audioMessage?.mimetype || messageDetails.videoMessage?.mimetype || messageDetails.documentMessage?.mimetype || messageDetails.stickerMessage?.mimetype || 'application/octet-stream';
    let mediaType = mimeType.split('/')[0];
    if (mediaType === 'application') mediaType = 'document';
    if (mimeType.includes('webp')) mediaType = 'image';

    const fileExtension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `media/${Date.now()}.${fileExtension}`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(buffer, { metadata: { contentType: mimeType }, public: true });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`[MEDIA HELPER] Upload concluído. URL Pública: ${publicUrl}`);

    return { mediaUrl: publicUrl, mediaType: mediaType };
  } catch (error) {
    console.error('[MEDIA HELPER] Erro no processamento de mídia:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    return null;
  }
}

app.post('/api/evolution/webhook/:companyId', async (req, res) => {
  const eventData = req.body;
  
  // 2. PEGAMOS O 'companyId' QUE VEIO NA URL
  const { companyId } = req.params; 

  res.status(200).send('Webhook recebido.');
  
  console.log(`[EVOLUTION WEBHOOK] Evento recebido: ${eventData.event} para ${companyId}`);

  if (eventData.event === 'connection.update') {
    const state = eventData.data.state;
    
    // const companyId = '3bHx7UfBFve1907kwqqT'; // <-- REMOVIDO
    
    // 3. USA O 'companyId' DINÂMICO
    const companyRef = db.collection('companies').doc(companyId); 
    try {
      if (state === 'CONNECTED' || state === 'open') {
        await companyRef.update({ whatsappConnected: true });
        console.log(`[EVOLUTION WEBHOOK] Firestore atualizado: Conectado para ${companyId}.`);
      } else if (state === 'close') {
        await companyRef.update({ whatsappConnected: false });
        console.log(`[EVOLUTION WEBHOOK] Firestore atualizado: Desconectado para ${companyId}.`);
      }
    } catch(error) {
      console.error(`[EVOLUTION WEBHOOK] Erro ao atualizar status para ${companyId}:`, error);
    }
    return;
  }

  if (eventData.event === 'messages.upsert') {
    try {
      const messageData = eventData.data;
      const isFromMe = messageData.key.fromMe;
      const contactNumber = messageData.key.remoteJid.split('@')[0];
      const messageDetails = messageData.message;
      
      const contactName = messageData.pushName || contactNumber;
      
      // const companyId = '3bHx7UfBFve1907kwqqT'; // <-- REMOVIDO
      
      // 3. USA O 'companyId' DINÂMICO
      const leadsRef = db.collection('companies').doc(companyId).collection('leads');
      const leadQuery = await leadsRef.where('phone', '==', contactNumber).get();

      let leadDocRef, leadId;
      let messageToSave = {
        from: isFromMe ? 'me' : 'contact',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      if (messageDetails?.imageMessage || messageDetails?.audioMessage || messageDetails?.videoMessage || messageDetails?.documentMessage || messageDetails?.stickerMessage) {
        
        // 4. PASSA O 'companyId' DINÂMICO PARA A FUNÇÃO DE UPLOAD (Exige a Correção 3)
        const mediaInfo = await handleMediaUpload(messageData, companyId); 
        
        if (mediaInfo) {
          messageToSave.mediaUrl = mediaInfo.mediaUrl;
          messageToSave.mediaType = mediaInfo.mediaType;
          messageToSave.text = `[${mediaInfo.mediaType.charAt(0).toUpperCase() + mediaInfo.mediaType.slice(1)}]`;
        } else {
          messageToSave.text = '[Erro ao processar mídia]';
        }
      } else if (messageDetails?.conversation || messageDetails?.extendedTextMessage) {
        messageToSave.text = messageDetails.conversation || messageDetails.extendedTextMessage.text;
      } else {
        messageToSave.text = '[Mensagem não suportada]';
      }

      if (leadQuery.empty && !isFromMe) {
        const newLead = await leadsRef.add({
          name: contactName,
          phone: contactNumber,
          status: 'Em Contato',
          lastMessage: messageToSave.text,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          dateCreated: admin.firestore.FieldValue.serverTimestamp(),
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
          name: contactName,
          lastMessage: messageToSave.text,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        return;
      }

      const messagesRef = leadDocRef.collection('messages');
      await messagesRef.add(messageToSave);
      console.log(`[EVOLUTION WEBHOOK] Mensagem de '${messageToSave.from}' salva para o lead ${leadId} (Empresa: ${companyId})`);

    } catch (error) {
      console.error(`[EVOLUTION WEBHOOK] Erro ao processar mensagem (upsert) para ${companyId}:`, error);
    }
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

app.post('/api/analise/gemini', async (req, res) => {
    const { textToAnalyze } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'Chave de API do Gemini não configurada.' });
    if (!textToAnalyze) return res.status(400).json({ error: 'Nenhum texto para analisar foi fornecido.' });

    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
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

  console.log('[AUTOMATION] Iniciando execução das automações...');
  const companyId = '3bHx7UfBFve1907kwqqT';

  try {
    const companyRef = db.collection('companies').doc(companyId);
    const automationLogsRef = companyRef.collection('automation_logs'); 
    
    const automationsRef = companyRef.collection('automations');
    const qAutomations = automationsRef.where('isActive', '==', true);
    const automationsSnapshot = await qAutomations.get();

    if (automationsSnapshot.empty) {
      console.log('[AUTOMATION] Nenhuma regra de automação ativa para executar.');
      return res.status(200).send('Nenhuma regra de automação ativa encontrada.');
    }

    const companyData = (await companyRef.get()).data();
    const { whatsappAccessToken: accessToken, whatsappPhoneNumberId: fromPhoneNumberId } = companyData;

    if (!accessToken || !fromPhoneNumberId) {
      console.error(`[AUTOMATION] Credenciais do WhatsApp não encontradas para a empresa ${companyId}. Abortando.`);
      await automationLogsRef.add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ruleName: 'Verificação Geral',
        status: 'Falha Crítica',
        details: `As credenciais do WhatsApp não foram encontradas. A execução foi abortada.`
      });
      return res.status(500).send('Credenciais do WhatsApp não configuradas.');
    }

    for (const ruleDoc of automationsSnapshot.docs) {
      const rule = ruleDoc.data();
      console.log(`[AUTOMATION] Processando regra: "${rule.name}"`);

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
          console.log(`[AUTOMATION] Nenhum lead encontrado para a regra "${rule.name}".`);
          continue;
        }

        console.log(`[AUTOMATION] ${leadsSnapshot.size} leads encontrados para a regra "${rule.name}". Disparando ações...`);

        for (const leadDoc of leadsSnapshot.docs) {
          const lead = leadDoc.data();
          
          try {
            if (!lead.phoneNumber) {
              throw new Error('Lead sem número de telefone.');
            }
  
            const message = messageTemplate.replace(/\[Nome do Lead\]/g, lead.name);
            
            const url = `https://graph.facebook.com/v19.0/${fromPhoneNumberId}/messages`;
            const data = {
              messaging_product: 'whatsapp', to: lead.phoneNumber, type: 'text',
              text: { preview_url: false, body: message },
            };
            const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
            
            await axios.post(url, data, { headers });
            
            await automationLogsRef.add({
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              ruleId: ruleDoc.id, ruleName: rule.name, leadId: leadDoc.id, leadName: lead.name,
              status: 'Sucesso',
              details: `Mensagem de automação enviada para ${lead.name} (${lead.phoneNumber}).`
            });
            console.log(`[AUTOMATION LOG] Sucesso: Mensagem enviada para ${lead.name}.`);
            
            await leadDoc.ref.update({ timestamp: admin.firestore.FieldValue.serverTimestamp() });

          } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            await automationLogsRef.add({
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              ruleId: ruleDoc.id, ruleName: rule.name, leadId: leadDoc.id, leadName: lead.name || 'Nome não encontrado',
              status: 'Falha',
              details: `Erro ao processar ação: ${errorMessage}`
            });
            console.error(`[AUTOMATION LOG] Falha ao processar ${lead.name || leadDoc.id}: ${errorMessage}`);
          }
        }
      }
    }

    console.log('[AUTOMATION] Execução das automações concluída.');
    res.status(200).send('Automações executadas com sucesso.');

  } catch (error) {
    console.error('[AUTOMATION] Erro geral ao executar automações:', error);
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
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  try {
    console.log('[CRON DIÁRIO] Iniciando snapshot de performance diária...');
    const companiesRef = db.collection('companies').doc(companyId);
    
    const columnsDocRef = companiesRef.collection('kanban_settings').doc('columns');
    const columnsDoc = await columnsDocRef.get();
    if (!columnsDoc.exists) {
      throw new Error('Configuração de colunas não encontrada.');
    }
    
    const positiveConclusionStatusNames = columnsDoc.data().list
      .filter(c => c.type === 'positive_conclusion')
      .map(c => c.name);

    const leadsRef = companiesRef.collection('leads');
    let todaysQualifiedCount = 0;
    if (positiveConclusionStatusNames.length > 0) {
      const qQualified = leadsRef
        .where('qualificationDate', '>=', startOfDay)
        .where('qualificationDate', '<', endOfDay)
        .where('status', 'in', positiveConclusionStatusNames);

      const qualifiedSnapshot = await qQualified.get();
      todaysQualifiedCount = qualifiedSnapshot.size;
    }
    
    const qNew = leadsRef.where('dateCreated', '>=', startOfDay).where('dateCreated', '<', endOfDay);
    const newLeadsSnapshot = await qNew.get();
    const todaysNewLeadsCount = newLeadsSnapshot.size;

    console.log(`[CRON DIÁRIO] Leads Captados Hoje: ${todaysNewLeadsCount}`);
    console.log(`[CRON DIÁRIO] Leads Qualificados Hoje (Status Final): ${todaysQualifiedCount}`);

    const performanceRef = companiesRef.collection('daily_performance').doc(startOfDay.toISOString().slice(0, 10));
    await performanceRef.set({
      date: admin.firestore.FieldValue.serverTimestamp(),
      qualifiedCount: todaysQualifiedCount,
      newLeadsCount: todaysNewLeadsCount
    });

    console.log('[CRON DIÁRIO] Snapshot de performance diária concluído com sucesso.');
    res.status(200).send('Snapshot concluído com sucesso.');

  } catch (error) {
    console.error('[CRON DIÁRIO] Erro ao executar o snapshot diário:', error);
    res.status(500).send('Erro no servidor ao executar snapshot.');
  }
});

app.post('/api/perform-monthly-snapshot', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.CRON_JOB_SECRET) {
    return res.status(401).send('Acesso não autorizado.');
  }

  const companyId = '3bHx7UfBFve1907kwqqT'; 

  try {
    console.log('[CRON MENSAL] Iniciando snapshot de performance MENSAL...');
    
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth);
    lastDayOfPreviousMonth.setDate(lastDayOfPreviousMonth.getDate() - 1);

    const year = lastDayOfPreviousMonth.getFullYear();
    const month = lastDayOfPreviousMonth.getMonth();

    const firstDayOfPreviousMonth = new Date(year, month, 1);
    const docId = `${year}-${String(month + 1).padStart(2, '0')}`;
    console.log(`[CRON MENSAL] Agregando dados para o período de: ${docId}`);

    const dailyPerformanceRef = db.collection('companies').doc(companyId).collection('daily_performance');
    const q = dailyPerformanceRef
      .where('date', '>=', firstDayOfPreviousMonth)
      .where('date', '<=', lastDayOfPreviousMonth);
    const dailySnapshots = await q.get();

    if (dailySnapshots.empty) {
      console.log(`[CRON MENSAL] Nenhum dado diário encontrado para ${docId}. Encerrando.`);
      return res.status(200).send(`Nenhum dado diário para agregar em ${docId}.`);
    }

    let totalQualifiedInMonth = 0;
    let totalNewLeadsInMonth = 0;
    dailySnapshots.forEach(doc => {
      totalQualifiedInMonth += doc.data().qualifiedCount || 0;
      totalNewLeadsInMonth += doc.data().newLeadsCount || 0;
    });
    console.log(`[CRON MENSAL] Total de Leads Captados no mês: ${totalNewLeadsInMonth}`);
    console.log(`[CRON MENSAL] Total de Leads Qualificados no mês: ${totalQualifiedInMonth}`);

    const monthlyPerformanceRef = db.collection('companies').doc(companyId).collection('monthly_performance').doc(docId);
    await monthlyPerformanceRef.set({
      year: year,
      month: month + 1,
      totalQualifiedCount: totalQualifiedInMonth,
      totalNewLeadsInMonth: totalNewLeadsInMonth,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[CRON MENSAL] Snapshot de performance mensal para ${docId} concluído com sucesso.`);
    res.status(200).send(`Snapshot mensal para ${docId} concluído.`);

  } catch (error) {
    console.error('[CRON MENSAL] Erro ao executar o snapshot mensal:', error);
    res.status(500).send('Erro no servidor ao executar snapshot mensal.');
  }
});

// =================================================================================
// --- INICIALIZAÇÃO DO SERVIDOR ---
// =================================================================================
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});