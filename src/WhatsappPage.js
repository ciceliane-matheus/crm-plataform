import { useState, useEffect, useRef } from 'react';
import { db } from './firebaseConfig';
import { doc, onSnapshot, collection, addDoc, orderBy, query } from 'firebase/firestore';
import { QrCode, Loader2, CheckCircle, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const WHATSAPP_BACKEND_URL = 'http://localhost:3001/api/whatsapp';

const WhatsappPage = ({ companyId }) => {
  const [qrCode, setQrCode] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('desconectado');
  const [whatsappConversations, setWhatsappConversations] = useState([]);
  const [selectedWhatsappConversation, setSelectedWhatsappConversation] = useState(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    console.log("📡 WhatsappPage carregado. Company ID recebido:", companyId);

    if (!db || !companyId) return;

    // Sessão do WhatsApp
    const sessionRef = doc(db, "companies", companyId, "whatsapp_sessions", "main");
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("🔥 Firestore session data:", data);
        setQrCode(data.qrCode);
        setConnectionStatus(data.status);
      } else {
        console.log("⚠️ Nenhum documento encontrado em whatsapp_sessions/main");
      }
    });

    // Conversas
    const conversationsRef = collection(db, "companies", companyId, "whatsapp_conversations");
    const unsubscribeConversations = onSnapshot(conversationsRef, (snapshot) => {
      const fetchedConversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("💬 Conversas carregadas:", fetchedConversations);
      setWhatsappConversations(fetchedConversations);
    });

    return () => {
      unsubscribeSession();
      unsubscribeConversations();
    };
  }, [companyId]);

  useEffect(() => {
    if (!db || !companyId || !selectedWhatsappConversation) return;

    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "whatsapp_conversations",
      selectedWhatsappConversation.id,
      "messages"
    );
    const messagesQuery = query(messagesRef, orderBy("timestamp"));

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("📨 Mensagens carregadas:", fetchedMessages);
      setSelectedWhatsappConversation(prev => ({ ...prev, messages: fetchedMessages }));
    });

    return () => unsubscribeMessages();
  }, [companyId, selectedWhatsappConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedWhatsappConversation]);

  const startWhatsappSession = async () => {
    try {
      setConnectionStatus('carregando');
      console.log("🚀 Iniciando sessão WhatsApp para empresa:", companyId);
      await axios.post(`${WHATSAPP_BACKEND_URL}/start-session`, { companyId });
    } catch (error) {
      console.error('❌ Erro ao iniciar a sessão:', error);
      setConnectionStatus('desconectado');
    }
  };

  const handleWhatsappMessageSend = async (e) => {
    e.preventDefault();
    if (!whatsappMessage.trim() || !selectedWhatsappConversation || !db || !companyId) return;

    const messagePayload = {
      from: 'me',
      text: whatsappMessage,
      timestamp: new Date().getTime()
    };

    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "whatsapp_conversations",
      selectedWhatsappConversation.id,
      "messages"
    );
    await addDoc(messagesRef, messagePayload);

    console.log("📤 Mensagem enviada localmente:", messagePayload);
    setWhatsappMessage('');
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'qrCode': return 'Aguardando QR Code';
      case 'conectado': return 'Conectado';
      case 'desconectado': return 'Desconectado';
      case 'carregando': return 'Carregando...';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col h-full bg-gray-100">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6">Integração WhatsApp</h1>
        <div className="bg-white rounded-2xl shadow-lg p-6 flex-grow flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 border-b md:border-r md:border-b-0 pr-4 pb-4 md:pb-0 mb-4 md:mb-0">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Conexão</h3>
            <div className="space-y-4 mb-6">
              <div className={`flex items-center p-3 rounded-lg ${connectionStatus === 'conectado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {connectionStatus === 'conectado'
                  ? <CheckCircle size={20} className="mr-2" />
                  : <AlertCircle size={20} className="mr-2" />}
                <span>Status: <span className="font-semibold">{getStatusText(connectionStatus)}</span></span>
              </div>

              {/* 🔥 Botão sempre visível */}
              <button
                onClick={startWhatsappSession}
                className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
              >
                {connectionStatus === 'conectado' ? 'Reiniciar sessão' : 'Conectar WhatsApp'}
              </button>

              {connectionStatus === 'carregando' && (
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-center text-sm mt-2">Iniciando sessão...</p>
                </div>
              )}
              {qrCode && connectionStatus === 'qrCode' && (
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-center text-sm mb-2">Escaneie o QR Code com seu celular:</p>
                  <QRCodeSVG value={qrCode} size={150} />
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Conversas</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {whatsappConversations.length > 0 ? (
                whatsappConversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedWhatsappConversation(conv)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedWhatsappConversation?.id === conv.id ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
                  >
                    <div className="font-semibold">{conv.contactName}</div>
                    <div className="text-xs text-gray-500">{conv.lastMessage}</div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Nenhuma conversa encontrada.</p>
              )}
            </div>
          </div>

          <div className="w-full md:w-2/3 pl-0 md:pl-4 flex flex-col pt-4 md:pt-0">
            {selectedWhatsappConversation ? (
              <div className="flex flex-col h-full">
                <div className="flex-grow overflow-y-auto p-4 border rounded-xl bg-gray-50">
                  <div className="text-center text-gray-500 py-2 border-b mb-4">
                    <h4 className="text-lg font-bold">{selectedWhatsappConversation.contactName}</h4>
                  </div>
                  {selectedWhatsappConversation.messages && selectedWhatsappConversation.messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-xl max-w-lg my-1 ${msg.from === 'me' ? 'bg-indigo-500 text-white' : 'bg-gray-300 text-gray-800'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleWhatsappMessageSend} className="flex mt-4">
                  <input
                    type="text"
                    placeholder="Digite uma mensagem..."
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white p-3 rounded-full ml-2 hover:bg-indigo-700 transition-colors"
                  >
                    <Send size={24} />
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
                <MessageSquare size={48} className="mb-4" />
                <p>Selecione uma conversa ao lado para começar a interagir.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsappPage;