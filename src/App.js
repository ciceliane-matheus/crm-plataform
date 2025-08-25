import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
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
  QrCode,
  Wifi,
  Zap,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { v4 as uuidv4 } from 'uuid';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { io } from 'socket.io-client';

// ====================================================================================
// --- ARQUIVO DE CONFIGURAÇÃO: config/firebase.js ---
// Este código agora tem uma camada extra para permitir a entrada manual
// da configuração do Firebase caso a variável global não esteja definida.
const __app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializa o Firebase
const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

// ====================================================================================
// --- COMPONENTES AUXILIARES ---
// ====================================================================================

// Componente para a Página de Login
const AuthPage = ({ authInstance }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(authInstance, email, password);
      } else {
        // Implementar lógica de registro, se necessário.
        // Por enquanto, apenas o login está habilitado.
      }
      navigate('/dashboard'); // Redireciona para o painel em caso de sucesso
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex justify-center">
          <UserIcon size={48} className="text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-900">
          {isLogin ? 'Entrar' : 'Cadastre-se'}
        </h2>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-5 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition duration-200"
          >
            {isLogin ? 'Acessar' : 'Cadastrar'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          {isLogin ? (
            <>
              Não tem uma conta?{' '}
              <button
                onClick={() => setIsLogin(false)}
                className="text-indigo-600 font-medium hover:underline"
              >
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <button
                onClick={() => setIsLogin(true)}
                className="text-indigo-600 font-medium hover:underline"
              >
                Faça login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

// Componente para a Página do Painel (Dashboard)
const Dashboard = ({ leads, onLogout, whatsappStatus, qrCode, handleConnectWhatsapp, isConnecting, onPageChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="relative min-h-screen bg-gray-100 font-sans antialiased">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 bg-white shadow-lg w-64 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-indigo-700">CRM AI</h1>
            <button onClick={toggleSidebar} className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors">
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-4">
            <button onClick={() => onPageChange('dashboard')} className="flex items-center w-full space-x-3 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <TrendingUp size={24} />
              <span>Painel</span>
            </button>
            <button onClick={() => onPageChange('leads')} className="flex items-center w-full space-x-3 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <List size={24} />
              <span>Leads</span>
            </button>
            <button onClick={() => onPageChange('ai-text')} className="flex items-center w-full space-x-3 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <Sparkles size={24} />
              <span>Gerador de Textos</span>
            </button>
            <button onClick={() => onPageChange('chat')} className="flex items-center w-full space-x-3 text-lg font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 p-3 rounded-lg transition-colors">
              <MessageCircle size={24} />
              <span>Chatbot</span>
            </button>
          </nav>
        </div>
        <div className="p-6">
          <button onClick={onLogout} className="w-full text-center py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white shadow p-4 flex items-center justify-between lg:justify-end">
          <button onClick={toggleSidebar} className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center px-4 py-2 rounded-full text-sm font-medium ${whatsappStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <Wifi size={16} className="mr-2" />
              <span>WhatsApp: {whatsappStatus === 'connected' ? 'Conectado' : 'Desconectado'}</span>
            </div>
            {whatsappStatus !== 'connected' && (
              <button onClick={handleConnectWhatsapp} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors">
                {isConnecting ? <Loader2 size={16} className="animate-spin" /> : 'Conectar WhatsApp'}
              </button>
            )}
          </div>
        </header>
        
        {/* Content Area */}
        <main className="flex-1 p-6 space-y-6">
          <h2 className="text-3xl font-bold text-gray-900">Painel de Análise</h2>
          {whatsappStatus !== 'connected' && qrCode && (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <h3 className="text-xl font-semibold mb-4">Escaneie para conectar o WhatsApp</h3>
              <div className="flex justify-center mb-4">
                <img src={`data:image/png;base64,${qrCode}`} alt="QR Code do WhatsApp" className="w-64 h-64 border-2 border-gray-300 rounded-lg p-2" />
              </div>
              <p className="text-gray-600">Abra o WhatsApp no seu celular, vá em Aparelhos Conectados, aponte a câmera para o QR Code para conectar sua conta.</p>
            </div>
          )}
          {/* Seções de cards de dados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
                <User size={20} className="text-indigo-500 mr-2" />
                Total de Leads
              </h3>
              <p className="text-4xl font-bold text-gray-900">{leads.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
                <CheckCircle size={20} className="text-green-500 mr-2" />
                Qualificados
              </h3>
              <p className="text-4xl font-bold text-gray-900">{leads.filter(l => l.status === 'Qualificado').length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
                <Clock size={20} className="text-yellow-500 mr-2" />
                Em Contato
              </h3>
              <p className="text-4xl font-bold text-gray-900">{leads.filter(l => l.status === 'Em Contato').length}</p>
            </div>
          </div>
          {/* Gráfico de leads por status */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Leads por Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(leads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
              }, {})).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Número de Leads" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Tabela de Leads Recentes */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">Leads Recentes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.slice(0, 5).map(lead => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.status === 'Qualificado' ? 'bg-green-100 text-green-800' :
                          lead.status === 'Em Contato' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.company}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Componente para a Página de Leads
const LeadsPage = ({ leads, onBack, addLead, updateLead, deleteLead }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [newLeadData, setNewLeadData] = useState({ name: '', email: '', phone: '', status: 'Em Contato', company: '', role: '' });
  const [editLeadData, setEditLeadData] = useState({});

  const handleNewLeadChange = (e) => {
    const { name, value } = e.target;
    setNewLeadData({ ...newLeadData, [name]: value });
  };

  const handleAddLeadSubmit = (e) => {
    e.preventDefault();
    addLead(newLeadData);
    setNewLeadData({ name: '', email: '', phone: '', status: 'Em Contato', company: '', role: '' });
    setShowAddModal(false);
  };

  const handleEditLead = (lead) => {
    setCurrentLead(lead);
    setEditLeadData(lead);
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditLeadData({ ...editLeadData, [name]: value });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateLead(currentLead.id, editLeadData);
    setShowEditModal(false);
  };

  const handleRemoveLead = (lead) => {
    setCurrentLead(lead);
    setShowConfirmation(true);
  };

  const confirmRemove = () => {
    if (currentLead) {
      deleteLead(currentLead.id);
    }
    setShowConfirmation(false);
    setCurrentLead(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors">
          <ChevronLeft size={20} />
          <span>Voltar ao Painel</span>
        </button>
        <h2 className="text-3xl font-bold text-gray-900">Gerenciamento de Leads</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
          <Plus size={20} />
          <span>Novo Lead</span>
        </button>
      </header>

      {/* Tabela de Leads */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      lead.status === 'Qualificado' ? 'bg-green-100 text-green-800' :
                      lead.status === 'Em Contato' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.email && <p className="flex items-center"><Mail size={14} className="mr-2" />{lead.email}</p>}
                    {lead.phone && <p className="flex items-center"><Phone size={14} className="mr-2" />{lead.phone}</p>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.company}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEditLead(lead)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleRemoveLead(lead)} className="text-red-600 hover:text-red-900 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Adicionar Lead */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <h4 className="text-2xl font-bold text-center mb-4">Adicionar Novo Lead</h4>
            <form onSubmit={handleAddLeadSubmit} className="space-y-4">
              <input type="text" name="name" placeholder="Nome Completo" value={newLeadData.name} onChange={handleNewLeadChange} required className="w-full px-4 py-2 border rounded-lg" />
              <input type="email" name="email" placeholder="Email" value={newLeadData.email} onChange={handleNewLeadChange} className="w-full px-4 py-2 border rounded-lg" />
              <input type="tel" name="phone" placeholder="Telefone" value={newLeadData.phone} onChange={handleNewLeadChange} className="w-full px-4 py-2 border rounded-lg" />
              <select name="status" value={newLeadData.status} onChange={handleNewLeadChange} className="w-full px-4 py-2 border rounded-lg">
                <option value="Em Contato">Em Contato</option>
                <option value="Qualificado">Qualificado</option>
                <option value="Não Qualificado">Não Qualificado</option>
              </select>
              <input type="text" name="company" placeholder="Empresa" value={newLeadData.company} onChange={handleNewLeadChange} className="w-full px-4 py-2 border rounded-lg" />
              <input type="text" name="role" placeholder="Cargo" value={newLeadData.role} onChange={handleNewLeadChange} className="w-full px-4 py-2 border rounded-lg" />
              <div className="flex justify-end space-x-4 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700">
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Lead */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <h4 className="text-2xl font-bold text-center mb-4">Editar Lead</h4>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" name="name" placeholder="Nome Completo" value={editLeadData.name} onChange={handleEditChange} required className="w-full px-4 py-2 border rounded-lg" />
              <input type="email" name="email" placeholder="Email" value={editLeadData.email} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" />
              <input type="tel" name="phone" placeholder="Telefone" value={editLeadData.phone} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" />
              <select name="status" value={editLeadData.status} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg">
                <option value="Em Contato">Em Contato</option>
                <option value="Qualificado">Qualificado</option>
                <option value="Não Qualificado">Não Qualificado</option>
              </select>
              <input type="text" name="company" placeholder="Empresa" value={editLeadData.company} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" />
              <input type="text" name="role" placeholder="Cargo" value={editLeadData.role} onChange={handleEditChange} className="w-full px-4 py-2 border rounded-lg" />
              <div className="flex justify-end space-x-4 mt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Remoção */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
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
                className="bg-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para a Página de Geração de Texto com IA
const AITextGenerator = ({ onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateText = async () => {
    if (!prompt.trim()) {
      setError('Por favor, digite um prompt para gerar o texto.');
      return;
    }

    setIsLoading(true);
    setError('');

    const chatHistory = [{ role: 'user', parts: [{ text: prompt }] }];
    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "text/plain",
      }
    };

    const apiKey = "";
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setGeneratedText(text);
      } else {
        setError('Nenhum texto foi gerado. Tente novamente.');
      }
    } catch (err) {
      setError(`Falha ao gerar o texto: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = () => {
    const el = document.createElement('textarea');
    el.value = generatedText;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('Texto copiado para a área de transferência!');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <header className="flex items-center mb-6">
        <button onClick={onBack} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors">
          <ChevronLeft size={20} />
          <span>Voltar ao Painel</span>
        </button>
        <h2 className="text-3xl font-bold text-gray-900 ml-4">Gerador de Textos com IA</h2>
      </header>
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <p className="text-gray-600">Descreva o tipo de texto que você precisa gerar (e-mail, script de vendas, post para rede social, etc.).</p>
        <textarea
          className="w-full h-32 p-4 border rounded-lg resize-none"
          placeholder="Ex: Crie um e-mail de prospecção para leads de tecnologia, com o objetivo de agendar uma reunião de 15 minutos."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={handleGenerateText}
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:bg-gray-400"
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={24} className="mr-2" />
              Gerar Texto
            </>
          )}
        </button>
        {error && <div className="text-red-600 text-center">{error}</div>}
        {generatedText && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-lg font-bold mb-2 flex justify-between items-center">
              Texto Gerado
              <button onClick={handleCopyText} className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center text-sm">
                <FileText size={16} className="mr-1" />
                Copiar
              </button>
            </h3>
            <p className="whitespace-pre-wrap text-gray-800">{generatedText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para a Página de Chatbot
const Chat = ({ onBack }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = React.useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    const prompt = `Você é um assistente de vendas e marketing. Responda à seguinte mensagem do usuário de forma concisa e útil: ${input}`;

    const chatHistory = messages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] }));
    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    
    const apiKey = "";
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      const botResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (botResponse) {
        setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: 'Desculpe, não consegui gerar uma resposta. Tente novamente.' }]);
      }
    } catch (err) {
      console.error("Erro na API do Gemini:", err);
      setMessages(prev => [...prev, { role: 'bot', content: 'Ocorreu um erro. Por favor, tente novamente mais tarde.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans flex flex-col">
      <header className="flex items-center mb-6">
        <button onClick={onBack} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors">
          <ChevronLeft size={20} />
          <span>Voltar ao Painel</span>
        </button>
        <h2 className="text-3xl font-bold text-gray-900 ml-4">Assistente de Vendas (Chatbot)</h2>
      </header>
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg p-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-md p-3 rounded-xl shadow-md ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                {msg.role === 'bot' && <span className="font-bold flex items-center mb-1"><Bot size={16} className="mr-1" />Assistente:</span>}
                {msg.role === 'user' && <span className="font-bold flex items-center justify-end mb-1"><UserIcon size={16} className="mr-1" />Você:</span>}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-800 p-3 rounded-xl shadow-md rounded-bl-none">
                <Loader2 size={24} className="animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="mt-4 flex space-x-2">
          <input
            type="text"
            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="bg-indigo-600 text-white px-5 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================================================================================
// --- COMPONENTE PRINCIPAL (APP) ---
// ====================================================================================

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [companyId, setCompanyId] = useState('empresa-exemplo'); // Simulação de ID da empresa

  // Efeito para inicializar o Firebase e ouvir o estado de autenticação
  useEffect(() => {
    // Verifica se o Firebase foi inicializado
    if (!auth) {
      setLoading(false);
      return;
    }

    const signInUser = async () => {
      if (initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (e) {
          console.error("Erro ao autenticar com token:", e);
          await signInAnonymously(auth); // Autenticação anônima em caso de falha
        }
      } else {
        await signInAnonymously(auth); // Autenticação anônima se nenhum token for fornecido
      }
    };
    
    // Autentica o usuário com um token personalizado ou anonimamente
    signInUser();

    // Listener para o estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Dependência vazia para rodar apenas uma vez

  // Efeito para buscar e ouvir os leads do Firestore
  useEffect(() => {
    if (!db || !user) return; // Garante que o Firestore e o usuário estão prontos

    const leadsCollection = collection(db, `artifacts/${__app_id}/public/data/leads`);
    const q = query(leadsCollection, where('companyId', '==', companyId));

    const unsub = onSnapshot(q, (snapshot) => {
      const leadsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLeads(leadsList);
    });

    return () => unsub();
  }, [db, user, companyId]); // Dependências para re-rodar quando o db ou user mudarem

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
  };

  const handleConnectWhatsapp = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setQrCode('');

    try {
      // Simulação de chamada à API do backend
      // Em uma aplicação real, você faria um `fetch` para o seu servidor.
      // O servidor, por sua vez, usaria a biblioteca `whatsapp-web.js` para gerar o QR Code.
      // Para demonstração, vamos simular uma resposta com um QR Code de placeholder.
      await new Promise(resolve => setTimeout(resolve, 2000));
      setQrCode('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABo9rIeAAAAA1BMVEX/AwBma35KAAAAeElEQVR4nO3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjvABMYAAB/M21EAAAAAElFTkSuQmCC'); // Placeholder de QR Code
      setWhatsappStatus('pending');
    } catch (e) {
      console.error("Erro ao conectar WhatsApp:", e);
      setWhatsappStatus('disconnected');
    } finally {
      setIsConnecting(false);
    }
  };

  const addLeadToFirestore = async (db, companyId, leadData) => {
    if (!db) return;
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/public/data/leads`), {
        ...leadData,
        companyId,
        createdAt: new Date(),
      });
    } catch (e) {
      console.error("Erro ao adicionar lead: ", e);
    }
  };

  const updateLeadInFirestore = async (db, companyId, leadId, newData) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, `artifacts/${__app_id}/public/data/leads`, leadId), newData);
    } catch (e) {
      console.error("Erro ao atualizar lead: ", e);
    }
  };

  const deleteLeadFromFirestore = async (db, companyId, leadId) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/public/data/leads`, leadId));
    } catch (e) {
      console.error("Erro ao deletar lead: ", e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700 flex items-center">
          <Loader2 size={24} className="animate-spin mr-2" />
          Carregando...
        </div>
      </div>
    );
  }

  // Se o Firebase não estiver inicializado, mostra uma mensagem de erro.
  if (!auth) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-red-100 text-center p-4">
        <div className="bg-red-200 p-6 rounded-lg shadow-md">
          <p className="text-lg font-bold text-red-800">Erro: Não foi possível carregar o serviço de autenticação do Firebase.</p>
          <p className="text-sm text-red-600 mt-2">Por favor, verifique se as variáveis de configuração estão corretas e se o Firebase está habilitado para esta aplicação.</p>
        </div>
      </div>
    );
  }

  // A partir daqui, todo o conteúdo está dentro de <Router>
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AuthPage authInstance={auth} />} />
        
        {/* Rota Protegida: Redireciona para o login se não houver usuário */}
        <Route path="/dashboard" element={user ? (
          <Dashboard
            leads={leads}
            onLogout={handleLogout}
            whatsappStatus={whatsappStatus}
            qrCode={qrCode}
            handleConnectWhatsapp={handleConnectWhatsapp}
            isConnecting={isConnecting}
            onPageChange={() => {}} // Não é mais necessário, a navegação é feita pelo Route
          />
        ) : <Navigate to="/login" />} />
        
        <Route path="/leads" element={user ? (
          <LeadsPage
            leads={leads}
            onBack={() => {}}
            addLead={(leadData) => addLeadToFirestore(db, companyId, leadData)}
            updateLead={(leadId, newData) => updateLeadInFirestore(db, companyId, leadId, newData)}
            deleteLead={(leadId) => deleteLeadFromFirestore(db, companyId, leadId)}
          />
        ) : <Navigate to="/login" />} />

        <Route path="/ai-text" element={user ? (
          <AITextGenerator onBack={() => {}} />
        ) : <Navigate to="/login" />} />

        <Route path="/chat" element={user ? (
          <Chat onBack={() => {}} />
        ) : <Navigate to="/login" />} />

        {/* Rota Padrão: Redireciona para o painel se o usuário estiver logado, ou para o login se não estiver. */}
        <Route path="*" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}