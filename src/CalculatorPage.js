import { useState } from 'react';
import { auth } from './firebaseConfig'; // Importa a autenticação do Firebase
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CalculatorPage = ({ companyId, leads }) => {
  // Estados para os campos de entrada
  const [valorImovel, setValorImovel] = useState(350000);
  const [valorFinanciamento, setValorFinanciamento] = useState(280000);
  const [prazo, setPrazo] = useState(420);
  const [rendaBruta, setRendaBruta] = useState(7800);
  const [sistemaAmortizacao, setSistemaAmortizacao] = useState('PRICE');
  const [indexador, setIndexador] = useState('TR');

  // Estado para os resultados
  const [resultado, setResultado] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Função final que se comunica com o backend
  const handleCalculate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResultado(null); // Limpa o resultado anterior

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }
      const token = await user.getIdToken();

      const payload = {
        valorFinanciamento: Number(valorFinanciamento),
        prazo: Number(prazo),
        rendaBruta: Number(rendaBruta),
        sistemaAmortizacao: sistemaAmortizacao,
        companyId: companyId // Essencial para o middleware de autorização
      };

      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };
      
      const response = await axios.post(`${BACKEND_URL}/api/calculator/simulate`, payload, config);
      
      setResultado(response.data);

    } catch (error) {
      console.error("Erro ao calcular:", error);
      toast.error("Falha ao calcular a simulação. Verifique o console.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Calculadora de Vendas</h2>
        <p className="text-gray-600 mt-1">
          Simule uma avaliação de risco de financiamento com base nos dados do cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna de Entradas */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4 border-b pb-2">Dados da Simulação</h3>
          
          <form onSubmit={handleCalculate} className="space-y-4">
            {/* Busca de Lead - Funcionalidade futura */}
            <div className="opacity-50">
              <label className="block text-sm font-medium text-gray-700">Buscar Lead (em breve)</label>
              <div className="mt-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Comece a digitar o nome de um lead..." className="w-full bg-gray-100 rounded-lg py-2 pl-10 pr-3 text-sm" disabled />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Valor do Imóvel (R$)</label>
              <input type="number" value={valorImovel} onChange={e => setValorImovel(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Valor do Financiamento (R$)</label>
              <input type="number" value={valorFinanciamento} onChange={e => setValorFinanciamento(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Prazo (Meses)</label>
              <input type="number" value={prazo} onChange={e => setPrazo(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Renda Bruta Mensal (R$)</label>
              <input type="number" value={rendaBruta} onChange={e => setRendaBruta(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Sistema de Amortização</label>
                <select value={sistemaAmortizacao} onChange={e => setSistemaAmortizacao(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white">
                  <option value="PRICE">PRICE</option>
                  <option value="SAC">SAC (em breve)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Indexador</label>
                <select value={indexador} onChange={e => setIndexador(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white">
                  <option value="TR">TR</option>
                  <option value="IPCA">IPCA</option>
                </select>
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex justify-center items-center" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Calculando...
                </>
              ) : (
                'Calcular Simulação'
              )}
            </button>
          </form>
        </div>

        {/* Coluna de Resultados */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4 border-b pb-2">Resultado da Avaliação</h3>
          {isLoading ? (
             <div className="flex justify-center items-center h-full text-gray-500">
                <Loader2 className="animate-spin h-8 w-8" />
             </div>
          ) : resultado ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="font-medium text-gray-600">Status da Avaliação:</span>
                <span className={`font-bold text-lg px-2 py-1 rounded ${resultado.status.includes('Aprovada') ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                  {resultado.status}
                </span>
              </div>
              <div className="flex justify-between items-center p-3">
                <span className="font-medium text-gray-600">Prestação Mensal Estimada:</span>
                <span className="font-bold text-lg text-gray-900">
                  {resultado.prestacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="font-medium text-gray-600">Comprometimento da Renda:</span>
                <span className="font-bold text-lg text-gray-900">{resultado.comprometimentoPercentual}%</span>
              </div>
              <div className="flex justify-between items-center p-3">
                <span className="font-medium text-gray-600">Validade da Simulação:</span>
                <span className="font-bold text-gray-900">{resultado.validade}</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-16">
              <p>Preencha os dados e clique em "Calcular" para ver a simulação.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalculatorPage;