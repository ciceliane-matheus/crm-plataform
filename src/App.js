import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MessageCircle,
  TrendingUp,
  Mail,
  Menu,
  X,
  Plus,
  Send,
  Loader2,
  AlertCircle,
  Clock,
  User,
  CheckCircle,
  Download,
  FileText,
  Edit,
  Trash2,
  List,
  ChevronRight,
  MessageSquare,
  ChevronLeft,
  Briefcase,
  AtSign,
  Phone,
  Book,
  Check,
  QrCode
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

// --- CONFIGURAÇÕES E VARIÁVEIS GLOBAIS ---
// As variáveis globais são fornecidas automaticamente pelo ambiente.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const API_KEY = ""; // A chave da API é definida em tempo de execução
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

// Inicialização do Firebase
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
}

// --- FUNÇÕES UTILITÁRIAS ---
// Função para chamar a API do Gemini com backoff exponencial
/**
 * @param {string} prompt O texto do prompt para a API.
 * @returns {Promise<string>} A resposta gerada pela IA ou uma mensagem de erro.
 */
async function callGeminiApi(prompt) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  let attempts = 0;
  const maxAttempts = 5;
  const baseDelay = 1000;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_URL}?key=${API_KEY}`, requestOptions);
      if (response.status === 429) {
        const delay = baseDelay * Math.pow(2, attempts);
        await new Promise(res => setTimeout(res, delay));
        attempts++;
        continue;
      }
      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      
    } catch (error) {
      const delay = baseDelay * Math.pow(2, attempts);
      await new Promise(res => setTimeout(res, delay));
      attempts++;
    }
  }
  return "Ops! Ocorreu um erro e não conseguimos nos conectar à IA. Por favor, tente novamente mais tarde.";
}

// --- COMPONENTES DA INTERFACE ---

// Componente da barra lateral com navegação
const Sidebar = ({ onSignOut, activeTab, setActiveTab }) => {
  const pages = [
    { id: 'dashboard', name: 'Visão Geral', icon: TrendingUp },
    { id: 'leads', name: 'Qualificação de Leads', icon: List },
    { id: 'automacao', name: 'Automação', icon: Mail },
    { id: 'whatsapp', name: 'WhatsApp Corporativo', icon: MessageSquare }
  ];

  return (
    <aside className="w-64 bg-gray-900 text-gray-200 h-screen p-6 hidden md:block fixed left-0 top-0">
      <h1 className="text-xl font-bold mb-8 text-white">
        Fluxo<span className="text-indigo-500">Connect</span>
      </h1>
      <nav>
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => setActiveTab(page.id)}
            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors mb-2 ${
              activeTab === page.id
                ? 'bg-indigo-600 text-white font-semibold'
                : 'hover:bg-gray-800'
            }`}
          >
            <page.icon className="h-5 w-5 mr-3" />
            <span>{page.name}</span>
          </button>
        ))}
      </nav>
      <div className="absolute bottom-6 left-6 right-6">
        <button
          onClick={onSignOut}
          className="flex items-center w-full bg-gray-800 p-3 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors duration-200"
        >
          <User className="w-8 h-8 mr-3 text-gray-400" />
          <div className="text-sm text-left">
            <p className="font-semibold text-gray-100">Sair</p>
            <p className="text-gray-400">Clique para sair</p>
          </div>
        </button>
      </div>
    </aside>
  );
};

