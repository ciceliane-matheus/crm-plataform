import { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
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
  LogOut,
  Target,
  BarChart as BarChartIcon,
  Archive,
  Tag,
  Settings,
  ArchiveRestore,
  Search,
  Calculator
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import CalculatorPage from './CalculatorPage';

// Importações para o Firebase
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, getDocs, getDoc, where, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Importa o novo componente de autenticação
import Auth from './Auth';

// Importa o novo componente da página do WhatsApp
import WhatsappPage from './WhatsappPage';
import axios from 'axios';

import { startOfWeek, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Função para converter JSON de string para objeto, com tratamento de erro.
 * @param {string} jsonString A string JSON a ser analisada.
 * @returns {Object|null} O objeto JavaScript analisado ou null em caso de erro.
 */
async function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Erro ao fazer o parse do JSON:", error, "Texto recebido:", jsonString);
    return { error: jsonString }; // retorna o texto bruto no campo error
  }
}

/**
 * Função principal para chamar a API do Gemini com retentativas e backoff exponencial.
 * Esta função lida com limites de taxa e erros de rede.
 * @param {Array} history O histórico da conversa para enviar à API.
 * @param {Object} generationConfig A configuração para a geração de resposta (opcional).
 * @returns {Promise<string>} O texto da resposta da IA ou uma mensagem de erro.
 */

async function callGeminiAPI(history) {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/analise/gemini`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textToAnalyze: history.map(h => h.parts?.[0]?.text).join(" ")
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Erro no backend: ${response.status}`);
    }

    const result = await response.json();
    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error("Erro ao chamar o backend:", error);
    return "Erro na análise. Tente novamente mais tarde.";
  }
}


/**
 * Componente principal da aplicação.
 * Gerencia a navegação e o estado global.
 */

