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
  Check
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- CONFIGURAÇÃO DO FIREBASE ---
// SUBSTITUA OS VALORES ABAIXO COM OS SEUS PRÓPRIOS, OBTIDOS NO CONSOLE DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDgQGScK1MJcU9KOFKzKVaJaVxapGQfnu4",
  authDomain: "crm-plataform.firebaseapp.com",
  projectId: "crm-plataform",
  storageBucket: "crm-plataform.firebasestorage.app",
  messagingSenderId: "588876286066",
  appId: "1:588876286066:web:ae5f253354de51662f9aeb",
  measurementId: "G-SMMFBZDKFG"
};

// --- Configuração e Inicialização do Firebase ---
// Esta função é executada uma vez para configurar o Firebase.
const initializeFirebase = () => {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Remove a chamada para signInWithCustomToken pois ela é específica do ambiente de colaboração
    return { auth, db };
  } catch (error) {
    console.error("Erro ao inicializar o Firebase. Verifique suas credenciais:", error);
    return { auth: null, db: null };
  }
};

const { auth, db } = initializeFirebase();

// Dados simulados para os leads, agora com segmento de negócio e data de criação.
const mockLeads = [
  {
    id: 1,
    name: 'João Santos',
    email: 'joao.santos@exemplo.com',
    phone: '(11) 98765-4321',
    company: 'Tech Solutions',
    role: 'Gerente de Vendas',
    status: 'Em Contato',
    source: 'Anúncio do Google',
    lastMessage: 'Oi João, tudo bem? Podemos agendar uma conversa?',
    businessSegment: 'Tecnologia',
    dateCreated: '2025-08-15',
    details: {
      painPoints: 'Dificuldade em organizar leads e fazer follow-up de forma automática.',
      solutionNotes: 'Solução sugerida: automação de e-mails e sequências de follow-up.',
      nextSteps: 'Agendar demo na próxima semana.',
    },
  },
  {
    id: 2,
    name: 'Maria Oliveira',
    email: 'maria.oliveira@exemplo.com',
    phone: '(21) 99876-5432',
    company: 'Web Developers Co.',
    role: 'CEO',
    status: 'Em Contato',
    source: 'Webinar',
    lastMessage: 'Olá, gostaria de saber mais sobre a plataforma.',
    businessSegment: 'Tecnologia',
    dateCreated: '2025-08-16',
    details: {
      painPoints: 'Precisa de uma ferramenta que integre com a equipe de marketing.',
      solutionNotes: 'Destacar a integração com ferramentas de marketing e o dashboard de análise.',
      nextSteps: 'Enviar material de apoio e marcar reunião de aprofundamento.',
    },
  },
  {
    id: 3,
    name: 'Carlos Lima',
    email: 'carlos.lima@exemplo.com',
    phone: '(31) 98765-1234',
    company: 'Consultoria Alpha',
    role: 'Consultor Sênior',
    status: 'Qualificado',
    source: 'Indicação',
    lastMessage: 'Qual o valor da mensalidade do plano premium?',
    businessSegment: 'Consultoria',
    dateCreated: '2025-08-18',
    details: {
      painPoints: 'Alto custo de ferramentas atuais e falta de suporte personalizado.',
      solutionNotes: 'Apresentar plano com suporte VIP e custo-benefício superior.',
      nextSteps: 'Enviar proposta formal para análise.',
    },
  },
  {
    id: 4,
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com',
    phone: '(41) 99988-7766',
    company: 'Inovações SA',
    role: 'Diretora de Marketing',
    status: 'Qualificado',
    source: 'Inbound',
    lastMessage: 'Sim, a demo foi ótima! Estou revendo o orçamento aqui.',
    businessSegment: 'Marketing',
    dateCreated: '2025-08-19',
    details: {
      painPoints: 'Aprovação de orçamento interna e necessidade de mais dados para justificar a compra.',
      solutionNotes: 'Fornecer um estudo de caso sobre ROI e relatórios de métricas.',
      nextSteps: 'Aguardar resposta e agendar follow-up para 3 dias.',
    },
  },
  {
    id: 5,
    name: 'Pedro Alves',
    email: 'pedro.alves@exemplo.com',
    phone: '(51) 98877-6655',
    company: 'Pequenos Negócios',
    role: 'Proprietário',
    status: 'Não Qualificado',
    source: 'Cold Call',
    lastMessage: 'Obrigado pelo contato, mas não é o que procuro no momento.',
    businessSegment: 'Varejo',
    dateCreated: '2025-08-20',
    details: {
      painPoints: 'Não tem orçamento para soluções pagas e prefere usar ferramentas gratuitas.',
      solutionNotes: 'Não há fit com o perfil ideal de cliente.',
      nextSteps: 'Arquivar e marcar como "Não Qualificado".',
    },
  },
];

