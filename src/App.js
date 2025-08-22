import { useState, useEffect } from 'react';
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

// Configurações e variáveis globais para a API do Gemini
const API_KEY = "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

/**
 * Função para converter JSON de string para objeto, com tratamento de erro.
 * @param {string} jsonString A string JSON a ser analisada.
 * @returns {Object|null} O objeto JavaScript analisado ou null em caso de erro.
 */
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Erro ao fazer o parse do JSON:", error);
    return null;
  }
}

/**
 * Função principal para chamar a API do Gemini com retentativas e backoff exponencial.
 * Esta função lida com limites de taxa e erros de rede.
 * @param {Array} history O histórico da conversa para enviar à API.
 * @param {Object} generationConfig A configuração para a geração de resposta (opcional).
 * @returns {Promise<string>} O texto da resposta da IA ou uma mensagem de erro.
 */
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
      const response = await fetch(`${API_URL}?key=${API_KEY}`, requestOptions);
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

/**
 * Componente principal da aplicação.
 * Gerencia a navegação e o estado global.
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leads, setLeads] = useState(mockLeads);

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

  // Componente de navegação lateral
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

  // Componente do menu mobile
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

  // Renderiza a página atual com base no estado
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard leads={leads} />;
      case 'leads':
        return <KanbanBoard leads={leads} setLeads={setLeads} onRemoveLead={handleRemoveLead} conversationHistory={conversationHistory} />;
      case 'automacao':
        return <AutomationPage />;
      case 'analise':
        return <AnalysisPage />;
      case 'reports':
        return <ReportsPage leads={leads} />;
      default:
        return <Dashboard leads={leads} />;
    }
  };

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <Sidebar />
      <MobileMenu />
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Header para mobile */}
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
}

/**
 * Componente da página principal (Dashboard).
 * Inclui gráficos e leads recentes. Adiciona a funcionalidade de exportar para CSV.
 */