const COLUMN_TYPES = [
  { value: 'transit', label: 'Trânsito' },
  { value: 'initial', label: 'Inicial' },
  { value: 'positive_conclusion', label: 'Conclusão Positiva' },
  { value: 'negative_conclusion', label: 'Conclusão Negativa' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [kanbanColumns, setKanbanColumns] = useState([]);
  const [tags, setTags] = useState([]);
  const [segments, setSegments] = useState([]);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [companyUsers, setCompanyUsers] = useState([]);

  useEffect(() => {
    if (!companyId) return;

    // Busca a lista de usuários da empresa para usar em seletores
    const usersRef = collection(db, "companies", companyId, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        // Supondo que o nome do usuário está salvo no documento dele
        // Ajuste 'name' se o campo tiver outro nome (ex: 'displayName')
        ...doc.data() 
      }));
      setCompanyUsers(fetchedUsers);
    });

    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const segmentsRef = collection(db, "companies", companyId, "segments");
    const q = query(segmentsRef, orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSegments(fetchedSegments);
    });
    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const tagsRef = collection(db, "companies", companyId, "tags");
    const q = query(tagsRef, orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTags(fetchedTags);
    });
    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setLoadingCompany(true);
        
        // Nova lógica: Busca o "atalho" do usuário diretamente
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        setAuthLoading(false);

        if (userDocSnap.exists() && userDocSnap.data().companyId) {
          const foundCompanyId = userDocSnap.data().companyId;
          setCompanyId(foundCompanyId);
          console.log('[FRONTEND LOGIN] Company ID encontrado e definido:', foundCompanyId);
          console.log("ID da empresa encontrado via atalho:", foundCompanyId);

          // Configura o listener para os leads da empresa encontrada
          const leadsRef = collection(db, "companies", foundCompanyId, "leads");
          const unsubscribeLeads = onSnapshot(leadsRef, (querySnapshot) => {
            const leadsArray = [];
            querySnapshot.forEach((doc) => {
              leadsArray.push({ id: doc.id, ...doc.data() });
            });

            // ORDENA A LISTA PELA DATA MAIS RECENTE
            leadsArray.sort((a, b) => {
              const timestampA = a.timestamp?.toDate() || 0;
              const timestampB = b.timestamp?.toDate() || 0;
              return timestampB - timestampA; // Ordem decrescente
            });

            setLeads(leadsArray);
          });
          setLoadingCompany(false);
          // Retornamos a função de limpeza para o listener de leads
          return () => unsubscribeLeads();
        } else {
          console.error("Usuário logado, mas sem 'companyId' no seu documento da coleção /users.");
          setCompanyId(null);
          setLeads([]);
          setLoadingCompany(false);
        }
      } else {
        // Usuário deslogado
        setCompanyId(null);
        setLeads([]);
        setLoadingCompany(false);
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);


  useEffect(() => {
    if (!companyId) return;
    const columnsDocRef = doc(db, "companies", companyId, "kanban_settings", "columns");
    const unsubscribe = onSnapshot(columnsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) {
        const sortedColumns = [...docSnap.data().list].sort((a, b) => a.order - b.order);
        setKanbanColumns(sortedColumns); // Atualiza o estado do App
      } else {
        setKanbanColumns([]); // Limpa se não encontrar
      }
    });
    return () => unsubscribe();
  }, [companyId]); // A dependência é apenas o companyId

  const handleLogout = () => {
    setIsLogoutModalOpen(true); // Apenas abre o modal
  };

  const pages = [
    { id: 'dashboard', name: 'Visão Geral', icon: Sparkles },
    { id: 'leads', name: 'Qualificação de Leads', icon: MessageCircle },
    { id: 'automacao', name: 'Automação de Follow-up', icon: Mail },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare }, // Nova página adicionada
    { id: 'analise', name: 'Análise de Conversas', icon: TrendingUp },
    { id: 'calculator', name: 'Calculadora de Vendas', icon: Calculator },
    { id: 'reports', name: 'Gerar Relatórios', icon: FileText }
  ];

  const Sidebar = () => (
    // O container principal não precisa mais das classes flex, pois o botão será posicionado de forma absoluta.
    <div className="w-64 bg-gray-900 text-gray-200 h-screen p-6 hidden md:block fixed left-0 top-0">
      
      {/* Logo e Navegação continuam normalmente */}
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

      {/* Botão de Sair com posicionamento absoluto */}
      <button
        onClick={handleLogout}
        // A mágica acontece aqui:
        className="absolute bottom-6 left-6 p-3 rounded-lg transition-colors hover:bg-red-800 hover:text-white"
        title="Sair" 
      >
        <LogOut className="h-5 w-5" />
      </button>

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
        {pages.filter(p => p.id !== 'whatsapp').map(page => (
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
  
  const handleArchiveLead = async (leadId) => {
    if (!companyId) {
        console.error("Erro: companyId não disponível.");
        return;
    }
    try {
      const leadRef = doc(db, "companies", companyId, "leads", leadId);
      // A mágica acontece aqui: mudamos o status em vez de deletar
      await updateDoc(leadRef, { status: 'Arquivado' }); 
    } catch (e) {
      console.error("Erro ao arquivar documento: ", e);
    }
  };

  const handleRestoreLead = async (leadId) => {
    if (!companyId || kanbanColumns.length === 0) {
      console.error("Erro: ID da empresa ou colunas não disponíveis.");
      return;
    }
    try {
      // Encontra a primeira coluna do funil (a do tipo 'Inicial')
      const initialColumn = kanbanColumns.find(c => c.type === 'initial') || kanbanColumns[0];
      const leadRef = doc(db, "companies", companyId, "leads", leadId);
      // Atualiza o status do lead para o da coluna inicial
      await updateDoc(leadRef, { status: initialColumn.name });
    } catch (e) {
      console.error("Erro ao restaurar documento: ", e);
    }
  };

  const handleSaveDetails = async (updatedLead, previousStatus) => {
    if (!companyId) {
      console.error("Erro: companyId não disponível.");
      return;
    }

    try {
      const leadRef = doc(db, "companies", companyId, "leads", updatedLead.id);
      
      // Lógica para determinar se a data de qualificação deve ser adicionada
      const positiveConclusionStatusNames = kanbanColumns
        .filter(c => c.type === 'positive_conclusion')
        .map(c => c.name);

      const wasInPositiveStatus = positiveConclusionStatusNames.includes(previousStatus);
      const isNowInPositiveStatus = positiveConclusionStatusNames.includes(updatedLead.status);
      
      const updatePayload = {
        ...updatedLead,
        timestamp: serverTimestamp() // Atualiza sempre a data da última modificação
      };

      // A condição mágica: entra no status de sucesso, não estava antes, e não tem data de qualificação
      if (isNowInPositiveStatus && !wasInPositiveStatus && !updatedLead.qualificationDate) {
        updatePayload.qualificationDate = serverTimestamp(); // Grava a data da conquista
        console.log(`Lead ${updatedLead.id} qualificado pela primeira vez!`);
      }

      await updateDoc(leadRef, updatePayload);

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
        dateCreated: new Date().toISOString(),
        source: 'manual', 
        tags: [],
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

  const handleViewAndEditLead = (lead) => {
    setSelectedLead(lead);
    setIsEditModalOpen(true);
    setCurrentPage('leads'); // Muda para a página do Kanban
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
        return <Dashboard 
          leads={leads} 
          kanbanColumns={kanbanColumns} 
          onViewLead={handleViewAndEditLead} 
          companyId={companyId}
          companyUsers={companyUsers}
        />;
      case 'leads':
        return <KanbanBoard 
          kanbanColumns={kanbanColumns}
          tags={tags}
          segments={segments}
          leads={leads}
          onArchiveLead={handleArchiveLead}
          onRestoreLead={handleRestoreLead}
          onSave={handleSaveDetails} 
          onAddLead={handleAddLead} 
          companyId={companyId}
          isEditModalOpen={isEditModalOpen}
          setIsEditModalOpen={setIsEditModalOpen}
          selectedLead={selectedLead}
          setSelectedLead={setSelectedLead}
          companyUsers={companyUsers}
        />;
      case 'automacao':
        return <AutomationPage companyId={companyId} kanbanColumns={kanbanColumns} />;
      case 'whatsapp':
        const activeConversations = leads.filter(l => l.source === 'whatsapp' && l.status !== 'Arquivado');
        return <WhatsappPage companyId={companyId} conversations={activeConversations} onArchiveLead={handleArchiveLead} />;
      case 'analise':
        return <AnalysisPage />;
      case 'reports':
        return <ReportsPage kanbanColumns={kanbanColumns} tags={tags} segments={segments} leads={leads} />;
      default:
        return <Dashboard leads={leads} />;
      case 'calculator': // <-- NOVO CASE
        return <CalculatorPage companyId={companyId} leads={leads} />;
    }
  };
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const LogoutConfirmationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Confirmar Saída</h2>
        <p className="text-gray-600 mb-6">Você tem certeza que deseja sair da plataforma?</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setIsLogoutModalOpen(false)}
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                await signOut(auth);
                setIsLogoutModalOpen(false); // Fecha o modal após o sucesso
              } catch (e) {
                console.error("Erro ao fazer logout: ", e);
                toast.error("Não foi possível sair. Tente novamente.");
              }
            }}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 font-semibold"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <Toaster position="top-right" />
      {isLogoutModalOpen && <LogoutConfirmationModal />}
      <Sidebar />
      <MobileMenu />

      {/* Este container precisa ser 'flex-col' para o 'flex-1' do <main> funcionar */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 min-h-0">
        <header className="bg-white shadow-md p-4 md:hidden flex justify-between items-center sticky top-0 z-40">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            Fluxo<span className="text-indigo-500">Connect</span>
          </h1>
        </header>

        {/* A tag <main> é crucial. 'flex-1' faz ela esticar e 'overflow-hidden' contém seus filhos. */}
        <main className="flex-1 flex flex-col p-6 md:p-10 min-h-0">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

// App.js -> SUBSTITUA O COMPONENTE DASHBOARD INTEIRO POR ESTE CÓDIGO

const Dashboard = ({ leads, kanbanColumns, onViewLead, companyId, companyUsers }) => {
  const [historicalMonthlyData, setHistoricalMonthlyData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [aiInsight, setAiInsight] = useState({ loading: true, data: null });

  // Busca os dados de performance MENSAL
  useEffect(() => {
    if (!companyId) return;
    const monthlyRef = collection(db, "companies", companyId, "monthly_performance");
    const q = query(monthlyRef, orderBy("year", "desc"), orderBy("month", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoricalMonthlyData(data);
      if (data.length > 0) {
        const years = [...new Set(data.map(d => d.year))];
        const currentYear = new Date().getFullYear();
        if (!years.includes(currentYear)) years.push(currentYear);
        setAvailableYears(years.sort((a, b) => b - a));
      }
    });
    return () => unsubscribe();
  }, [companyId]);

  // Busca os insights da IA (COM A CORREÇÃO)
  useEffect(() => {
    if (!companyId) return;
    setAiInsight({ loading: true, data: null });
    const insightsRef = collection(db, "companies", companyId, "insights");
    // --- LINHA CORRIGIDA ---
    const q = query(insightsRef, orderBy("generatedAt", "desc"), limit(1)); // Usando a função limit() corretamente
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setAiInsight({ loading: false, data: snapshot.docs[0].data() });
      } else {
        setAiInsight({ loading: false, data: null });
      }
    });
    return () => unsubscribe();
  }, [companyId]);

  const dashboardData = useMemo(() => {
    const positiveConclusionStatusNames = kanbanColumns.filter(c => c.type === 'positive_conclusion').map(c => c.name);
    const initialStatusNames = kanbanColumns.filter(c => c.type === 'initial').map(c => c.name);
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    const qualifiedLeadsToday = leads.filter(l => l.qualificationDate && format(l.qualificationDate.toDate(), 'yyyy-MM-dd') === todayStr && positiveConclusionStatusNames.includes(l.status)).length;
    const newLeadsToday = leads.filter(l => format(new Date(l.dateCreated), 'yyyy-MM-dd') === todayStr).length;

    const yearlyTotalsFromCron = historicalMonthlyData.filter(d => d.year === selectedYear).reduce((acc, curr) => {
        acc.captados += curr.totalNewLeadsCount || 0;
        acc.qualificados += curr.totalQualifiedCount || 0;
        return acc;
      }, { captados: 0, qualificados: 0 });
    
    const displayYearlyTotals = { captados: yearlyTotalsFromCron.captados + newLeadsToday, qualificados: yearlyTotalsFromCron.qualificados + qualifiedLeadsToday };

    const monthlyPerformanceForYear = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1;
      const monthData = historicalMonthlyData.find(d => d.year === selectedYear && d.month === monthIndex);
      let captados = monthData ? monthData.totalNewLeadsCount : 0;
      let qualificados = monthData ? monthData.totalQualifiedCount : 0;
      if (selectedYear === now.getFullYear() && monthIndex === (now.getMonth() + 1)) {
        captados += newLeadsToday;
        qualificados += qualifiedLeadsToday;
      }
      return { name: new Date(selectedYear, i, 1).toLocaleString('pt-BR', { month: 'short' }), Captados: captados, Qualificados: qualificados };
    });
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const leadsLast7Days = leads.filter(l => new Date(l.dateCreated) >= sevenDaysAgo);
    const qualifiedLast7Days = leads.filter(l => l.qualificationDate && l.qualificationDate.toDate() >= sevenDaysAgo && positiveConclusionStatusNames.includes(l.status)).length;
    const funnelData = { new: leadsLast7Days.length, contacted: leadsLast7Days.filter(l => !initialStatusNames.includes(l.status)).length, qualified: qualifiedLast7Days };
    const recentActivities = leads.sort((a,b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0)).slice(0, 5);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const qualifiedThisMonth = leads.filter(l =>
      l.qualificationDate &&
      l.qualificationDate.toDate() >= startOfMonth &&
      l.qualificationDate.toDate() <= endOfMonth &&
      positiveConclusionStatusNames.includes(l.status) &&
      l.responsibleUserId
    );

    const performanceByUser = qualifiedThisMonth.reduce((acc, lead) => {
      acc[lead.responsibleUserId] = (acc[lead.responsibleUserId] || 0) + 1;
      return acc;
    }, {});

    const rankingData = Object.entries(performanceByUser)
      .map(([userId, count]) => {
        const user = (companyUsers || []).find(u => u.id === userId);
        return {
          name: user?.name || user?.email || 'Desconhecido',
          qualified: count
        };
      })
      .sort((a, b) => b.qualified - a.qualified);

    return { yearlyTotals: displayYearlyTotals, monthlyPerformanceForYear, funnelData, recentActivities, rankingData };
  }, [leads, kanbanColumns, historicalMonthlyData, selectedYear, companyUsers]);
  
  const generateActivityText = (lead) => {
    const creationTime = new Date(lead.dateCreated).getTime();
    const updateTime = lead.timestamp ? lead.timestamp.toDate().getTime() : creationTime;
    const isCreationEvent = Math.abs(updateTime - creationTime) < 5000;
    if (isCreationEvent) {
      if (lead.source === 'whatsapp') { return 'Nova conversa recebida.'; }
      if (lead.source === 'manual') { return 'Novo lead criado manualmente.'; }
      return 'Novo lead adicionado.';
    }
    return `Movido para "${lead.status}"`;
  };

  const renderActivityIcon = (lead) => {
    const positiveConclusionStatusNames = kanbanColumns.filter(c => c.type === 'positive_conclusion').map(c => c.name);
    const negativeConclusionStatusNames = kanbanColumns.filter(c => c.type === 'negative_conclusion').map(c => c.name);
    if (positiveConclusionStatusNames.includes(lead.status)) {
      return <CheckCircle className="text-green-500" size={20} />;
    }
    if (negativeConclusionStatusNames.includes(lead.status)) {
      return <X className="text-red-500" size={20} />;
    }
    return <MessageCircle className="text-blue-500" size={20} />;
  };
  
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex-shrink-0 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard de Performance</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-semibold text-gray-700">Ano:</label>
          <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-lg bg-white shadow-sm text-sm">
            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-xl shadow-lg flex flex-col justify-center">
          <h4 className="font-bold text-sm opacity-80 text-center">Performance de {selectedYear}</h4>
          <div className="flex items-baseline justify-evenly mt-2">
            <div className="text-center">
              <p className="text-3xl font-bold">{dashboardData.yearlyTotals.captados}</p>
              <p className="text-xs font-semibold opacity-80">Leads Captados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{dashboardData.yearlyTotals.qualificados}</p>
              <p className="text-xs font-semibold opacity-80">Leads Qualificados</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg lg:col-span-2">
          <h3 className="font-bold text-sm text-gray-700 mb-2">Funil de Vendas (Últimos 7 dias)</h3>
          <div className="flex items-center justify-between text-center">
            <div className="w-1/3"><p className="text-2xl font-bold text-gray-800">{dashboardData.funnelData.new}</p><p className="text-xs font-semibold text-gray-500">Novos Leads</p></div>
            <ChevronRight size={20} className="text-gray-300" />
            <div className="w-1/3"><p className="text-2xl font-bold text-gray-800">{dashboardData.funnelData.contacted}</p><p className="text-xs font-semibold text-gray-500">Contatados</p></div>
            <ChevronRight size={20} className="text-gray-300" />
            <div className="w-1/3"><p className="text-2xl font-bold text-green-500">{dashboardData.funnelData.qualified}</p><p className="text-xs font-semibold text-green-600">Qualificados</p></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-lg lg:col-span-2 h-72 flex flex-col">
          <h3 className="text-base font-semibold text-gray-800 mb-2">Captados vs. Qualificados ({selectedYear})</h3>
          <div className="flex-grow">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.monthlyPerformanceForYear} margin={{ top: 10, right: 20, left: -10, bottom: -5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip /><Legend wrapperStyle={{fontSize: "12px"}} />
                <Bar dataKey="Captados" fill="#a5b4fc" radius={[4, 4, 0, 0]} name="Leads Captados" />
                <Bar dataKey="Qualificados" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Leads Qualificados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col">
          <h3 className="font-bold text-sm text-gray-700 mb-3">Ranking de Corretores (Mês)</h3>
          {dashboardData.rankingData.length > 0 ? (
            <div className="space-y-3 flex-grow">
              {dashboardData.rankingData.map((user, index) => (
                <div key={user.name} className="flex items-center text-sm">
                  <span className="font-bold text-gray-400 w-6">{index + 1}.</span>
                  <span className="flex-grow font-semibold text-gray-700">{user.name}</span>
                  <span className="font-bold text-indigo-600">{user.qualified}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <p className="text-xs text-center text-gray-400 p-2 bg-gray-50 rounded-md">Nenhum corretor qualificou leads este mês ainda.</p>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-purple-500 lg:col-span-2">
           <h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center"><Sparkles size={16} className="mr-2 text-purple-500"/> Insights da Semana</h3>
           {aiInsight.loading ? ( <div className="flex items-center text-sm text-gray-500"><Loader2 className="animate-spin mr-2" size={16} /> Carregando insights...</div>) : aiInsight.data && aiInsight.data.insights ? ( <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">{aiInsight.data.insights.map((insight, index) => (<li key={index}>{insight}</li>))}</ul>) : ( <p className="text-sm text-gray-500 text-center py-2">Nenhum insight disponível. Acione o robô de análise para gerar.</p>)}
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col">
          <h3 className="font-bold text-sm text-gray-700 mb-3">Atividades Recentes</h3>
          <div className="space-y-3 overflow-y-auto flex-1">{dashboardData.recentActivities.map(lead => ( <div key={lead.id} className="flex items-start"><div className="mt-1 mr-3 flex-shrink-0">{renderActivityIcon(lead)}</div><div><p className="text-xs font-semibold text-gray-800">{lead.name}</p><p className="text-xs text-gray-500">{generateActivityText(lead)}</p></div></div>))}</div>
        </div>
      </div>
    </div>
  );
};

const AutomationPage = ({ companyId, kanbanColumns }) => {
  const [automations, setAutomations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); 
  const [editingAutomation, setEditingAutomation] = useState(null); 
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
    triggerType: 'status_change',
    triggerValue: { columnName: '', days: 3 },
    actionType: 'send_whatsapp',
    actionValue: { message: '' }
  });

  // Busca as regras de automação do Firestore
  useEffect(() => {
    if (!companyId) return;
    const automationsRef = collection(db, "companies", companyId, "automations");
    const q = query(automationsRef, orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAutomations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAutomations(fetchedAutomations);
    });
    return () => unsubscribe();
  }, [companyId]);

  const openNewRuleModal = () => {
    setEditingAutomation(null);
    setFormData({
      name: '',
      isActive: true,
      triggerType: 'status_change',
      triggerValue: { columnName: kanbanColumns.length > 0 ? kanbanColumns[0].name : '', days: 3 },
      actionType: 'send_whatsapp',
      actionValue: { message: '' }
    });
    setWizardStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (automation) => {
    setEditingAutomation(automation);
    setFormData(automation);
    setWizardStep(3); // Pula direto para a tela de edição final
    setIsModalOpen(true);
  };
  
  const handleTriggerSelect = (triggerType) => {
    setFormData(prev => ({ ...prev, triggerType }));
    setWizardStep(2);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setWizardStep(1), 300);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'isActive') {
      setFormData(prev => ({ ...prev, isActive: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTriggerValueChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, triggerValue: { ...prev.triggerValue, [name]: value } }));
  };

  const handleActionValueChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, actionValue: { ...prev.actionValue, [name]: value } }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingAutomation) {
        // Lógica de ATUALIZAÇÃO
        const ruleRef = doc(db, "companies", companyId, "automations", editingAutomation.id);
        await updateDoc(ruleRef, formData);
        toast.success("Regra atualizada com sucesso!");
      } else {
        // Lógica de CRIAÇÃO
        const automationsRef = collection(db, "companies", companyId, "automations");
        await addDoc(automationsRef, formData);
        toast.success("Nova regra criada com sucesso!");
      }
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar regra:", error);
      toast.error("Falha ao salvar a regra.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (automationId) => {
    if (!window.confirm("Tem certeza que deseja excluir esta regra?")) return;
    try {
      await deleteDoc(doc(db, "companies", companyId, "automations", automationId));
      toast.success("Regra excluída com sucesso!");
    } catch (error) {
      toast.error("Falha ao excluir a regra.");
    }
  };

  const goToNextStep = () => setWizardStep(wizardStep + 1);
  const goToPreviousStep = () => setWizardStep(wizardStep - 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Automação de Follow-Up</h2>
        <p className="text-gray-600 mt-1">
          Crie regras para automatizar tarefas repetitivas e garantir que nenhum lead seja esquecido.
        </p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-lg flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Minhas Regras de Automação</h3>
          <button onClick={openNewRuleModal} className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Criar Nova Regra
          </button>
        </div>
        
        {/* --- NOVO DESIGN DA LISTA DE REGRAS --- */}
        <div className="space-y-4 overflow-y-auto">
          {automations.length > 0 ? automations.map(auto => (
            <div key={auto.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-gray-800">{auto.name}</h4>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${auto.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                    {auto.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => openEditModal(auto)} className="text-gray-500 hover:text-indigo-600"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(auto.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Gatilho */}
                <div className="flex-1 bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center text-sm font-semibold text-gray-500 mb-2">
                    {auto.triggerType === 'time_in_status' ? <Clock size={16} className="mr-2"/> : <ChevronRight size={16} className="mr-2"/>}
                    QUANDO
                  </div>
                  <div className="text-sm text-gray-800">
                    {auto.triggerType === 'status_change' 
                      ? <>O lead entrar em <strong className="font-semibold">"{auto.triggerValue.columnName}"</strong></> 
                      : <>O lead permanecer por mais de <strong className="font-semibold">{auto.triggerValue.days} dias</strong> em <strong className="font-semibold">"{auto.triggerValue.columnName}"</strong></>
                    }
                  </div>
                </div>
                
                {/* Seta */}
                <div className="text-gray-300">
                  <ChevronRight size={24} />
                </div>

                {/* Ação */}
                <div className="flex-1 bg-indigo-50 p-3 rounded-md">
                  <div className="flex items-center text-sm font-semibold text-indigo-700 mb-2">
                    <MessageSquare size={16} className="mr-2"/>
                    ENTÃO
                  </div>
                  <div className="text-sm text-gray-800">
                    Enviar a mensagem: <em className="italic">"{auto.actionValue.message}"</em>
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <p className="text-gray-500">Nenhuma regra de automação criada ainda.</p>
              <p className="text-sm text-gray-400 mt-1">Clique em "Criar Nova Regra" para começar.</p>
            </div>
          )}
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{editingAutomation ? 'Editar Regra' : 'Criar Nova Regra'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              {wizardStep === 1 && (
                <div>
                  <p className="text-lg font-semibold text-center mb-1 text-gray-700">Passo 1 de 3</p>
                  <h3 className="text-2xl font-bold text-center mb-6 text-gray-900">Quando esta automação deve ser disparada?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div onClick={() => handleTriggerSelect('status_change')} className="border-2 border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all"> <ChevronRight size={32} className="mx-auto mb-3 text-indigo-500"/> <h4 className="font-bold text-lg text-gray-800">Quando um Lead Mudar de Status</h4> <p className="text-sm text-gray-500 mt-1">Dispara uma ação no momento em que um card é movido para uma coluna específica.</p> </div>
                    <div onClick={() => handleTriggerSelect('time_in_status')} className="border-2 border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all"> <Clock size={32} className="mx-auto mb-3 text-indigo-500"/> <h4 className="font-bold text-lg text-gray-800">Quando um Lead Ficar Inativo</h4> <p className="text-sm text-gray-500 mt-1">Dispara uma ação se um card permanecer parado em uma coluna por um tempo.</p> </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div>
                  <p className="text-lg font-semibold text-center mb-1 text-gray-700">Passo 2 de 3</p>
                  <h3 className="text-2xl font-bold text-center mb-6 text-gray-900">Configure a condição</h3>
                  <div className="bg-gray-100 p-6 rounded-lg space-y-4">
                    <label className="block text-base font-semibold text-gray-800">Configuração do Gatilho</label>
                    {formData.triggerType === 'time_in_status' && ( <div className="flex items-center gap-4 flex-wrap"> <span>O lead permanecer por mais de</span> <input type="number" name="days" value={formData.triggerValue.days} onChange={handleTriggerValueChange} className="w-24 p-2 border rounded-lg" min="1"/> <span>dias na coluna:</span> </div> )}
                    {formData.triggerType === 'status_change' && ( <div> <span>O lead entrar na coluna:</span> </div> )}
                    <select name="columnName" value={formData.triggerValue.columnName} onChange={handleTriggerValueChange} className="w-full p-2 border rounded-lg bg-white mt-2">
                      {kanbanColumns.map(col => <option key={col.id} value={col.name}>{col.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between mt-8">
                    <button type="button" onClick={goToPreviousStep} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Voltar</button>
                    <button type="button" onClick={goToNextStep} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">Avançar</button>
                  </div>
                </div>
              )}
              
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome da Regra</label>
                    <input type="text" name="name" value={formData.name} onChange={handleFormChange} className="w-full p-2 border rounded mt-1" placeholder="Ex: Follow-up de boas-vindas" required/>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <label className="block text-base font-semibold text-gray-800 mb-2">ENTÃO (Ação)</label>
                    <select name="actionType" value={formData.actionType} onChange={handleFormChange} className="w-full p-2 border rounded bg-white mb-2">
                      <option value="send_whatsapp">Enviar mensagem no WhatsApp</option>
                    </select>
                    <textarea name="message" value={formData.actionValue.message} onChange={handleActionValueChange} className="w-full p-2 border rounded" rows="4" placeholder="Digite a mensagem. Use [Nome do Lead] para personalizar." required></textarea>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleFormChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Ativar esta regra</label>
                  </div>
                  <div className="flex justify-between items-center mt-6">
                    <button type="button" onClick={goToPreviousStep} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Voltar</button>
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 w-32 flex justify-center" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin" /> : 'Salvar Regra'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AnalysisPage = () => {
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- FUNÇÃO ALTERADA ---
  const handleAnalyze = async () => {
    if (!textToAnalyze.trim()) {
      setError("Por favor, insira um texto para análise.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
  
    try {
      // A URL agora aponta para o seu próprio backend, que é mais seguro
      const backendUrl = `${process.env.REACT_APP_BACKEND_URL}/api/analise/gemini`;
      
      console.log("Enviando texto para o backend em:", backendUrl);

      // A requisição é feita para o seu servidor usando axios
      const response = await axios.post(backendUrl, {
        textToAnalyze: textToAnalyze // Enviando o texto no corpo da requisição
      });

      // O backend já retorna o JSON limpo e formatado, pronto para ser usado
      setAnalysisResult(response.data);

    } catch (e) {
      // Tratamento de erro caso não consiga se comunicar com o seu backend
      setError("Ops! Ocorreu um erro ao conectar com o servidor. Tente novamente.");
      console.error("Erro na chamada ao backend:", e);
    } finally {
      setIsLoading(false);
    }
  };
  // --- FIM DA ALTERAÇÃO ---

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

const ReportsPage = ({ leads, kanbanColumns, tags, segments }) => {
  const [filters, setFilters] = useState({
    status: '',
    tag: '',
    businessSegment: '',
    de: '',
    ate: '',
  });

  const [hasFiltered, setHasFiltered] = useState(false); 
  const [allFilteredLeads, setAllFilteredLeads] = useState([]);
  const [displayLeads, setDisplayLeads] = useState([]);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const parseDateAsLocal = (dateString) => {
    if (!dateString.includes('T')) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  };

  const handleFilterChange = (e) => {
    setError(null); // Limpa o erro ao alterar qualquer filtro
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
  };

  const applyFilters = () => {
  setError(null);
  if (filters.ate && filters.de && new Date(filters.ate) < new Date(filters.de)) {
    setError('A data final não pode ser anterior à data inicial.');
    return;
  }

  setIsFiltering(true); // Ativa o loading da tela
  setHasFiltered(false); // Esconde os resultados antigos

  // Usamos um timeout para garantir que a UI atualize antes do processamento
  setTimeout(() => {
    try {
      const filtered = leads.filter(lead => {
        // ... sua lógica de filtro continua a mesma ...
        const statusMatch = filters.status ? lead.status === filters.status : true;
        const tagMatch = filters.tag ? lead.tags?.includes(filters.tag) : true;
        const segmentMatch = filters.businessSegment ? lead.businessSegment === filters.businessSegment : true;
        let dateMatch = true;
        if (lead.dateCreated) {
          const leadDate = parseDateAsLocal(lead.dateCreated);
          if (filters.de) {
            const startDate = parseDateAsLocal(filters.de);
            dateMatch = dateMatch && (leadDate >= startDate);
          }
          if (filters.ate) {
            const endDate = parseDateAsLocal(filters.ate);
            endDate.setDate(endDate.getDate() + 1);
            dateMatch = dateMatch && (leadDate < endDate);
          }
        } else if (filters.de || filters.ate) {
          dateMatch = false;
        }
        return statusMatch && tagMatch && segmentMatch && dateMatch;
      });
      setAllFilteredLeads(filtered);
      setDisplayLeads(filtered.slice(0, 100));
      setHasFiltered(true); // Mostra os novos resultados
    } catch (err) {
        console.error("Erro ao aplicar filtros:", err);
        toast.error("Ocorreu um erro ao filtrar os dados.");
    } finally {
        setIsFiltering(false); // Desativa o loading
    }
  }, 350);
};

  // FUNÇÃO 'clearFilters' COMPLETA E NO LUGAR CORRETO
  const clearFilters = () => {
    setError(null);
    setFilters({ status: '', tag: '', businessSegment: '', de: '', ate: '' });
    setAllFilteredLeads([]);
    setDisplayLeads([]);
    setHasFiltered(false);
  };
  
  const handleExportCSV = () => {
  if (allFilteredLeads.length === 0) return;

  setIsExporting(true); // Ativa o loading

  // Usamos um pequeno timeout para garantir que o estado atualize e o loader apareça na tela
  // antes de iniciar o processamento do CSV, que pode ser pesado.
  setTimeout(() => {
    try {
      const headers = ["ID", "Título", "Nome", "Email", "Telefone", "Empresa", "Segmento", "Status", "Data de Criação", "Tags", "Pontos de Dor", "Solução", "Próximos Passos"];
      const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + allFilteredLeads.map(lead => {
          const tagNames = lead.tags?.map(tagId => tags.find(t => t.id === tagId)?.name).join('; ') || 'null';
          return [
            `"${lead.id}"`, `"${lead.interestSummary || 'null'}"`, `"${lead.name || 'null'}"`, 
            `"${lead.email || 'null'}"`, `"${lead.phone || 'null'}"`, `"${lead.company || 'null'}"`, 
            `"${lead.businessSegment || 'null'}"`, `"${lead.status || 'null'}"`, 
            `"${lead.dateCreated || 'null'}"`, `"${tagNames}"`, 
            `"${lead.details?.painPoints?.replace(/"/g, '""') || 'null'}"`,
            `"${lead.details?.solutionNotes?.replace(/"/g, '""') || 'null'}"`,
            `"${lead.details?.nextSteps?.replace(/"/g, '""') || 'null'}"`,
          ].join(",");
        }).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_leads_${new Date().toLocaleDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
      toast.error("Ocorreu um erro ao gerar o arquivo.");
    } finally {
      setIsExporting(false); // Desativa o loading no final
    }
  }, 350);
};
  
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-3xl font-bold text-gray-900 mb-2 flex-shrink-0">Gerar Relatórios</h2>
      <p className="text-gray-600 mb-6 flex-shrink-0">Filtre e exporte dados detalhados dos seus leads para análises personalizadas.</p>
      <div className="bg-white p-6 rounded-xl shadow-lg mb-6 flex-shrink-0">
        <h3 className="text-xl font-semibold mb-4">Filtros de Relatório</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full p-3 border rounded-lg bg-white">
              <option value="">Todos</option>
              {kanbanColumns.map(column => <option key={column.id} value={column.name}>{column.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
            <select name="businessSegment" value={filters.businessSegment} onChange={handleFilterChange} className="w-full p-3 border rounded-lg bg-white">
              <option value="">Todos</option>
              {segments.map(seg => <option key={seg.id} value={seg.name}>{seg.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <select name="tag" value={filters.tag} onChange={handleFilterChange} className="w-full p-3 border rounded-lg bg-white">
              <option value="">Todas</option>
              {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
            <input type="date" name="de" value={filters.de} onChange={handleFilterChange} className="w-full p-3 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Até</label>
            <input type="date" name="ate" value={filters.ate} onChange={handleFilterChange} className="w-full p-3 border rounded-lg" />
          </div>
        </div>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
            <strong className="font-bold">Erro: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <div className="flex justify-end mt-4 space-x-2">
          <button onClick={clearFilters} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400">Limpar Filtros</button>
          <button onClick={applyFilters} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Aplicar Filtros</button>
        </div>
      </div>
      
      {isFiltering ? (
        // Estado de Carregamento
        <div className="bg-white p-6 rounded-xl shadow-lg flex-1 flex flex-col min-h-0 items-center justify-center text-gray-500">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
          <p className="font-semibold text-lg">Filtrando dados...</p>
        </div>
      ) : hasFiltered && (
        // Estado com Resultados
        <div className="bg-white p-6 rounded-xl shadow-lg flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Resultados ({allFilteredLeads.length} leads encontrados)</h3>
              {allFilteredLeads.length > 100 && <p className="text-sm text-gray-500">Exibindo os primeiros 100 resultados. Exporte para ver a lista completa.</p>}
            </div>
            <button 
              onClick={handleExportCSV} 
              disabled={allFilteredLeads.length === 0 || isExporting} 
              className="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 flex items-center justify-center w-40 disabled:bg-gray-400"
            >
              {isExporting ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" />Gerando...</>
              ) : (
                <><Download className="h-5 w-5 mr-2" />Exportar CSV</>
              )}
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segmento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name || 'null'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.interestSummary || 'null'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.status || 'null'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.company || 'null'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.businessSegment || 'null'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          if (!tag) return null;
                          return <span key={tag.id} className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{backgroundColor: tag.color}}>{tag.name}</span>
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.dateCreated ? new Date(lead.dateCreated).toLocaleDateString() : 'null'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const TagManagerModal = ({ isOpen, onClose, tags, companyId }) => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#cccccc');
  
  // Novos estados para controlar a edição e o loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTag, setEditingTag] = useState(null); // Guarda a tag que está sendo editada

  if (!isOpen) return null;

  // Função para quando o usuário clica no ícone de editar
  const handleEditClick = (tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
  };

  // Função para cancelar a edição
  const cancelEdit = () => {
    setEditingTag(null);
    setNewTagName('');
    setNewTagColor('#cccccc');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (editingTag) {
      // Lógica de ATUALIZAÇÃO
      if (!newTagName.trim()) return;
      setIsSubmitting(true);
      try {
        const tagRef = doc(db, "companies", companyId, "tags", editingTag.id);
        await updateDoc(tagRef, { name: newTagName, color: newTagColor });
        toast.success("Tag atualizada com sucesso!");
        cancelEdit();
      } catch (error) {
        console.error("Erro ao atualizar tag:", error);
        toast.error("Falha ao atualizar a tag.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Lógica de CRIAÇÃO
      if (!newTagName.trim()) return;
      setIsSubmitting(true);
      try {
        const tagsRef = collection(db, "companies", companyId, "tags");
        await addDoc(tagsRef, { name: newTagName, color: newTagColor });
        toast.success("Tag adicionada com sucesso!");
        setNewTagName('');
        setNewTagColor('#cccccc');
      } catch (error) {
        console.error("Erro ao adicionar tag:", error);
        toast.error("Falha ao adicionar a tag.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!companyId || !window.confirm("Tem certeza que deseja excluir esta tag?")) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "companies", companyId, "tags", tagId));
      toast.success("Tag excluída com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir tag:", error);
      toast.error("Falha ao excluir a tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Gerenciar Tags</h3>
        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto p-1">
          {tags.length > 0 ? tags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between bg-gray-100 p-2 rounded-lg">
              <div className="flex items-center">
                <span className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: tag.color }}></span>
                <span className="font-medium">{tag.name}</span>
              </div>
              <div>
                <button onClick={() => handleEditClick(tag)} className="text-gray-500 hover:text-indigo-700 p-1 rounded-full"><Edit size={16} /></button>
                <button onClick={() => handleDeleteTag(tag.id)} className="text-gray-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={16} /></button>
              </div>
            </div>
          )) : <p className="text-gray-500 text-center">Nenhuma tag criada.</p>}
        </div>

        <form onSubmit={handleFormSubmit}>
          <h4 className="font-semibold mb-2">{editingTag ? 'Editando Tag' : 'Adicionar Nova Tag'}</h4>
          <div className="flex items-center space-x-2">
            <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="p-1 h-10 w-12 block bg-white border border-gray-300 cursor-pointer rounded-lg" />
            <input type="text" placeholder="Nome da tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} className="flex-1 p-2 border rounded-lg" required />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 w-28 flex justify-center" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (editingTag ? 'Salvar' : 'Adicionar')}
            </button>
          </div>
          {editingTag && <button type="button" onClick={cancelEdit} className="text-sm text-gray-600 hover:text-indigo-600 mt-2">Cancelar Edição</button>}
        </form>

        <div className="flex justify-end mt-6">
          <button type="button" onClick={onClose} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Fechar</button>
        </div>
      </div>
    </div>
  );
};

const SegmentManagerModal = ({ isOpen, onClose, companyId }) => {
  const [segments, setSegments] = useState([]);
  const [newSegmentName, setNewSegmentName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);

  useEffect(() => {
    if (!isOpen || !companyId) return;
    const segmentsRef = collection(db, "companies", companyId, "segments");
    const q = query(segmentsRef, orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSegments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSegments(fetchedSegments);
    });
    return () => unsubscribe();
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const handleEditClick = (segment) => {
    setEditingSegment(segment);
    setNewSegmentName(segment.name);
  };

  const cancelEdit = () => {
    setEditingSegment(null);
    setNewSegmentName('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!newSegmentName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingSegment) {
        // Lógica de ATUALIZAÇÃO
        const segmentRef = doc(db, "companies", companyId, "segments", editingSegment.id);
        await updateDoc(segmentRef, { name: newSegmentName });
        toast.success("Segmento atualizado com sucesso!");
        cancelEdit();
      } else {
        // Lógica de CRIAÇÃO
        await addDoc(collection(db, "companies", companyId, "segments"), { name: newSegmentName });
        toast.success("Segmento adicionado com sucesso!");
        setNewSegmentName('');
      }
    } catch (error) {
      console.error("Erro ao salvar segmento:", error);
      toast.error("Falha ao salvar o segmento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSegment = async (segmentId) => {
    if (!companyId || !window.confirm("Tem certeza que deseja excluir este segmento?")) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "companies", companyId, "segments", segmentId));
      toast.success("Segmento excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir segmento:", error);
      toast.error("Falha ao excluir o segmento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Gerenciar Segmentos</h3>
        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto p-1">
          {segments.map(seg => (
            <div key={seg.id} className="flex items-center justify-between bg-gray-100 p-2 rounded-lg">
              <span className="font-medium">{seg.name}</span>
              <div>
                <button onClick={() => handleEditClick(seg)} className="text-gray-500 hover:text-indigo-700 p-1 rounded-full"><Edit size={16} /></button>
                <button onClick={() => handleDeleteSegment(seg.id)} className="text-gray-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
          <input type="text" placeholder={editingSegment ? 'Novo nome do segmento' : 'Nome do segmento'} value={newSegmentName} onChange={(e) => setNewSegmentName(e.target.value)} className="flex-1 p-2 border rounded-lg" required />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 w-28 flex justify-center" disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (editingSegment ? 'Salvar' : 'Adicionar')}
          </button>
        </form>
        {editingSegment && <button type="button" onClick={cancelEdit} className="text-sm text-gray-600 hover:text-indigo-600 mt-2">Cancelar Edição</button>}
        <div className="flex justify-end mt-6">
          <button type="button" onClick={onClose} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Fechar</button>
        </div>
      </div>
    </div>
  );
};

// App.js -> Substitua o componente KanbanBoard inteiro por este

const KanbanBoard = ({ 
  kanbanColumns, 
  tags,
  leads, 
  segments, 
  onArchiveLead, 
  onRestoreLead,
  onSave, 
  onAddLead, 
  companyId, 
  isEditModalOpen, 
  setIsEditModalOpen, 
  selectedLead, 
  setSelectedLead,
  companyUsers // <-- RECEBENDO A NOVA PROP
}) => {
  const [viewMode, setViewMode] = useState('active');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  // Adiciona o responsibleUserId ao estado inicial do novo lead
  const [newLead, setNewLead] = useState({ name: '', interestSummary: '', email: '', phone: '', businessSegment: '', tags: [], details: { painPoints: '', solutionNotes: '', nextSteps: '' }, responsibleUserId: '' });
  const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = useState(false);
  const [editingColumns, setEditingColumns] = useState([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // O resto das funções (handleDragStart, handleDrop, etc.) permanece o mesmo
  // ... (funções inalteradas) ...
  const displayedLeads = useMemo(() => {
    if (viewMode === 'active') {
      return leads.filter(lead => lead.status !== 'Arquivado');
    }
    return leads.filter(lead => lead.status === 'Arquivado');
  }, [leads, viewMode]);

  const getLeadsByStatus = (statusName) => {
    return displayedLeads.filter(lead => lead.status === statusName);
  };
  
  const handleColumnTypeChange = (index, newType) => { const updatedColumns = [...editingColumns]; updatedColumns[index].type = newType; setEditingColumns(updatedColumns); };
  const openManageColumnsModal = () => { setEditingColumns(JSON.parse(JSON.stringify(kanbanColumns))); setIsManageColumnsModalOpen(true); };
  const handleColumnNameChange = (index, newName) => { const updatedColumns = [...editingColumns]; updatedColumns[index].name = newName; setEditingColumns(updatedColumns); };
  const handleAddNewColumn = () => { const newColumn = { id: `col-${Date.now()}`, name: 'Nova Coluna', order: editingColumns.length + 1, type: 'transit' }; setEditingColumns([...editingColumns, newColumn]); };
  const handleDeleteColumn = (index) => { if (window.confirm("Tem certeza que deseja excluir esta coluna?")) { const updatedColumns = [...editingColumns]; updatedColumns.splice(index, 1); updatedColumns.forEach((col, idx) => col.order = idx + 1); setEditingColumns(updatedColumns); } };

  const handleSaveChanges = async () => {
  if (!companyId) return;
  
  setIsSubmitting(true);
  try {
    const columnsDocRef = doc(db, "companies", companyId, "kanban_settings", "columns");
    await updateDoc(columnsDocRef, { list: editingColumns });
    toast.success('Colunas salvas com sucesso!');
    setIsManageColumnsModalOpen(false);
  } catch (error) {
    console.error("Erro ao salvar colunas:", error);
    toast.error('Falha ao salvar as colunas.');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDragStart = (e, leadId, status) => { e.dataTransfer.setData('leadId', leadId); e.dataTransfer.setData('sourceStatus', status); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, targetStatus) => { e.preventDefault(); const leadId = e.dataTransfer.getData('leadId'); const sourceStatus = e.dataTransfer.getData('sourceStatus'); const leadToUpdate = displayedLeads.find(lead => lead.id === leadId); if (leadToUpdate) { onSave({ ...leadToUpdate, status: targetStatus }, sourceStatus); } };
  const openNewLeadModal = () => {
    // Adicionado responsibleUserId ao reset do formulário
    setNewLead({ name: '', interestSummary: '', email: '', phone: '', cpf: '', businessSegment: '', status: kanbanColumns.length > 0 ? kanbanColumns[0].name : '', tags: [], details: { painPoints: '', solutionNotes: '', nextSteps: '' }, responsibleUserId: auth.currentUser?.uid || '' });
    setIsNewLeadModalOpen(true);
  };
  const handleNewLeadChange = (e) => { const { name, value } = e.target; setNewLead(prev => ({ ...prev, [name]: value })); };
  const handleNewLeadDetailsChange = (e) => { const { name, value } = e.target; setNewLead(prev => ({ ...prev, details: { ...prev.details, [name]: value } })); };

  const handleAddLeadSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    await onAddLead(newLead);
    toast.success('Lead adicionado com sucesso!');
    setIsNewLeadModalOpen(false);
  } catch (error) {
    console.error("Erro ao adicionar lead:", error);
    toast.error('Falha ao adicionar o lead. Tente novamente.');
  } finally {
    setIsSubmitting(false);
  }
};

  const openEditModal = (lead) => { setSelectedLead(lead); setIsEditModalOpen(true); };
  const handleEditChange = (e) => { const { name, value } = e.target; setSelectedLead(prev => ({ ...prev, [name]: value })); };
  const handleEditDetailsChange = (e) => { const { name, value } = e.target; setSelectedLead(prev => ({ ...prev, details: { ...prev.details, [name]: value } })); };

  const handleEditSubmit = async (e) => {
  e.preventDefault();
  if (!selectedLead) return;
  
  setIsSubmitting(true);
  try {
    await onSave(selectedLead, selectedLead.status);
    toast.success('Lead atualizado com sucesso!');
    setIsEditModalOpen(false);
    setSelectedLead(null);
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    toast.error('Falha ao atualizar o lead.');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleArchiveFromEditModal = () => { if (selectedLead && window.confirm('Tem certeza que deseja arquivar este lead?')) { onArchiveLead(selectedLead.id); setIsEditModalOpen(false); setSelectedLead(null); } };
  const handleTagClick = (tagId) => { const isEditing = !!selectedLead; const currentLead = isEditing ? selectedLead : newLead; const updateFunction = isEditing ? setSelectedLead : setNewLead; const currentTags = currentLead.tags || []; let updatedTags; if (currentTags.includes(tagId)) { updatedTags = currentTags.filter(id => id !== tagId); } else { updatedTags = [...currentTags, tagId]; } updateFunction(prev => ({ ...prev, tags: updatedTags })); };
  const TagSelector = ({ lead }) => ( <div className="mt-4"> <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label> <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-gray-50"> {tags.length > 0 ? tags.map(tag => { const isSelected = lead?.tags?.includes(tag.id); return ( <button key={tag.id} type="button" onClick={() => handleTagClick(tag.id)} className={`px-3 py-1 text-sm rounded-full transition-all duration-150 border ${ isSelected ? 'text-white shadow-md' : 'text-gray-700 bg-white hover:bg-gray-200' }`} style={{ backgroundColor: isSelected ? tag.color : '#FFFFFF', borderColor: isSelected ? tag.color : '#D1D5DB' }} > {tag.name} </button> ) }) : <p className="text-xs text-gray-500">Nenhuma tag criada.</p>} </div> </div> );

  const handleRestoreClick = (leadId) => {
    if (window.confirm('Tem certeza que deseja restaurar este lead? Ele voltará para o início do seu funil.')) {
      onRestoreLead(leadId);
    }
  };

  // O JSX principal do KanbanBoard permanece o mesmo...
  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      {/* ... (cabeçalho do kanban inalterado) ... */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h2 className="text-3xl font-bold text-gray-900">
          {viewMode === 'active' ? 'Qualificação de Leads' : 'Leads Arquivados'}
        </h2>
        <div className="flex items-center gap-2">
           {viewMode === 'active' ? (
             <button onClick={() => setViewMode('archived')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full hover:bg-gray-300 transition-colors flex items-center"><Archive className="h-5 w-5 mr-2" />Ver Arquivados</button>
           ) : (
             <button onClick={() => setViewMode('active')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full hover:bg-gray-300 transition-colors flex items-center"><MessageCircle className="h-5 w-5 mr-2" />Ver Leads Ativos</button>
           )}
           <div className="relative">
             <button onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)} onBlur={() => setTimeout(() => setIsSettingsMenuOpen(false), 150)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full hover:bg-gray-300 transition-colors flex items-center">
               <Settings className="h-5 w-5 mr-2" />
               Configurações
             </button>
             {isSettingsMenuOpen && (
               <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border">
                 <button onClick={() => {setIsSegmentModalOpen(true); setIsSettingsMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><Settings size={16} className="mr-2"/>Gerenciar Segmentos</button>
                 <button onClick={() => {setIsTagModalOpen(true); setIsSettingsMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><Tag size={16} className="mr-2"/>Gerenciar Tags</button>
                 <button onClick={() => {openManageColumnsModal(); setIsSettingsMenuOpen(false);}} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><List size={16} className="mr-2"/>Gerenciar Colunas</button>
               </div>
             )}
           </div>
           <button onClick={openNewLeadModal} className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors flex items-center"><Plus className="h-5 w-5 mr-2" />Novo Lead</button>
        </div>
      </div>
      {/* ... (resto do JSX do kanban inalterado) ... */}
      <div className="flex-1 min-h-0">
        <div className="h-full w-full overflow-x-auto">
          <div className="flex space-x-4 pb-4 h-full min-w-max">
            {viewMode === 'active' ? (
              kanbanColumns.map(column => (
                <div key={column.id} onDrop={(e) => handleDrop(e, column.name)} onDragOver={handleDragOver} className="flex-shrink-0 w-80 bg-gray-200 p-4 rounded-xl shadow-inner flex flex-col">
                  <h3 className="text-sm font-semibold p-2 rounded-lg text-center mb-4 flex-shrink-0">{column.name} ({getLeadsByStatus(column.name).length})</h3>
                  <div className="space-y-4 overflow-y-auto flex-grow pr-1 max-h-[calc(100vh-280px)]">
                    {getLeadsByStatus(column.name).map(lead => (
                      <div key={lead.id} onClick={() => openEditModal(lead)} draggable onDragStart={(e) => handleDragStart(e, lead.id, column.name)} className="bg-white p-4 rounded-lg shadow-md cursor-pointer active:cursor-grabbing hover:scale-[1.02]">
                        <h4 className="font-semibold text-indigo-700 text-sm truncate mb-2">{lead.interestSummary || 'Lead sem título'}</h4>
                        <p className="font-bold text-gray-800 truncate mb-2">{lead.name}</p>
                        {lead.tags && lead.tags.length > 0 && ( <div className="flex flex-wrap gap-1 mt-2 mb-2"> {lead.tags.map(tagId => { const tag = tags.find(t => t.id === tagId); if (!tag) return null; return ( <span key={tag.id} className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}> {tag.name} </span> ) })} </div>)}
                        <p className="text-xs text-gray-400 mt-3 border-t pt-2 truncate">ID: {lead.id}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-100 p-4 rounded-xl shadow-inner w-full flex-grow">
                 <h3 className="text-base font-semibold p-2 text-center mb-4">Total: {displayedLeads.length} leads arquivados</h3>
                 <div className="space-y-2 overflow-y-auto" style={{maxHeight: 'calc(100vh - 250px)'}}>
                   {displayedLeads.map(lead => (
                     <div key={lead.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center">
                       <div>
                         <p className="font-bold text-gray-700">{lead.name}</p>
                         <p className="text-xs text-gray-500">Arquivado em: {lead.timestamp ? lead.timestamp.toDate().toLocaleDateString() : 'N/A'}</p>
                       </div>
                       <button onClick={() => handleRestoreClick(lead.id)} className="bg-green-100 text-green-800 px-3 py-1 rounded-full hover:bg-green-200 text-sm font-semibold flex items-center">
                         <ArchiveRestore size={16} className="mr-2"/>
                         Restaurar
                       </button>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE NOVO LEAD ATUALIZADO */}
      {isNewLeadModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl relative">
            <button onClick={() => setIsNewLeadModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"> <X size={24} /> </button>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Adicionar Novo Lead</h3>
            <form onSubmit={handleAddLeadSubmit} className="overflow-y-auto" style={{maxHeight: '75vh'}}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título do Lead</label>
                    <input type="text" name="interestSummary" placeholder="Ex: Cliente interessado no Plano Pro" value={newLead.interestSummary} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg" />
                </div>
                {/* ... (outros campos: Nome, Email, Telefone, CPF) ... */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                    <input type="text" name="name" value={newLead.name} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" name="email" value={newLead.email} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input type="tel" name="phone" value={newLead.phone} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF (opcional)</label>
                    <input type="text" name="cpf" placeholder="000.000.000-00" value={newLead.cpf || ''} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
                  <select name="businessSegment" value={newLead.businessSegment} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg bg-white">
                      <option value="">Selecione um segmento</option>
                      {segments.map(seg => <option key={seg.id} value={seg.name}>{seg.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={newLead.status} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg bg-white">
                      {kanbanColumns.map(col => <option key={col.id} value={col.name}>{col.name}</option>)}
                  </select>
                </div>
                {/* --- NOVO CAMPO DE SELEÇÃO DO CORRETOR --- */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corretor Responsável</label>
                  <select name="responsibleUserId" value={newLead.responsibleUserId} onChange={handleNewLeadChange} className="w-full p-3 border rounded-lg bg-white" required>
                    <option value="">Selecione um corretor</option>
                    {companyUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
                  </select>
                </div>
              </div>
              {/* ... (resto do formulário inalterado) ... */}
              <div className="space-y-3"> <div><label className="block text-sm font-medium text-gray-700 mb-1">Pontos de dor</label><textarea name="painPoints" value={newLead.details.painPoints} onChange={handleNewLeadDetailsChange} rows="2" className="w-full p-3 border rounded-lg resize-y"></textarea></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas sobre a solução</label><textarea name="solutionNotes" value={newLead.details.solutionNotes} onChange={handleNewLeadDetailsChange} rows="2" className="w-full p-3 border rounded-lg resize-y"></textarea></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Próximos passos</label><textarea name="nextSteps" value={newLead.details.nextSteps} onChange={handleNewLeadDetailsChange} rows="2" className="w-full p-3 border rounded-lg resize-y"></textarea></div> </div> <TagSelector lead={newLead} /> <div className="flex justify-end space-x-4 mt-6"> <button type="button" onClick={() => setIsNewLeadModalOpen(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancelar</button>
      <button 
        type="submit" 
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-400"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          'Adicionar Lead'
        )}
      </button>
       </div> </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE LEAD ATUALIZADO */}
      {isEditModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl relative">
                <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Editar Lead</h3>
                <form onSubmit={handleEditSubmit} className="overflow-y-auto" style={{ maxHeight: '75vh' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* ... (outros campos de edição: Título, Nome, etc.) ... */}
                        <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Título do Lead</label>
                              <input type="text" name="interestSummary" placeholder="Ex: Cliente interessado no Plano Pro" value={selectedLead.interestSummary || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                              <input type="text" name="name" value={selectedLead.name} onChange={handleEditChange} className="w-full p-3 border rounded-lg" required />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <input type="email" name="email" value={selectedLead.email || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                              <input type="tel" name="phone" value={selectedLead.phone || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">CPF (opcional)</label>
                              <input type="text" name="cpf" placeholder="000.000.000-00" value={selectedLead.cpf || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg"/>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
                              <select name="businessSegment" value={selectedLead.businessSegment || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg bg-white">
                                  <option value="">Selecione um segmento</option>
                                  {segments.map(seg => <option key={seg.id} value={seg.name}>{seg.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                              <select name="status" value={selectedLead.status} onChange={handleEditChange} className="w-full p-3 border rounded-lg bg-white">
                                  {kanbanColumns.map(col => <option key={col.id} value={col.name}>{col.name}</option>)}
                              </select>
                          </div>
                        {/* --- NOVO CAMPO DE SELEÇÃO DO CORRETOR --- */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Corretor Responsável</label>
                          <select name="responsibleUserId" value={selectedLead.responsibleUserId || ''} onChange={handleEditChange} className="w-full p-3 border rounded-lg bg-white" required>
                            <option value="">Selecione um corretor</option>
                            {companyUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
                          </select>
                        </div>
                    </div>
                    {/* ... (resto do formulário de edição inalterado) ... */}
                    <div className="space-y-4">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Pontos de dor</label><textarea name="painPoints" value={selectedLead.details?.painPoints || ''} onChange={handleEditDetailsChange} rows="3" className="w-full p-3 border rounded-lg resize-y" ></textarea></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas sobre a solução</label><textarea name="solutionNotes" value={selectedLead.details?.solutionNotes || ''} onChange={handleEditDetailsChange} rows="3" className="w-full p-3 border rounded-lg resize-y" ></textarea></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Próximos passos</label><textarea name="nextSteps" value={selectedLead.details?.nextSteps || ''} onChange={handleEditDetailsChange} rows="3" className="w-full p-3 border rounded-lg resize-y" ></textarea></div>
                      </div>
                      <TagSelector lead={selectedLead} />
                      <div className="flex justify-between items-center mt-6">
                          <button type="button" onClick={handleArchiveFromEditModal} className="text-gray-600 hover:text-gray-800 font-semibold flex items-center"><Archive size={16} className="mr-2" /> Arquivar Lead</button>
                          <div className="flex space-x-4">
                              <button type="button" onClick={() => setIsEditModalOpen(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancelar</button>
                              <button
                                  type="submit"
                                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center w-44"
                                  disabled={isSubmitting}
                              >
                                  {isSubmitting ? (
                                      <><Loader2 className="h-5 w-5 animate-spin mr-2" />Salvando...</>
                                  ) : (
                                      'Salvar Alterações'
                                  )}
                              </button>
                          </div>
                      </div>
                </form>
            </div>
        </div>
      )}
      
      {/* ... (outros modais inalterados: TagManager, SegmentManager, ManageColumns) ... */}
      <TagManagerModal 
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        tags={tags}
        companyId={companyId}
      />
      <SegmentManagerModal 
        isOpen={isSegmentModalOpen} 
        onClose={() => setIsSegmentModalOpen(false)} 
        companyId={companyId} 
      />
       {isManageColumnsModalOpen && ( <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg"> <h3 className="text-2xl font-bold text-gray-900 mb-6">Gerenciar Colunas do Kanban</h3> <div className="space-y-3 mb-6 max-h-60 overflow-y-auto p-1"> {editingColumns.map((col, index) => ( <div key={col.id || index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded"> <input type="text" value={col.name} onChange={(e) => handleColumnNameChange(index, e.target.value)} className="flex-1 p-2 border rounded-lg" /> <select value={col.type || 'transit'} onChange={(e) => handleColumnTypeChange(index, e.target.value)} className="p-2 border rounded-lg bg-white"> {COLUMN_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)} </select> <button onClick={() => handleDeleteColumn(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full"><Trash2 size={18} /></button> </div> ))} </div> <button onClick={handleAddNewColumn} className="w-full border-2 border-dashed border-gray-300 text-gray-500 p-3 rounded-lg hover:bg-gray-100 mb-6">Adicionar Nova Coluna</button> <div className="flex justify-end space-x-4"> <button type="button" onClick={() => setIsManageColumnsModalOpen(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancelar</button> 
      <button 
        type="button" 
        onClick={handleSaveChanges} 
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center w-44" // Largura fixa
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          'Salvar Alterações'
        )}
      </button>
       </div> </div> </div> )}
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