// Simulação de um histórico de mensagens
const conversationHistory = {
  1: [
    { sender: 'Eu', message: 'Olá, João! Vi que você se interessou pela nossa plataforma. Podemos conversar?', timestamp: '10:05 AM' },
    { sender: 'João Santos', message: 'Sim, mas estou um pouco ocupado agora. Me manda uma mensagem mais tarde, por favor.', timestamp: '10:10 AM' },
    { sender: 'Eu', message: 'Claro! Entro em contato amanhã de manhã. Tenha um bom dia.', timestamp: '10:15 AM' },
  ],
  2: [
    { sender: 'Maria Oliveira', message: 'Olá, gostaria de saber mais sobre a plataforma de automação.', timestamp: '11:20 AM' },
    { sender: 'Eu', message: 'Olá, Maria! Com certeza. Que tipo de automação você busca?', timestamp: '11:22 AM' },
    { sender: 'Maria Oliveira', message: 'Principalmente para o funil de vendas, para me ajudar a qualificar leads.', timestamp: '11:25 AM' },
    { sender: 'Eu', message: 'Entendido. Podemos agendar uma demonstração rápida de 15 minutos para te mostrar como funciona?', timestamp: '11:30 AM' },
  ],
  3: [
    { sender: 'Carlos Lima', message: 'Olá, estou pronto para avançar. Qual o próximo passo?', timestamp: '14:00 PM' },
    { sender: 'Eu', message: 'Ótimo, Carlos! O próximo passo é enviar a proposta formal. Me confirme o melhor e-mail.', timestamp: '14:05 PM' },
    { sender: 'Carlos Lima', message: 'pode enviar para carlos.lima@empresa.com.br.', timestamp: '14:08 PM' },
  ],
  4: [
    { sender: 'Ana Souza', message: 'A demonstração foi ótima, mas achei o preço um pouco alto. Há flexibilidade?', timestamp: '09:00 AM' },
    { sender: 'Eu', message: 'Olá Ana, entendo sua preocupação. Posso te enviar um plano de pagamento que se ajuste melhor ao seu orçamento.', timestamp: '09:05 AM' },
    { sender: 'Ana Souza', message: 'Agradeço, aguardo o e-mail.', timestamp: '09:08 AM' },
  ],
  5: [
    { sender: 'Pedro Alves', message: 'Oi, obrigado pelo contato. Por enquanto, não tenho interesse na solução.', timestamp: '16:00 PM' },
    { sender: 'Eu', message: 'Tudo bem, Pedro. Agradeço seu tempo e te mantenho na nossa base. Qualquer coisa, é só nos chamar!', timestamp: '16:05 PM' },
  ],
};

// Define as páginas e seus ícones
const pages = [
  { id: 'dashboard', name: 'Visão Geral', icon: Sparkles },
  { id: 'leads', name: 'Qualificação de Leads', icon: MessageCircle },
  { id: 'automacao', name: 'Automação de Follow-up', icon: Mail },
  { id: 'analise', name: 'Análise de Conversas', icon: TrendingUp },
  { id: 'reports', name: 'Gerar Relatórios', icon: FileText },
];

