// WhatsappPage.js (VERSÃO FINAL - FASE 2 COMPLETA)

import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebaseConfig';
import { onSnapshot, collection, orderBy, query, doc, updateDoc } from 'firebase/firestore'; // Adicionado updateDoc
import { CheckCircle, MessageSquare, Send, MoreVertical, Archive, Zap, LogOut, Loader2, Search, QrCode } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const getInitials = (name) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return '#'; // Retorna '#' se o nome for inválido
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

// NOVO COMPONENTE PARA RENDERIZAR CADA "BALÃO" DE MENSAGEM
const MessageBubble = ({ message }) => {
  // Função para renderizar o conteúdo da mensagem
  const renderContent = () => {
    if (message.mediaUrl) {
      switch (message.mediaType) {
        case 'image':
          return <img src={message.mediaUrl} alt="Imagem enviada" className="rounded-lg max-w-xs" />;
        case 'audio':
          return <audio controls src={message.mediaUrl} className="w-64" />;
        case 'video':
          return <video controls src={message.mediaUrl} className="rounded-lg max-w-xs" />;
        case 'document':
          return (
            <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center bg-gray-200 p-3 rounded-lg hover:bg-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>{message.text || 'Baixar documento'}</span>
            </a>
          );
        default:
          return <p className="text-sm text-gray-800">{message.text}</p>;
      }
    }
    // Se não for mídia, apenas retorna o texto
    return <p className="text-sm text-gray-800">{message.text}</p>;
  };

  const isFromMe = message.from === 'me';
  const timestamp = message.timestamp ? format(message.timestamp.toDate(), 'HH:mm') : '';

  return (
    <div className={`flex my-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`py-2 px-3 rounded-xl max-w-md shadow-sm ${isFromMe ? 'bg-emerald-200' : 'bg-white'}`}>
        {renderContent()}
        <p className={`text-xs mt-1 text-right ${isFromMe ? 'text-green-800 opacity-60' : 'text-gray-400'}`}>
          {timestamp}
        </p>
      </div>
    </div>
  );
};


const WhatsappPage = ({ companyId, conversations: initialConversations, onArchiveLead }) => {
  // ... (todos os outros estados permanecem os mesmos) ...
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState(initialConversations);
  const [qrCode, setQrCode] = useState(null);
  const [isLoadingQrCode, setIsLoadingQrCode] = useState(false);
  const chatEndRef = useRef(null);

  // ... (useEffect para searchTerm e messages permanece o mesmo) ...
  useEffect(() => {
    setConversations(
      initialConversations.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, initialConversations]);

  useEffect(() => {
    if (!companyId) return;
    const companyRef = doc(db, "companies", companyId);
    const unsubscribe = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().whatsappConnected) {
        setIsConnected(true);
        setQrCode(null); // Limpa o QR Code quando a conexão é estabelecida
      } else {
        setIsConnected(false);
      }
    });
    return () => unsubscribe();
  }, [companyId]);
  
  useEffect(() => {
    if (!companyId || !selectedConversation) {
      setMessages([]);
      return;
    };
    const messagesRef = collection(db, "companies", companyId, "leads", selectedConversation.id, "messages");
    const q = query(messagesRef, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
    });
    return () => unsubscribe();
  }, [companyId, selectedConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // NOVO useEffect PARA VERIFICAÇÃO DE STATUS (POLLING)
  useEffect(() => {
    // Se não temos um QR Code na tela ou se já estamos conectados, não faz nada
    if (!qrCode || isConnected) {
      return;
    }

    // A cada 3 segundos, verifica o status da conexão
    const intervalId = setInterval(async () => {
      console.log("Verificando status da conexão...");
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();

        const response = await axios.get(
          `${BACKEND_URL}/api/evolution/instance/status/CRM_V1`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { companyId: companyId }
          }
        );

        // O backend já atualiza o Firestore. O onSnapshot listener vai cuidar de mudar o estado 'isConnected'
        if (response.data.status === 'CONNECTED') {
          console.log("Conexão detectada! Parando a verificação.");
          toast.success("WhatsApp conectado com sucesso!");
          clearInterval(intervalId); // Para de verificar
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
      }
    }, 3000); // Verifica a cada 3 segundos

    // Limpa o intervalo quando o componente é desmontado ou o QR Code some
    return () => clearInterval(intervalId);

  }, [qrCode, isConnected, companyId]); // Roda este efeito quando o qrCode, isConnected ou companyId mudam

  // ... (a função fetchQrCode permanece a mesma da última vez) ...
  const fetchQrCode = async () => {
    setIsLoadingQrCode(true);
    setQrCode(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado.");
      const token = await user.getIdToken();
  
      const response = await axios.get(
        `${BACKEND_URL}/api/evolution/instance/qr/CRM_V1`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { companyId: companyId }
        }
      );
      
      if (response.data.qrCodeBase64) {
        setQrCode(response.data.qrCodeBase64);
      } else {
        toast.error("Não foi possível gerar o QR Code. A instância já pode estar conectada.");
      }
  
    } catch (error) {
      console.error("Erro ao buscar QR Code:", error);
      toast.error("Falha ao buscar QR Code. Verifique o console.");
    } finally {
      setIsLoadingQrCode(false);
    }
  };

  const handleSendMessage = async (e) => { e.preventDefault(); if (!newMessage.trim() || !selectedConversation) return; setIsSending(true); const tempMessage = newMessage; setNewMessage(''); try { const user = auth.currentUser; if (!user) { throw new Error("Usuário não autenticado."); } const token = await user.getIdToken(); const apiPayload = { recipientId: selectedConversation.phone, message: tempMessage, companyId: companyId, leadId: selectedConversation.id }; const config = { headers: { Authorization: `Bearer ${token}` } }; await axios.post(`${BACKEND_URL}/api/evolution/send-message`, apiPayload, config); } catch (error) { console.error('❌ Erro ao enviar mensagem:', error); toast.error('Falha ao enviar a mensagem.'); setNewMessage(tempMessage); } finally { setIsSending(false); } };
  const handleArchiveConversation = (leadId) => { if (window.confirm('Tem certeza que deseja arquivar esta conversa?')) { onArchiveLead(leadId); setSelectedConversation(null); setActiveMenu(null); } };
  const handleDisconnect = async () => {
    if (window.confirm("Tem certeza que deseja desconectar? Isso exigirá um novo QR Code.")) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Usuário não autenticado.");
            const token = await user.getIdToken();

            // Chama a nova rota de logout no backend
            await axios.post(
              `${BACKEND_URL}/api/evolution/instance/logout`,
              { 
                instanceName: 'CRM_V1', // Usando nossa instância fixa por enquanto
                companyId: companyId 
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Desconectado com sucesso!");
            // O listener do onSnapshot já vai atualizar o estado isConnected para false
            // quando o updateDoc do backend for executado, então não precisamos fazer mais nada.
            
        } catch (error) {
            console.error("Erro ao desconectar:", error)
            toast.error("Erro ao desconectar. Verifique o console.");
        }
    }
};

  // --- O restante do arquivo é idêntico ao que te mandei da última vez ---
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center bg-white p-12 rounded-xl shadow-lg max-w-lg">
          <Zap size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Conecte sua conta do WhatsApp</h2>
          <p className="text-gray-600 mb-6">Clique no botão abaixo para gerar um QR Code e escaneie com o aplicativo do WhatsApp no seu celular.</p>

          {isLoadingQrCode && <Loader2 className="h-12 w-12 mx-auto animate-spin text-indigo-500" />}

          {qrCode && !isLoadingQrCode && (
            <div className="bg-white p-4 rounded-lg border my-4 flex justify-center items-center">
              <img src={qrCode} alt="QR Code do WhatsApp" />
            </div>
          )}

          {!qrCode && !isLoadingQrCode && (
            <button onClick={fetchQrCode} className="bg-green-500 text-white font-bold px-8 py-3 rounded-lg hover:bg-green-600 transition-colors w-full flex items-center justify-center">
              <QrCode className="mr-2" />
              Gerar QR Code para Conexão
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="w-full md:w-[35%] lg:w-[30%] border-r border-gray-200 flex flex-col min-h-0">
        <header className="p-3 border-b border-gray-200 flex-shrink-0 flex justify-between items-center bg-gray-100">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-gray-600">EU</div>
          <div className="relative">
            <button onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)} onBlur={() => setTimeout(() => setIsStatusMenuOpen(false), 150)} className="p-2 rounded-full hover:bg-gray-200">
              <MoreVertical size={20} className="text-gray-600" />
            </button>
            {isStatusMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                <div className="px-4 py-3 text-sm text-green-700 border-b flex items-center"><CheckCircle size={16} className="mr-2" />Conectado</div>
                <button onClick={handleDisconnect} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                  <LogOut size={16} className="mr-2" />
                  Desconectar
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="p-2 bg-gray-50 border-b border-gray-200">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar ou começar uma nova conversa"
              className="w-full bg-gray-200 rounded-lg py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
          {conversations.map(conv => (
            <div key={conv.id} onClick={() => setSelectedConversation(conv)} className={`flex items-center p-3 cursor-pointer border-b border-gray-100 ${selectedConversation?.id === conv.id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
              <div className="w-12 h-12 rounded-full bg-indigo-500 text-white flex-shrink-0 flex items-center justify-center font-bold text-xl mr-3">
                {getInitials(conv.name)}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 truncate">{conv.name || conv.phone}</span>
                  <span className="text-xs text-gray-500">{conv.timestamp ? format(conv.timestamp.toDate(), 'HH:mm') : ''}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full md:w-[65%] lg:w-[70%] flex flex-col bg-slate-100">
        {selectedConversation ? (
          <>
            <header className="p-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between bg-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex-shrink-0 flex items-center justify-center font-bold text-lg mr-3">
                  {getInitials(selectedConversation.name)}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{selectedConversation.name || selectedConversation.phone}</div>
                  <div className="text-xs text-gray-500">{selectedConversation.phone}</div>
                </div>
              </div>
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === selectedConversation.id ? null : selectedConversation.id); }} onBlur={() => setTimeout(() => setActiveMenu(null), 150)} className="p-2 rounded-full hover:bg-gray-200">
                  <MoreVertical size={20} className="text-gray-600" />
                </button>
                {activeMenu === selectedConversation.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                    <button onClick={(e) => { e.stopPropagation(); handleArchiveConversation(selectedConversation.id); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                      <Archive size={16} className="mr-2" />Arquivar Conversa
                    </button>
                  </div>
                )}
              </div>
            </header>
            <main className="flex-grow h-0 overflow-y-auto p-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={chatEndRef} />
            </main>
            <footer className="p-4 bg-gray-100 border-t border-gray-200 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center">
                <input type="text" placeholder="Digite uma mensagem..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 p-3 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={isSending} />
                <button type="submit" className="bg-indigo-600 text-white p-3 rounded-full ml-3 hover:bg-indigo-700 disabled:bg-indigo-400" disabled={isSending || !newMessage.trim()}>
                  {isSending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send size={24} />}
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <MessageSquare size={56} className="mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700">Selecione uma conversa</h2>
            <p>Comece a interagir com seus leads diretamente por aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsappPage;