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
  Check,
  LogOut
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Importações para o Firebase
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, getDocs, getDoc, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Importa o novo componente de autenticação
import Auth from './Auth';

// Importa o novo componente da página do WhatsApp
import WhatsappPage from './WhatsappPage';

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

/**
 * Componente principal da aplicação.
 * Gerencia a navegação e o estado global.
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leads, setLeads] = useState([]);

  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoadingCompany(true);
      setCompanyId(null);
      setLeads([]);

      if (currentUser) {
        // Encontrar o companyId do usuário logado de forma dinâmica.
        // A lógica agora percorre as empresas para encontrar a que o usuário pertence.
        const companiesRef = collection(db, "companies");
        const companiesSnapshot = await getDocs(companiesRef);

        let foundCompanyId = null;
        for (const companyDoc of companiesSnapshot.docs) {
          // Usa getDoc para buscar apenas o documento do usuário logado
          const userDocRef = doc(db, `companies/${companyDoc.id}/users`, currentUser.uid);
          const userDocSnapshot = await getDoc(userDocRef);

          if (userDocSnapshot.exists()) {
            foundCompanyId = companyDoc.id;
            break;
          }
        }

        if (foundCompanyId) {
          setCompanyId(foundCompanyId);
          console.log("ID da empresa encontrado:", foundCompanyId);

          const leadsRef = collection(db, "companies", foundCompanyId, "leads");
          const unsubscribeLeads = onSnapshot(leadsRef, (querySnapshot) => {
            const leadsArray = [];
            querySnapshot.forEach((doc) => {
              leadsArray.push({ id: doc.id, ...doc.data() });
            });
            setLeads(leadsArray);
          });
          setLoadingCompany(false);
          return unsubscribeLeads;
        } else {
          console.warn("Usuário logado não encontrado na coleção de usuários de nenhuma empresa. Verifique se o UID está correto ou se o usuário foi adicionado à empresa.");
          setLoadingCompany(false);
          setLeads([]);
          setCompanyId(null);
        }

      } else {
        setLeads([]);
        setCompanyId(null);
        setLoadingCompany(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Erro ao fazer logout: ", e);
    }
  };

  const pages = [
    { id: 'dashboard', name: 'Visão Geral', icon: Sparkles },
    { id: 'leads', name: 'Qualificação de Leads', icon: MessageCircle },
    { id: 'automacao', name: 'Automação de Follow-up', icon: Mail },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare }, // Nova página adicionada
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
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-3 mt-4 rounded-lg text-left transition-colors hover:bg-red-500"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Sair</span>
        </button>
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
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-3 mt-4 rounded-lg text-left transition-colors hover:bg-red-500"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Sair</span>
        </button>
      </nav>
    </div>
  );
  
  const handleRemoveLead = async (leadId) => {
    if (!companyId) {
        console.error("Erro: companyId não disponível.");
        return;
    }
    try {
      const leadRef = doc(db, "companies", companyId, "leads", leadId);
      await deleteDoc(leadRef);
    } catch (e) {
      console.error("Erro ao remover documento: ", e);
    }
  };

  const handleSaveDetails = async (updatedLead) => {
    if (!companyId) {
        console.error("Erro: companyId não disponível.");
        return;
    }
    try {
      const leadRef = doc(db, "companies", companyId, "leads", updatedLead.id);
      await updateDoc(leadRef, updatedLead);
    } catch (e) {
      console.error("Erro ao atualizar documento: ", e);
    }
  };

  const handleAddLead = async (newLeadData) => {
    if (!companyId) {
        console.error("Erro: companyId não disponível.");
        return;
    }
    try {
      await addDoc(collection(db, "companies", companyId, "leads"), {
        ...newLeadData,
        status: 'Em Contato',
        dateCreated: new Date().toISOString().slice(0, 10),
        details: {
          painPoints: '',
          solutionNotes: '',
          nextSteps: '',
        },
      });
    } catch (e) {
      console.error("Erro ao adicionar documento: ", e);
    }
  };

  const renderPage = () => {
    if (loadingCompany) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="mt-4 text-gray-600">Carregando dados da empresa...</p>
        </div>
      );
    }

    if (!companyId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado ou Empresa não Encontrada</h2>
          <p className="text-gray-600 mb-4">
            O seu usuário não está associado a nenhuma empresa no nosso banco de dados.
            Para acessar, certifique-se de que seu e-mail foi adicionado à subcoleção 'users' de uma empresa.
          </p>
          <button
            onClick={handleLogout}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors mt-4"
          >
            Sair
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard leads={leads} />;
      case 'leads':
        return <KanbanBoard leads={leads} onRemoveLead={handleRemoveLead} onSave={handleSaveDetails} onAddLead={handleAddLead} />;
      case 'automacao':
        return <AutomationPage />;
      case 'whatsapp':
        return <WhatsappPage companyId={companyId} />;
      case 'analise':
        return <AnalysisPage />;
      case 'reports':
        return <ReportsPage leads={leads} />;
      default:
        return <Dashboard leads={leads} />;
    }
  };
  
  if (!user) {
    return <Auth />;
  }

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
          <button onClick={handleLogout} className="text-gray-600 hover:text-gray-800">
            <LogOut className="h-6 w-6" />
          </button>
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
  
  const processLeadsData = (leadsToProcess) => {
    const dataByMonth = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    leadsToProcess.forEach(lead => {
      const date = new Date(lead.dateCreated);
      const month = date.getMonth();
      const monthName = monthNames[month];

      if (!dataByMonth[monthName]) {
        dataByMonth[monthName] = {
          name: monthName,
          qualificados: 0,
          naoQualificados: 0,
          'em Contato': 0 
        };
      }

      const statusMap = {
        'Qualificado': 'qualificados',
        'Não Qualificado': 'naoQualificados',
        'Em Contato': 'em Contato',
      };
      const statusKey = statusMap[lead.status];
      if (statusKey) {
        dataByMonth[monthName][statusKey]++;
      }
    });

    const processedData = Object.values(dataByMonth).sort((a, b) => monthNames.indexOf(a.name) - monthNames.indexOf(b.name));
    
    const currentMonth = new Date().getMonth();
    const finalData = [];
    for (let i = 0; i <= currentMonth; i++) {
        const monthName = monthNames[i];
        const existingData = processedData.find(item => item.name === monthName);
        if (existingData) {
            finalData.push(existingData);
        } else {
            finalData.push({ name: monthName, qualificados: 0, naoQualificados: 0, 'em Contato': 0 });
        }
    }
    
    return finalData;
  };

  const dashboardData = processLeadsData(leads);
  const recentLeads = leads.slice(0, 5);
  
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(l => l.status === 'Qualificado').length;
  const qualificationRate = totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(1) : 0;

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
            <p className="text-3xl font-bold text-indigo-600">{qualifiedLeads}</p>
            <p className="text-sm text-gray-500 mt-1">Total de leads que avançaram</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Total de Leads</h3>
            <p className="text-3xl font-bold text-green-600">{totalLeads}</p>
            <p className="text-sm text-gray-500 mt-1">Leads cadastrados na plataforma</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 flex items-center">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full mr-4">
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Taxa de Qualificação</h3>
            <p className="text-3xl font-bold text-yellow-600">{qualificationRate}%</p>
            <p className="text-sm text-gray-500 mt-1">Porcentagem de leads qualificados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Qualificação de Leads por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardData}>
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
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Qualificação de Leads por Mês (Linha)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboardData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="qualificados" name="Leads Qualificados" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="naoQualificados" name="Leads Não Qualificados" stroke="#ef4444" strokeWidth={2} />
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

const AnalysisPage = () => {
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!textToAnalyze.trim()) {
      setError("Por favor, insira um texto para análise.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    const prompt = `Analise o seguinte texto de uma conversa com um cliente e identifique: 1. O principal sentimento (positivo, negativo, neutro). 2. O principal problema ou necessidade do cliente. 3. Sugestões de melhoria para o atendimento. 4. Qual seria o próximo passo ideal para o time de vendas ou suporte. Responda em formato de JSON com as chaves "sentimento", "problema", "sugestoes" (array de strings) e "proximo_passo". O texto a ser analisado é: "${textToAnalyze}"`;

    try {
      const history = [{ role: 'user', parts: [{ text: prompt }] }];
      const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "sentimento": { "type": "STRING" },
            "problema": { "type": "STRING" },
            "sugestoes": { "type": "ARRAY", "items": { "type": "STRING" } },
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
                  analysisResult.sentimento.toLowerCase() === 'negativo' ? 'text-red-600' :
                  'text-gray-600'
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

const ReportsPage = ({ leads }) => {
  const [filters, setFilters] = useState({
    status: '',
    businessSegment: '',
    startDate: '',
    endDate: '',
  });

  const [filteredLeads, setFilteredLeads] = useState([]);

  useEffect(() => {
    setFilteredLeads(leads);
  }, [leads]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
  };

  const applyFilters = () => {
    const filtered = leads.filter(lead => {
      const statusMatch = filters.status ? lead.status === filters.status : true;
      const segmentMatch = filters.businessSegment ? lead.businessSegment === filters.businessSegment : true;

      let dateMatch = true;
      if (filters.startDate) {
        dateMatch = dateMatch && (new Date(lead.dateCreated) >= new Date(filters.startDate));
      }
      if (filters.endDate) {
        dateMatch = dateMatch && (new Date(lead.dateCreated) <= new Date(filters.endDate));
      }

      return statusMatch && segmentMatch && dateMatch;
    });
    setFilteredLeads(filtered);
  };
  
  const handleExportCSV = () => {
    const headers = ["Nome", "Email", "Telefone", "Empresa", "Segmento", "Status", "Data de Criação"];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + filteredLeads.map(e => [
        `"${e.name}"`, 
        `"${e.email}"`, 
        `"${e.phone || 'N/A'}"`, 
        `"${e.company || 'N/A'}"`, 
        `"${e.businessSegment || 'N/A'}"`, 
        `"${e.status}"`, 
        `"${e.dateCreated}"`
      ].join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_completo_fluxoconnect.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerar Relatórios</h2>
      <p className="text-gray-600 mb-6">
        Filtre e exporte dados detalhados dos seus leads para análises personalizadas.
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
        <h3 className="text-xl font-semibold mb-4">Filtros de Relatório</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">Todos</option>
              <option value="Em Contato">Em Contato</option>
              <option value="Qualificado">Qualificado</option>
              <option value="Não Qualificado">Não Qualificado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Segmento</label>
            <input
              type="text"
              name="businessSegment"
              value={filters.businessSegment}
              onChange={handleFilterChange}
              placeholder="Ex: Tecnologia"
              className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Inicial</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Final</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={applyFilters}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Aplicar Filtros
          </button>
          <button
            onClick={() => setFilters({ status: '', businessSegment: '', startDate: '', endDate: '' })}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Leads Filtrados ({filteredLeads.length})</h3>
          <button
            onClick={handleExportCSV}
            className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
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
              {filteredLeads.map((lead, index) => (
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
    </div>
  );
};

const KanbanBoard = ({ leads, onRemoveLead, onSave, onAddLead }) => {
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', company: '', businessSegment: '', details: { painPoints: '', solutionNotes: '', nextSteps: '' } });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  
  const statusColumns = [
    { id: 'Em Contato', name: 'Em Contato', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'Qualificado', name: 'Qualificado', color: 'bg-green-100 text-green-800' },
    { id: 'Não Qualificado', name: 'Não Qualificado', color: 'bg-red-100 text-red-800' },
  ];

  const handleDragStart = (e, leadId, status) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.setData('sourceStatus', status);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');

    if (sourceStatus !== targetStatus) {
      const leadToUpdate = leads.find(lead => lead.id === leadId);
      if (leadToUpdate) {
        onSave({ ...leadToUpdate, status: targetStatus });
      }
    }
  };

  const openNewLeadModal = () => {
    setNewLead({ name: '', email: '', phone: '', company: '', businessSegment: '', details: { painPoints: '', solutionNotes: '', nextSteps: '' } });
    setIsNewLeadModalOpen(true);
  };
  
  const handleNewLeadChange = (e) => {
    const { name, value } = e.target;
    setNewLead(prev => ({ ...prev, [name]: value }));
  };

  const handleNewLeadDetailsChange = (e) => {
    const { name, value } = e.target;
    setNewLead(prev => ({ ...prev, details: { ...prev.details, [name]: value } }));
  };

  const handleAddLeadSubmit = (e) => {
    e.preventDefault();
    onAddLead(newLead);
    setIsNewLeadModalOpen(false);
  };
  
  const openEditModal = (lead) => {
    setSelectedLead(lead);
    setIsEditModalOpen(true);
  };
  
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setSelectedLead(prev => ({ ...prev, [name]: value }));
  };

  const handleEditDetailsChange = (e) => {
    const { name, value } = e.target;
    setSelectedLead(prev => ({ ...prev, details: { ...prev.details, [name]: value } }));
  };
  
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (selectedLead) {
      onSave(selectedLead);
      setIsEditModalOpen(false);
      setSelectedLead(null);
    }
  };

  const getLeadsByStatus = (status) => {
    return leads.filter(lead => lead.status === status);
  };
  
  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Qualificação de Leads</h2>
        <button
          onClick={openNewLeadModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Lead
        </button>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-4">
        {statusColumns.map(column => (
          <div
            key={column.id}
            onDrop={(e) => handleDrop(e, column.id)}
            onDragOver={handleDragOver}
            className="flex-shrink-0 w-80 bg-gray-200 p-4 rounded-xl shadow-inner"
          >
            <h3 className={`text-sm font-semibold p-2 rounded-lg text-center mb-4 ${column.color}`}>{column.name} ({getLeadsByStatus(column.id).length})</h3>
            <div className="space-y-4">
              {getLeadsByStatus(column.id).map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id, column.id)}
                  className="bg-white p-4 rounded-lg shadow-md cursor-grab active:cursor-grabbing transform transition-transform duration-150 hover:scale-[1.02]"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-gray-800">{lead.name}</p>
                    <div className="flex space-x-2">
                      <button onClick={() => openEditModal(lead)} title="Editar" className="text-gray-500 hover:text-indigo-600">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => onRemoveLead(lead.id)} title="Remover" className="text-gray-500 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center mb-1">
                    <Mail size={14} className="mr-2 text-gray-400" />
                    {lead.email}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center mb-1">
                    <Briefcase size={14} className="mr-2 text-gray-400" />
                    {lead.company || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Book size={14} className="mr-2 text-gray-400" />
                    {lead.businessSegment || 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para adicionar novo lead */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Adicionar Novo Lead</h3>
            <form onSubmit={handleAddLeadSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Nome Completo"
                  value={newLead.name}
                  onChange={handleNewLeadChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={newLead.email}
                  onChange={handleNewLeadChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Telefone (opcional)"
                  value={newLead.phone}
                  onChange={handleNewLeadChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  name="company"
                  placeholder="Empresa (opcional)"
                  value={newLead.company}
                  onChange={handleNewLeadChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  name="businessSegment"
                  placeholder="Segmento de Negócios (opcional)"
                  value={newLead.businessSegment}
                  onChange={handleNewLeadChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-4">
                <textarea
                  name="painPoints"
                  placeholder="Pontos de dor (opcional)"
                  value={newLead.details.painPoints}
                  onChange={handleNewLeadDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
                <textarea
                  name="solutionNotes"
                  placeholder="Notas sobre a solução (opcional)"
                  value={newLead.details.solutionNotes}
                  onChange={handleNewLeadDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
                <textarea
                  name="nextSteps"
                  placeholder="Próximos passos (opcional)"
                  value={newLead.details.nextSteps}
                  onChange={handleNewLeadDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsNewLeadModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Adicionar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar lead */}
      {isEditModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Editar Lead</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Nome Completo"
                  value={selectedLead.name}
                  onChange={handleEditChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={selectedLead.email}
                  onChange={handleEditChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Telefone (opcional)"
                  value={selectedLead.phone}
                  onChange={handleEditChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  name="company"
                  placeholder="Empresa (opcional)"
                  value={selectedLead.company}
                  onChange={handleEditChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  name="businessSegment"
                  placeholder="Segmento de Negócios (opcional)"
                  value={selectedLead.businessSegment}
                  onChange={handleEditChange}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-4">
                <textarea
                  name="painPoints"
                  placeholder="Pontos de dor (opcional)"
                  value={selectedLead.details?.painPoints || ''}
                  onChange={handleEditDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
                <textarea
                  name="solutionNotes"
                  placeholder="Notas sobre a solução (opcional)"
                  value={selectedLead.details?.solutionNotes || ''}
                  onChange={handleEditDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
                <textarea
                  name="nextSteps"
                  placeholder="Próximos passos (opcional)"
                  value={selectedLead.details?.nextSteps || ''}
                  onChange={handleEditDetailsChange}
                  rows="3"
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const NewLeadForm = () => {
  const [lead, setLead] = useState({ name: '', email: '', phone: '', company: '', businessSegment: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLead(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitted(true);
  };
  
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">Adicionar Novo Lead</h3>
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Nome Completo"
            value={lead.name}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={lead.email}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Telefone (opcional)"
            value={lead.phone}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            name="company"
            placeholder="Empresa (opcional)"
            value={lead.company}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            name="businessSegment"
            placeholder="Segmento de Negócios (opcional)"
            value={lead.businessSegment}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Adicionar Lead
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center p-8 bg-green-50 rounded-lg">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-800">Lead Adicionado com Sucesso!</h4>
          <p className="text-gray-600 mt-2">O lead de {lead.name} foi adicionado à sua lista.</p>
        </div>
      )}
    </div>
  );
};