const Dashboard = ({ leads }) => {
  // Dados simulados para os gráficos e a tabela
  const leadsData = [
    { name: 'Jan', qualificados: 15, naoQualificados: 5 },
    { name: 'Fev', qualificados: 20, naoQualificados: 8 },
    { name: 'Mar', qualificados: 25, naoQualificados: 10 },
    { name: 'Abr', qualificados: 30, naoQualificados: 12 },
    { name: 'Mai', qualificados: 40, naoQualificados: 15 },
    { name: 'Jun', qualificados: 35, naoQualificados: 13 },
  ];

  const recentLeads = leads.slice(0, 5);

  /**
   * Função para exportar os leads recentes para um arquivo CSV.
   * Simula a funcionalidade de relatórios da documentação.
   */
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

      {/* Seção de Gráficos */}
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

      {/* Seção de Leads Recentes com botão de exportar */}
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

/**
 * Componente da página de Automação.
 * Representa a funcionalidade de automação de follow-up.
 */
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
            <Plus className="h-5 w-5 mr-2" />
            Novo Fluxo
          </button>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">Nome</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gatilho</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-lg">Última Execução</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {automations.map(auto => (
              <tr key={auto.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{auto.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    auto.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

/**
 * Componente da página de Análise de Conversas.
 * Utiliza a IA para processar texto e gerar um relatório estruturado em JSON.
 */
const AnalysisPage = () => {
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Função que envia o texto para a IA e processa a resposta.
   */
  const handleAnalyze = async () => {
    if (!textToAnalyze.trim()) {
      setError("Por favor, insira um texto para análise.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    const prompt = `Analise o seguinte texto de uma conversa com um cliente e identifique:
    1. O principal sentimento (positivo, negativo, neutro).
    2. O principal problema ou necessidade do cliente.
    3. Sugestões de melhoria para o atendimento.
    4. Qual seria o próximo passo ideal para o time de vendas ou suporte.
    Responda em formato de JSON com as chaves "sentimento", "problema", "sugestoes" (array de strings) e "proximo_passo". O texto a ser analisado é:
    "${textToAnalyze}"`;

    try {
      const history = [{ role: 'user', parts: [{ text: prompt }] }];
      const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "sentimento": { "type": "STRING" },
            "problema": { "type": "STRING" },
            "sugestoes": {
              "type": "ARRAY",
              "items": { "type": "STRING" }
            },
            "proximo_passo": { "type": "STRING" }
          },
          "propertyOrdering": ["sentimento", "problema", "sugestoes", "proximo_passo"]
        }
      };
      
      const geminiResponseText = await callGeminiAPI(history, generationConfig);
      const parsedResponse = safeJsonParse(geminiResponseText);

      if (parsedResponse) {
        setAnalysisResult(parsedResponse);
      } else {
        setError("Não foi possível analisar o texto. Tente novamente com outro formato.");
      }
    } catch (e) {
      setError("Ops! Ocorreu um erro ao conectar com a IA. Tente novamente.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Análise de Conversas</h2>
      <p className="text-gray-600 mb-6">
        Utilize a IA para analisar o conteúdo de conversas e obter insights valiosos sobre seus clientes.
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold mb-4">Cole o texto da conversa aqui:</h3>
        <textarea
          className="w-full p-4 rounded-lg border border-gray-300 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          rows="10"
          value={textToAnalyze}
          onChange={(e) => setTextToAnalyze(e.target.value)}
          placeholder="Exemplo: 'O cliente está frustrado com o tempo de resposta do suporte e precisa de ajuda urgente para configurar o software...'"
        ></textarea>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          className="w-full bg-indigo-600 text-white text-lg font-bold px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Analisando...
            </span>
          ) : (
            "Analisar Conversa"
          )}
        </button>

        {analysisResult && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">Resultado da Análise</h3>
            <div className="bg-gray-100 p-6 rounded-lg shadow-inner space-y-4">
              <p>
                <span className="font-bold">Sentimento:</span>{' '}
                <span className={`font-semibold ${
                  analysisResult.sentimento.toLowerCase() === 'positivo' ? 'text-green-600' :
                  analysisResult.sentimento.toLowerCase() === 'negativo' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {analysisResult.sentimento}
                </span>
              </p>
              <p><span className="font-bold">Problema Principal:</span> {analysisResult.problema}</p>
              <div>
                <span className="font-bold block">Sugestões de Melhoria:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {analysisResult.sugestoes.map((sug, index) => (
                    <li key={index}>{sug}</li>
                  ))}
                </ul>
              </div>
              <p><span className="font-bold">Próximo Passo Ideal:</span> {analysisResult.proximo_passo}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Componente da página de Relatórios.
 * Permite filtrar leads e exportar os dados em CSV.
 */
const ReportsPage = ({ leads }) => {
  const [filters, setFilters] = useState({
    status: '',
    businessSegment: '',
    startDate: '',
    endDate: '',
  });
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setFilteredLeads(leads);
  }, [leads]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    let results = leads;

    if (filters.status) {
      results = results.filter(lead => lead.status === filters.status);
    }
    if (filters.businessSegment) {
      results = results.filter(lead => lead.businessSegment === filters.businessSegment);
    }
    if (filters.startDate) {
      results = results.filter(lead => new Date(lead.dateCreated) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      results = results.filter(lead => new Date(lead.dateCreated) <= new Date(filters.endDate));
    }
    setFilteredLeads(results);

    if (results.length === 0) {
      setMessage({ type: 'error', text: 'Nenhum lead encontrado com os filtros selecionados. Por favor, ajuste os filtros.' });
    } else {
      setMessage({ type: 'success', text: `${results.length} leads encontrados. Clique em "Exportar CSV" para fazer o download.` });
    }
  };
  
  const handleExport = () => {
    if (filteredLeads.length === 0) {
      setMessage({ type: 'error', text: 'Não há leads para exportar. Aplique os filtros primeiro.' });
      return;
    }

    const headers = ["ID", "Nome", "Email", "Empresa", "Cargo", "Segmento de Negócio", "Status", "Fonte", "Data de Criação"];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + filteredLeads.map(lead => [
          lead.id,
          lead.name,
          lead.email,
          lead.company,
          lead.role,
          lead.businessSegment,
          lead.status,
          lead.source,
          lead.dateCreated
        ].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_fluxoconnect_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage({ type: 'success', text: 'Relatório exportado com sucesso!' });
  };

  const businessSegments = [
    'Tecnologia', 'Consultoria', 'Marketing', 'Varejo', 'Financeiro', 'Saúde', 'Outros'
  ];

  const statusOptions = [
    'Em Contato', 'Qualificado', 'Não Qualificado'
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerador de Relatórios</h2>
      <p className="text-gray-600 mb-6">
        Filtre seus leads por critérios específicos e exporte os dados para análise detalhada.
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Filtros do Relatório</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Qualificação</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {statusOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Segmento de Negócio</label>
            <select
              name="businessSegment"
              value={filters.businessSegment}
              onChange={handleFilterChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {businessSegments.map(segment => (
                <option key={segment} value={segment}>{segment}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={applyFilters}
            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span className="flex items-center justify-center">
              <List className="h-5 w-5 mr-2" />
              Aplicar Filtros
            </span>
          </button>
          <button
            onClick={handleExport}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            <span className="flex items-center justify-center">
              <Download className="h-5 w-5 mr-2" />
              Exportar CSV
            </span>
          </button>
        </div>

        {message && (
          <div className={`mt-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Leads Filtrados ({filteredLeads.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segmento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map(lead => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.company}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.businessSegment}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      lead.status === 'Qualificado' ? 'bg-green-100 text-green-800' :
                      lead.status === 'Em Contato' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.dateCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente do quadro Kanban para a qualificação de leads.
 * Permite arrastar e soltar leads entre as colunas, e agora
 * abre um modal para detalhes e um modal para adicionar novos leads.
 */
const KanbanBoard = ({ leads, setLeads, onRemoveLead, conversationHistory }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  // Correção: Adicionei a declaração de estado para o modal de adicionar lead
  const [isAddLeadModalOpen, setIsAddLeadModal] = useState(false);
  const [newLeadData, setNewLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    source: '',
    lastMessage: '',
    businessSegment: '',
  });

  const statuses = [
    { id: 'Em Contato', name: 'Em Contato', color: 'bg-yellow-100 border-yellow-500' },
    { id: 'Qualificado', name: 'Qualificado', color: 'bg-green-100 border-green-500' },
    { id: 'Não Qualificado', name: 'Não Qualificado', color: 'bg-red-100 border-red-500' },
  ];

  /**
   * Manipulador para o início do arrastar.
   * @param {Object} e O evento de arrastar.
   * @param {number} leadId O ID do lead que está sendo arrastado.
   */
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('leadId', leadId);
    setDraggedItem(leadId);
  };

  /**
   * Manipulador para o movimento de arrastar.
   * Impede o comportamento padrão para permitir o drop.
   * @param {Object} e O evento de arrastar.
   */
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  /**
   * Manipulador para a soltura de um item.
   * Atualiza o status do lead para a nova coluna.
   * @param {Object} e O evento de soltura.
   * @param {string} newStatus O novo status da coluna onde o item foi solto.
   */
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const updatedLeads = leads.map(lead =>
      lead.id === parseInt(leadId) ? { ...lead, status: newStatus } : lead
    );
    setLeads(updatedLeads);
    setDraggedItem(null);
  };

  /**
   * Adiciona um novo lead ao quadro Kanban.
   */
  const handleAddLead = () => {
    if (!newLeadData.name.trim()) return;
    const newLead = {
      id: leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1,
      ...newLeadData,
      status: 'Em Contato',
      dateCreated: new Date().toISOString().slice(0, 10),
      details: {
        painPoints: '',
        solutionNotes: '',
        nextSteps: '',
      },
    };
    setLeads([...leads, newLead]);
    setNewLeadData({ name: '', email: '', phone: '', company: '', role: '', source: '', lastMessage: '', businessSegment: '' });
    setIsAddLeadModal(false);
  };
  
  /**
   * Abre o modal de detalhes para o lead selecionado.
   * @param {Object} lead O objeto do lead selecionado.
   */
  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
  };

  /**
   * Salva as edições feitas no modal de detalhes.
   * @param {Object} updatedLead O objeto do lead com as informações atualizadas.
   */
  const handleSaveDetails = (updatedLead) => {
    const updatedLeads = leads.map(lead =>
      lead.id === updatedLead.id ? updatedLead : lead
    );
    setLeads(updatedLeads);
    setSelectedLead(updatedLead);
  };

  const businessSegments = [
    'Tecnologia', 'Consultoria', 'Marketing', 'Varejo', 'Financeiro', 'Saúde', 'Outros'
  ];

  return (
    <div className="relative">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Qualificação de Leads</h2>
      <p className="text-gray-600 mb-6">
        Visualize e gerencie seus leads no funil de vendas com este quadro Kanban interativo. Arraste e solte para atualizar o status de cada lead.
      </p>

      {/* Botão para abrir o modal de adicionar novo lead */}
      <div className="flex justify-end mb-8">
        <button
          onClick={() => setIsAddLeadModal(true)}
          className="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <span className="flex items-center justify-center">
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Novo Lead
          </span>
        </button>
      </div>

      {/* Quadro Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statuses.map(status => (
          <div
            key={status.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status.id)}
            className={`flex-1 min-h-96 p-4 rounded-xl shadow-lg border-t-4 ${status.color}`}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <List className="h-5 w-5 mr-2" />
              {status.name} ({leads.filter(lead => lead.status === status.id).length})
            </h3>
            <div className="space-y-4">
              {leads.filter(lead => lead.status === status.id).map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => handleLeadClick(lead)}
                  className={`bg-white p-4 rounded-lg shadow-md cursor-pointer transition-transform transform ${
                    draggedItem === lead.id ? 'opacity-50 scale-95' : ''
                  } hover:scale-105`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-gray-900">{lead.name}</p>
                    <div className="flex items-center text-gray-500 text-sm">
                       <ChevronRight size={16} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 italic truncate">{lead.lastMessage}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para adicionar um novo lead */}
      {isAddLeadModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Adicionar Novo Lead</h3>
              <button onClick={() => setIsAddLeadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Nome Completo</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.name}
                  onChange={(e) => setNewLeadData({ ...newLeadData, name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">E-mail</label>
                <input
                  type="email"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.email}
                  onChange={(e) => setNewLeadData({ ...newLeadData, email: e.target.value })}
                  placeholder="exemplo@empresa.com"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">Telefone</label>
                <input
                  type="tel"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.phone}
                  onChange={(e) => setNewLeadData({ ...newLeadData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">Empresa</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.company}
                  onChange={(e) => setNewLeadData({ ...newLeadData, company: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">Cargo</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.role}
                  onChange={(e) => setNewLeadData({ ...newLeadData, role: e.target.value })}
                  placeholder="Cargo do lead"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Fonte do Lead</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newLeadData.source}
                  onChange={(e) => setNewLeadData({ ...newLeadData, source: e.target.value })}
                  placeholder="Ex: Anúncio, Indicação, etc."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Segmento de Negócio</label>
                <select
                  name="businessSegment"
                  value={newLeadData.businessSegment}
                  onChange={(e) => setNewLeadData({ ...newLeadData, businessSegment: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um segmento</option>
                  {businessSegments.map(segment => (
                    <option key={segment} value={segment}>{segment}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-gray-700 text-sm font-semibold mb-2">Primeira Mensagem</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                  value={newLeadData.lastMessage}
                  onChange={(e) => setNewLeadData({ ...newLeadData, lastMessage: e.target.value })}
                  placeholder="Cole ou digite a mensagem inicial aqui..."
                ></textarea>
              </div>
            </div>
            <button
              onClick={handleAddLead}
              className="mt-6 w-full bg-indigo-600 text-white text-lg font-bold px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              disabled={!newLeadData.name.trim()}
            >
              Adicionar Lead
            </button>
          </div>
        </div>
      )}

      {/* Modal para ver os detalhes do lead e editar */}
      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSave={handleSaveDetails}
          onRemove={onRemoveLead}
          conversationHistory={conversationHistory[selectedLead.id] || []}
        />
      )}
    </div>
  );
};

/**
 * Componente do Modal de Detalhes do Lead.
 * Permite visualizar e editar as informações do lead.
 */
const LeadDetailsModal = ({ lead, onClose, onSave, onRemove, conversationHistory }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState(lead);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name in editedLead.details) {
      setEditedLead(prev => ({
        ...prev,
        details: {
          ...prev.details,
          [name]: value
        }
      }));
    } else {
      setEditedLead(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSave = () => {
    onSave(editedLead);
    setIsEditing(false);
  };
  
  const handleRemove = () => {
    setShowConfirmation(true);
  };

  const confirmRemove = () => {
    onRemove(lead.id);
    setShowConfirmation(false);
    onClose();
  };

  const businessSegments = [
    'Tecnologia', 'Consultoria', 'Marketing', 'Varejo', 'Financeiro', 'Saúde', 'Outros'
  ];

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header do Modal */}
        <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="text-xl font-bold text-gray-900">{lead.name}</h3>
            <span className={`ml-3 px-3 py-1 text-sm font-semibold rounded-full ${
              lead.status === 'Qualificado' ? 'bg-green-200 text-green-800' :
              lead.status === 'Em Contato' ? 'bg-yellow-200 text-yellow-800' :
              'bg-red-200 text-red-800'
            }`}>
              {lead.status}
            </span>
          </div>
          <div className="flex items-center">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 mr-2"
                title="Salvar"
              >
                <Check size={20} />
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-gray-200 text-gray-800 p-2 rounded-full hover:bg-gray-300 mr-2"
                title="Editar"
              >
                <Edit size={20} />
              </button>
            )}
            <button
              onClick={handleRemove}
              className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 mr-2"
              title="Remover Lead"
            >
              <Trash2 size={20} />
            </button>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800 p-2">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Conteúdo do Modal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Coluna de Detalhes do Lead (Lado Esquerdo) */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-500" /> Detalhes do Lead
            </h4>
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <User size={16} className="mr-2" /> Nome
                </p>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={editedLead.name}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-lg font-bold text-gray-800">{lead.name}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <Briefcase size={16} className="mr-2" /> Empresa
                </p>
                {isEditing ? (
                  <input
                    type="text"
                    name="company"
                    value={editedLead.company}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-lg font-bold text-gray-800">{lead.company}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <AtSign size={16} className="mr-2" /> E-mail
                </p>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={editedLead.email}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-lg font-bold text-gray-800">{lead.email}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <Phone size={16} className="mr-2" /> Telefone
                </p>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={editedLead.phone}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-lg font-bold text-gray-800">{lead.phone}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <TrendingUp size={16} className="mr-2" /> Segmento
                </p>
                {isEditing ? (
                  <select
                    name="businessSegment"
                    value={editedLead.businessSegment}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecione</option>
                    {businessSegments.map(segment => (
                      <option key={segment} value={segment}>{segment}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-md text-gray-700">{lead.businessSegment}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <Book size={16} className="mr-2" /> Pontos de Dor (Pain Points)
                </p>
                {isEditing ? (
                  <textarea
                    name="painPoints"
                    value={editedLead.details.painPoints}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-lg resize-y"
                  ></textarea>
                ) : (
                  <p className="text-md text-gray-700">{lead.details.painPoints}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <Book size={16} className="mr-2" /> Notas da Solução
                </p>
                {isEditing ? (
                  <textarea
                    name="solutionNotes"
                    value={editedLead.details.solutionNotes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-lg resize-y"
                  ></textarea>
                ) : (
                  <p className="text-md text-gray-700">{lead.details.solutionNotes}</p>
                )}
              </div>
              <div className="bg-gray-100 p-4 rounded-lg shadow-inner">
                <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center">
                  <Book size={16} className="mr-2" /> Próximos Passos
                </p>
                {isEditing ? (
                  <textarea
                    name="nextSteps"
                    value={editedLead.details.nextSteps}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-lg resize-y"
                  ></textarea>
                ) : (
                  <p className="text-md text-gray-700">{lead.details.nextSteps}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Coluna de Conversas (Lado Direito) */}
          <div className="w-full md:w-1/2 p-6 bg-gray-50 border-l border-gray-200 flex flex-col overflow-y-hidden">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-indigo-500" /> Conversa
            </h4>
            <div className="flex-1 overflow-y-auto space-y-4 pr-4">
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'Eu' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-[80%] ${
                    msg.sender === 'Eu'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none shadow-sm border border-gray-200'
                  }`}>
                    <p className="font-bold text-xs mb-1 opacity-80">{msg.sender}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-right text-xs mt-1 ${
                       msg.sender === 'Eu' ? 'text-gray-200' : 'text-gray-500'
                    }`}>{msg.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-white p-4 mt-4 shadow-sm border-t border-gray-200 flex items-center rounded-lg">
              <input
                type="text"
                className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Digite uma mensagem..."
              />
              <button className="bg-indigo-600 text-white p-3 rounded-full ml-2 hover:bg-indigo-700 transition-colors">
                <Send size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Confirmação de Remoção */}
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