// Componente do menu mobile
const MobileMenu = ({ isMobileMenuOpen, setIsMobileMenuOpen, setActiveTab, onSignOut }) => {
  const pages = [
    { id: 'dashboard', name: 'Visão Geral', icon: TrendingUp },
    { id: 'leads', name: 'Qualificação de Leads', icon: List },
    { id: 'automacao', name: 'Automação', icon: Mail },
    { id: 'whatsapp', name: 'WhatsApp Corporativo', icon: MessageSquare }
  ];
  return (
    <div className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-gray-200 p-6 z-50 transform transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-white">
          Fluxo<span className="text-indigo-500">Connect</span>
        </h1>
        <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>
      <nav>
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => {
              setActiveTab(page.id);
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors mb-2 hover:bg-gray-800`}
          >
            <page.icon className="h-5 w-5 mr-3" />
            <span>{page.name}</span>
          </button>
        ))}
      </nav>
      <div className="absolute bottom-6 left-6 right-6">
        <button
          onClick={() => { onSignOut(); setIsMobileMenuOpen(false); }}
          className="flex items-center w-full bg-gray-800 p-3 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors duration-200"
        >
          <User className="w-8 h-8 mr-3 text-gray-400" />
          <div className="text-sm text-left">
            <p className="font-semibold text-gray-100">Sair</p>
            <p className="text-gray-400">Clique para sair</p>
          </div>
        </button>
      </div>
    </div>
  );
};

// Componente da página principal (Dashboard)
const Dashboard = ({ leads }) => {
  const totalLeads = leads.length;
  const qualificados = leads.filter(l => l.status === 'Qualificado').length;
  const emContato = leads.filter(l => l.status === 'Em Contato').length;
  const naoQualificados = leads.filter(l => l.status === 'Não Qualificado').length;
  const taxaConversao = totalLeads > 0 ? ((qualificados / totalLeads) * 100).toFixed(2) : 0;

  const data = [
    { name: 'Jan', qualificados: 15, naoQualificados: 5 },
    { name: 'Fev', qualificados: 20, naoQualificados: 8 },
    { name: 'Mar', qualificados: 25, naoQualificados: 10 },
    { name: 'Abr', qualificados: 30, naoQualificados: 12 },
    { name: 'Mai', qualificados: 40, naoQualificados: 15 },
    { name: 'Jun', qualificados: 35, naoQualificados: 13 },
  ];

  const recentLeads = leads.slice(0, 5);

  const handleExportLeads = () => {
    const headers = ["Nome", "Email", "Status", "Data de Criação"];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + recentLeads.map(e => [e.name, e.email, e.status, e.dateCreated].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_leads_fluxoconnect.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Visão Geral do Negócio</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500 flex items-center">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mr-4">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Leads Qualificados</h3>
            <p className="text-3xl font-bold text-indigo-600">{qualificados}</p>
            <p className="text-sm text-gray-500 mt-1">Total de leads qualificados</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Total de Leads</h3>
            <p className="text-3xl font-bold text-green-600">{totalLeads}</p>
            <p className="text-sm text-gray-500 mt-1">Leads totais na plataforma</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 flex items-center">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full mr-4">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Taxa de Conversão</h3>
            <p className="text-3xl font-bold text-yellow-600">{taxaConversao}%</p>
            <p className="text-sm text-gray-500 mt-1">De leads para qualificados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Qualificação de Leads por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qualificados" name="Qualificados" fill="#4f46e5" radius={[10, 10, 0, 0]} />
              <Bar dataKey="naoQualificados" name="Não Qualificados" fill="#9ca3af" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Taxa de Conversão</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="qualificados" name="Leads Qualificados" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Relatório de Leads Recentes</h3>
          <button
            onClick={handleExportLeads}
            className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar CSV
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Nome </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Email </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Status </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Data de Criação </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentLeads.map((lead, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <User size={20} className="text-gray-400 mr-2" />
                    {lead.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    lead.status === 'Qualificado' ? 'bg-green-100 text-green-800' :
                    lead.status === 'Em Contato' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock size={16} className="text-gray-400 mr-1" />
                    {lead.dateCreated}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Componente da página de Leads (KanbanBoard)
const KanbanBoard = ({ leads, setLeads }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [leadToRemove, setLeadToRemove] = useState(null);

  const columns = [
    { id: 'Em Contato', title: 'Em Contato', color: 'bg-yellow-100' },
    { id: 'Qualificado', title: 'Qualificado', color: 'bg-green-100' },
    { id: 'Não Qualificado', title: 'Não Qualificado', color: 'bg-gray-100' },
  ];

  const handleDragStart = (e, lead) => {
    setDraggedItem(lead);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    if (draggedItem) {
      const updatedLeads = leads.map(lead =>
        lead.id === draggedItem.id ? { ...lead, status } : lead
      );
      setLeads(updatedLeads);
      setDraggedItem(null);
    }
  };

  const openLeadModal = (lead) => {
    setSelectedLead(lead);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLead(null);
  };

  const confirmRemove = async () => {
    if (leadToRemove) {
      await onRemoveLead(leadToRemove.id);
      setLeads(leads.filter(lead => lead.id !== leadToRemove.id));
      setShowConfirmation(false);
      setLeadToRemove(null);
      if (showModal) closeModal();
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Qualificação de Leads (Kanban)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {columns.map(column => (
          <div
            key={column.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`p-4 rounded-xl shadow-lg border-2 border-dashed ${column.color}`}
          >
            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
              <span className={`h-3 w-3 rounded-full mr-2 ${
                column.id === 'Qualificado' ? 'bg-green-500' :
                column.id === 'Em Contato' ? 'bg-yellow-500' :
                'bg-gray-500'
              }`}></span>
              {column.title}
              <span className="ml-auto text-sm bg-gray-200 px-2 py-1 rounded-full">{leads.filter(l => l.status === column.id).length}</span>
            </h3>
            <div className="space-y-4 min-h-[200px]">
              {leads.filter(lead => lead.status === column.id).map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  onClick={() => openLeadModal(lead)}
                  className="bg-white p-4 rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-shadow"
                >
                  <p className="font-semibold text-gray-900">{lead.name}</p>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <AtSign size={14} className="mr-1" />
                    {lead.email}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <Briefcase size={14} className="mr-1" />
                    {lead.company}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[50] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{selectedLead.name}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-lg mb-2 text-gray-800">Detalhes do Lead</h4>
                <div className="space-y-2 text-gray-600 text-sm">
                  <p className="flex items-center"><User size={16} className="mr-2 text-gray-400" /> {selectedLead.role} em {selectedLead.company}</p>
                  <p className="flex items-center"><AtSign size={16} className="mr-2 text-gray-400" /> {selectedLead.email}</p>
                  <p className="flex items-center"><Phone size={16} className="mr-2 text-gray-400" /> {selectedLead.phone}</p>
                  <p className="flex items-center"><List size={16} className="mr-2 text-gray-400" /> Status: <span className={`ml-1 font-semibold ${
                    selectedLead.status === 'Qualificado' ? 'text-green-500' :
                    selectedLead.status === 'Em Contato' ? 'text-yellow-500' :
                    'text-gray-500'
                  }`}>{selectedLead.status}</span></p>
                  <p className="flex items-center"><Clock size={16} className="mr-2 text-gray-400" /> Criado em: {selectedLead.dateCreated}</p>
                  <p className="flex items-center"><Book size={16} className="mr-2 text-gray-400" /> Segmento: {selectedLead.businessSegment}</p>
                  <p className="text-sm font-semibold mt-4">Próximos Passos:</p>
                  <p className="text-sm text-gray-600">{selectedLead.details.nextSteps}</p>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      setLeadToRemove(selectedLead);
                      setShowConfirmation(true);
                    }}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors flex items-center"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Remover Lead
                  </button>
                  <button className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 transition-colors flex items-center">
                    <Edit size={16} className="mr-2" />
                    Editar
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                <h4 className="font-bold text-lg mb-2 text-gray-800">Chat & Anotações</h4>
                <div className="flex-1 overflow-y-auto chat-container space-y-4 p-4 bg-gray-50 rounded-xl mb-4 h-64">
                  {/* Este é um placeholder, a funcionalidade real exigiria outra API */}
                  <p className="text-center text-gray-500">Histórico de conversa e anotações apareceriam aqui.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Adicionar anotação..."
                    className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <AlertCircle size={48} className="text-red-500" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Confirmar Remoção</h4>
              <p className="text-gray-600 mb-6">Tem certeza que deseja remover este lead? Esta ação é irreversível.</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemove}
                  className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente da página de Automação
const AutomationPage = () => {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Automação de Follow-up</h2>
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <p className="text-gray-600 text-center">
          Aqui você pode configurar automações para enviar e-mails e mensagens para seus leads.
          A funcionalidade completa exige integração com serviços de e-mail e mensageria.
        </p>
      </div>
    </div>
  );
};

// Componente da página de WhatsApp Corporativo
const WhatsAppPage = () => {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-md text-center">
      <h2 className="text-2xl font-bold mb-4">Conectar WhatsApp Corporativo</h2>
      <p className="text-gray-600 mb-6">Leia o QR Code com o seu celular para conectar o WhatsApp da sua empresa à plataforma e habilitar a automação.</p>
      
      <div className="inline-block p-4 border-4 border-gray-200 rounded-2xl">
        <QrCode className="w-48 h-48 text-gray-300" />
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-bold text-gray-800">Pronto para Conectar?</h3>
        <p className="text-gray-500 mt-2">Clique no botão abaixo para gerar um QR Code de conexão.</p>
        <button className="mt-4 flex items-center justify-center mx-auto bg-green-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-green-600 transition-colors duration-200">
          <MessageSquare className="w-5 h-5 mr-2" /> Gerar QR Code
        </button>
      </div>

      <div className="mt-8 text-left p-4 bg-yellow-50 rounded-xl border border-yellow-200">
        <h4 className="font-semibold text-yellow-800 mb-2">Importante: Sobre a Funcionalidade</h4>
        <p className="text-sm text-yellow-700">Esta é uma simulação da interface. A integração real com o WhatsApp Business API exige uma infraestrutura de backend complexa e um servidor para gerar e gerenciar o QR Code. Em uma aplicação de produção, esta tela se conectaria a um servidor que faz a ponte com a API do WhatsApp. O que você vê aqui é a tela de usuário, pronta para receber a funcionalidade.</p>
      </div>
    </div>
  );
};

// Componente de Login
const LoginScreen = ({ onLogin, onRegister, loading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegistering) {
      onRegister(email, password);
    } else {
      onLogin(email, password);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-3xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <Sparkles className="mx-auto text-indigo-600 w-12 h-12" />
          <h1 className="text-2xl font-bold mt-4">Bem-vindo(a) ao FluxoConnect</h1>
          <p className="text-gray-500">Faça login para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail corporativo"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          {isRegistering ? (
            <p>Já tem uma conta? <span className="text-indigo-600 cursor-pointer hover:underline" onClick={() => setIsRegistering(false)}>Faça login</span></p>
          ) : (
            <p>Ainda não tem uma conta? <span className="text-indigo-600 cursor-pointer hover:underline" onClick={() => setIsRegistering(true)}>Crie uma agora</span></p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL (Autenticado) ---
const AuthenticatedApp = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // O Company ID é o UID do usuário, para um modelo de um usuário por empresa
  const companyId = user.uid;

  // Função para adicionar cliente/lead ao Firestore
  const handleAddLead = async (leadData) => {
    if (!db || !companyId) return;
    try {
      const leadsCollectionRef = collection(db, `artifacts/${appId}/companies/${companyId}/leads`);
      await addDoc(leadsCollectionRef, {
        ...leadData,
        dateCreated: new Date().toISOString().split('T')[0],
      });
    } catch (e) {
      console.error("Erro ao adicionar lead: ", e);
    }
  };

  // Função para remover cliente/lead do Firestore
  const handleRemoveLead = async (leadId) => {
    if (!db || !companyId) return;
    try {
      const leadDocRef = doc(db, `artifacts/${appId}/companies/${companyId}/leads/${leadId}`);
      await deleteDoc(leadDocRef);
    } catch (e) {
      console.error("Erro ao remover lead: ", e);
    }
  };

  // Efeito para carregar os leads do Firestore
  useEffect(() => {
    if (!db || !companyId) {
      setLoadingLeads(false);
      return;
    }
    
    // Adiciona um listener para atualizações em tempo real
    const leadsCollectionRef = collection(db, `artifacts/${appId}/companies/${companyId}/leads`);
    
    const unsubscribe = onSnapshot(leadsCollectionRef, (snapshot) => {
      const leadsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeads(leadsList);
      setLoadingLeads(false);
    }, (error) => {
      console.error("Erro ao buscar leads: ", error);
      setLoadingLeads(false);
    });

    // Limpa o listener quando o componente é desmontado
    return () => unsubscribe();
  }, [db, companyId]);

  // Renderiza a página atual com base no estado
  const renderPage = () => {
    if (loadingLeads) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
        </div>
      );
    }
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard leads={leads} />;
      case 'leads':
        return <KanbanBoard leads={leads} setLeads={setLeads} onRemoveLead={handleRemoveLead} />;
      case 'automacao':
        return <AutomationPage />;
      case 'whatsapp':
        return <WhatsAppPage />;
      default:
        return <Dashboard leads={leads} />;
    }
  };

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <Sidebar onSignOut={onSignOut} activeTab={activeTab} setActiveTab={setActiveTab} />
      <MobileMenu isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} setActiveTab={setActiveTab} onSignOut={onSignOut} />
      <div className="flex-1 flex flex-col md:ml-64">
        <header className="bg-white shadow-md p-4 md:hidden flex justify-between items-center sticky top-0 z-40">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            Fluxo<span className="text-indigo-500">Connect</span>
          </h1>
          <div className="w-6"></div>
        </header>
        <main className="flex-1 p-6 md:p-10 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

// --- COMPONENTE RAIZ DA APLICAÇÃO ---
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Efeito para gerenciar a autenticação
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        if (initialAuthToken) {
          try {
            await signInWithCustomToken(auth, initialAuthToken);
          } catch (e) {
            console.error("Erro no login anônimo:", e);
            setUser(null);
          }
        } else {
          await signInAnonymously(auth);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Função de Login
  const handleLogin = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Erro de login:", error);
      setAuthError("Erro ao fazer login. Verifique seu e-mail e senha.");
      setLoading(false);
    }
  };

  // Função de Registro
  const handleRegister = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUserId = userCredential.user.uid;
      // Cria um documento vazio para a nova empresa
      const companyDocRef = doc(db, `artifacts/${appId}/companies/${newUserId}`);
      await setDoc(companyDocRef, {
        createdAt: new Date().toISOString(),
      });
      setAuthError("Conta criada com sucesso! Faça o login.");
    } catch (error) {
      console.error("Erro de registro:", error);
      setAuthError("Erro ao criar conta. Tente um e-mail diferente.");
      setLoading(false);
    }
  };

  // Função de Logout
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
      </div>
    );
  }

  return (
    user ? <AuthenticatedApp user={user} onSignOut={handleSignOut} /> : <LoginScreen onLogin={handleLogin} onRegister={handleRegister} loading={loading} error={authError} />
  );
};

export default App;