// --- Componentes da Aplicação ---
// Componente da página principal (Dashboard).
const Dashboard = ({ leads, onLogout }) => {
  const leadsData = [
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
      <button 
        onClick={onLogout}
        className="py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mb-4"
      >
        Sair
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500 flex items-center">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mr-4">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Leads Qualificados</h3>
            <p className="text-3xl font-bold text-indigo-600">{leads.filter(l => l.status === 'Qualificado').length}</p>
            <p className="text-sm text-gray-500 mt-1">+15% em relação ao mês anterior</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Resoluções de Atendimento</h3>
            <p className="text-3xl font-bold text-green-600">85%</p>
            <p className="text-sm text-gray-500 mt-1">Taxa de resolução no primeiro contato</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 flex items-center">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full mr-4">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Taxa de Conversão</h3>
            <p className="text-3xl font-bold text-yellow-600">2.7%</p>
            <p className="text-sm text-gray-500 mt-1">De leads para clientes pagantes</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Qualificação de Leads por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadsData}>
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
            <LineChart data={leadsData}>
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
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Criação
              </th>
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

// Componente da página de Automação.
const AutomationPage = () => {
  const [automations, setAutomations] = useState([
    { id: 1, name: 'Boas-Vindas para Novos Leads', status: 'Ativo', trigger: 'Novo lead no CRM', lastRun: '2 horas atrás' },
    { id: 2, name: 'Follow-up de Agendamento', status: 'Ativo', trigger: 'Lead qualificado', lastRun: '15 minutos atrás' },
    { id: 3, name: 'Envio de Proposta', status: 'Inativo', trigger: 'Lead interagiu com a proposta', lastRun: 'N/A' },
  ]);
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Automação de Follow-up</h2>
      <p className="text-gray-600 mb-6">
        Crie fluxos de trabalho que enviam e-mails, lembretes e mensagens automaticamente para nutrir seus leads.
      </p>
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Fluxos de Automação</h3>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center">
            <Plus className="h-5 w-5 mr-2" /> Novo Fluxo
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">Nome</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gatilho</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Execução</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {automations.map(auto => (
              <tr key={auto.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{auto.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    auto.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {auto.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{auto.trigger}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{auto.lastRun}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Componente da página de Análise.
const AnalysisPage = () => {
  const data = [
    { name: 'Qualificados', value: 400 },
    { name: 'Em Contato', value: 300 },
    { name: 'Não Qualificados', value: 300 },
  ];
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Análise de Conversas</h2>
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Visão Geral dos Leads por Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Componente da página de Relatórios.
const ReportsPage = ({ leads }) => {
  const [reportType, setReportType] = useState('leads');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simula a chamada da API do Gemini para gerar relatórios com base no input
  const generateReport = async () => {
    setLoading(true);
    // Dados de exemplo para o prompt da IA
    const prompt = `Gere um relatório detalhado sobre os leads com status 'Qualificado'. Inclua uma análise dos dados, insights e sugestões de follow-up. Dados: ${JSON.stringify(leads.filter(l => l.status === 'Qualificado'))}`;
    
    // Simulação da chamada da API
    await new Promise(res => setTimeout(res, 2000));
    setReportData([{
      title: 'Relatório de Qualidade de Leads',
      content: 'Este é um relatório simulado gerado pela IA. Ele analisa os leads qualificados e oferece insights sobre o perfil do cliente ideal e as melhores práticas de follow-up. Baseado nos dados, a maioria dos leads qualificados vem da área de tecnologia, indicando uma alta demanda por soluções digitais. Sugere-se focar em abordagens personalizadas e demonstrações do produto.',
    }]);
    setLoading(false);
  };

  const downloadReport = () => {
    const reportText = reportData.map(r => r.title + "\n\n" + r.content).join("\n\n---\n\n");
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio_gerado_ia.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Gerador de Relatórios</h2>
      <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
        <p className="text-gray-600 mb-4">
          Utilize a IA para gerar relatórios detalhados e personalizados sobre seus leads.
        </p>
        <button
          onClick={generateReport}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center disabled:bg-indigo-400"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Gerar Relatório de Análise
            </>
          )}
        </button>
      </div>

      {reportData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Relatório Gerado</h3>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            {reportData.map((r, index) => (
              <div key={index}>
                <h4 className="text-lg font-bold text-gray-800 mb-2">{r.title}</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
          <button
            onClick={downloadReport}
            className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Baixar Relatório
          </button>
        </div>
      )}
    </div>
  );
};

// Componente da tela de login
const LoginPage = ({ authInstance }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!authInstance) {
      setError("O serviço de autenticação não está disponível.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(authInstance, email, password);
      setLoading(false);
      navigate('/dashboard');
    } catch (err) {
      setLoading(false);
      switch (err.code) {
        case 'auth/wrong-password':
          setError('Senha incorreta. Por favor, tente novamente.');
          break;
        case 'auth/user-not-found':
          setError('E-mail não encontrado. Por favor, verifique seu e-mail.');
          break;
        case 'auth/invalid-email':
          setError('E-mail inválido. Por favor, insira um e-mail válido.');
          break;
        default:
          setError('Ocorreu um erro ao fazer login. Tente novamente mais tarde.');
          break;
      }
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="seuemail@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="********"
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm font-medium text-center p-2 rounded-md bg-red-50">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 disabled:bg-blue-300"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Componente da plataforma principal
const MainPlatform = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leads, setLeads] = useState(mockLeads);
  const conversationHistory = {
    1: [
      { sender: 'Eu', message: 'Olá, João! Vi que você se interessou pela nossa plataforma. Podemos conversar?', timestamp: '10:05 AM' },
      { sender: 'João Santos', message: 'Sim, mas estou um pouco ocupado agora. Me manda uma mensagem mais tarde, por favor.', timestamp: '10:10 AM' },
      { sender: 'Eu', message: 'Claro! Entro em contato amanhã de manhã. Tenha um bom dia.', timestamp: '10:15 AM' },
    ],
    2: [
      { sender: 'Maria Oliveira', message: 'Olá, gostaria de saber mais sobre a plataforma de automação.', timestamp: '11:20 AM' },
      { sender: 'Eu', message: 'Olá, Maria! Com certeza. Que tipo de automação você busca?', timestamp: '11:22 AM' },
      { sender: 'Maria Oliveira', message: 'Principalmente para o funil de vendas, para me ajudar a qualificar leads.', timestamp: '11:25 AM' },
      { sender: 'Eu', message: 'Entendido. Podemos agendar uma demonstração rápida de 15 minutos para te mostrar como funciona?', timestamp: '11:30 AM' },
    ],
    3: [
      { sender: 'Carlos Lima', message: 'Olá, estou pronto para avançar. Qual o próximo passo?', timestamp: '14:00 PM' },
      { sender: 'Eu', message: 'Ótimo, Carlos! O próximo passo é enviar a proposta formal. Me confirme o melhor e-mail.', timestamp: '14:05 PM' },
      { sender: 'Carlos Lima', message: 'pode enviar para carlos.lima@empresa.com.br.', timestamp: '14:08 PM' },
    ],
    4: [
      { sender: 'Ana Souza', message: 'A demonstração foi ótima, mas achei o preço um pouco alto. Há flexibilidade?', timestamp: '09:00 AM' },
      { sender: 'Eu', message: 'Olá Ana, entendo sua preocupação. Posso te enviar um plano de pagamento que se ajuste melhor ao seu orçamento.', timestamp: '09:05 AM' },
      { sender: 'Ana Souza', message: 'Agradeço, aguardo o e-mail.', timestamp: '09:08 AM' },
    ],
    5: [
      { sender: 'Pedro Alves', message: 'Oi, obrigado pelo contato. Por enquanto, não tenho interesse na solução.', timestamp: '16:00 PM' },
      { sender: 'Eu', message: 'Tudo bem, Pedro. Agradeço seu tempo e te mantenho na nossa base. Qualquer coisa, é só nos chamar!', timestamp: '16:05 PM' },
    ],
  };
  const pages = [
    { id: 'dashboard', name: 'Visão Geral', icon: Sparkles },
    { id: 'leads', name: 'Qualificação de Leads', icon: MessageCircle },
    { id: 'automacao', name: 'Automação de Follow-up', icon: Mail },
    { id: 'analise', name: 'Análise de Conversas', icon: TrendingUp },
    { id: 'reports', name: 'Gerar Relatórios', icon: FileText },
  ];
  const Sidebar = () => (
    <div className="w-64 bg-gray-900 text-gray-200 h-screen p-6 hidden md:block fixed left-0 top-0">
      <h1 className="text-xl font-bold mb-8 text-white">
        Fluxo<span className="text-indigo-500">Connect</span>
      </h1>
      <nav>
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(page.id)}
            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors mb-2 ${
              currentPage === page.id
                ? 'bg-indigo-600 text-white font-semibold'
                : 'hover:bg-gray-800'
            }`}
          >
            <page.icon className="h-5 w-5 mr-3" />
            <span>{page.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
  const MobileMenu = () => (
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
              setCurrentPage(page.id);
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors mb-2 ${
              currentPage === page.id
                ? 'bg-indigo-600 text-white font-semibold'
                : 'hover:bg-gray-800'
            }`}
          >
            <page.icon className="h-5 w-5 mr-3" />
            <span>{page.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
  const handleRemoveLead = (leadId) => {
    setLeads(leads.filter(lead => lead.id !== leadId));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard leads={leads} onLogout={handleLogout} />;
      case 'leads':
        return <KanbanBoard leads={leads} setLeads={setLeads} onRemoveLead={handleRemoveLead} conversationHistory={conversationHistory} />;
      case 'automacao':
        return <AutomationPage />;
      case 'analise':
        return <AnalysisPage />;
      case 'reports':
        return <ReportsPage leads={leads} />;
      default:
        return <Dashboard leads={leads} onLogout={handleLogout} />;
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
    }
  };

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <Sidebar />
      <MobileMenu />
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

// Componente principal da aplicação.
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Carregando...</div>
      </div>
    );
  }

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

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage authInstance={auth} />} />
        <Route path="/dashboard" element={user ? <MainPlatform /> : <Navigate to="/login" replace />} />
        {/* Rota padrão */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

// Funções e componentes que não são exportados diretamente
/**
 * Função para converter JSON de string para objeto, com tratamento de erro.
 */
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Erro ao fazer o parse do JSON:", error);
    return null;
  }
}
async function callGeminiAPI(history, generationConfig = {}) {
  const payload = {
    contents: history,
    generationConfig,
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=`, requestOptions);
      if (response.status === 429) {
        const delay = baseDelay * Math.pow(2, attempts);
        console.warn(`Taxa de limite excedida. Tentando novamente em ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
        attempts++;
        continue;
      }
      const result = await response.json();
      if (result.candidates && result.candidates.length > 0) {
        const text = result.candidates[0].content?.parts?.[0]?.text;
        if (text) {
          return text;
        } else {
          console.error("Resposta da API vazia ou inválida:", result);
          return "Ops! Ocorreu um erro ao gerar a resposta. Por favor, tente novamente.";
        }
      } else {
        console.error("Resposta da API sem candidatos:", result);
        return "Ops! Não consegui gerar uma resposta. Tente reformular a pergunta.";
      }
    } catch (error) {
      console.error("Erro na chamada da API:", error);
      const delay = baseDelay * Math.pow(2, attempts);
      console.warn(`Erro na chamada da API. Tentando novamente em ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
      attempts++;
    }
  }
  return "Ops! Ocorreu um erro e não conseguimos nos conectar à IA. Por favor, tente novamente mais tarde.";
}
const KanbanBoard = () => { /* Código do KanbanBoard */ };