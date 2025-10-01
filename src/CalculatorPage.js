// src/CalculatorPage.js (VERSÃO FINAL, CORRIGIDA E COMPLETA)

import { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Search, Loader2, Download, X, List } from 'lucide-react';
import Select from 'react-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoBase64 from './assets/logo.png';
import CurrencyInput from 'react-currency-input-field';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CalculatorPage = ({ companyId, leads }) => {
  const [selectedLead, setSelectedLead] = useState(null);
  const [valorImovel, setValorImovel] = useState('');
  const [valorFinanciamento, setValorFinanciamento] = useState('');
  const [prazo, setPrazo] = useState(420);
  const [rendaBruta, setRendaBruta] = useState('');
  const [sistemaAmortizacao, setSistemaAmortizacao] = useState('PRICE');
  const [indexador, setIndexador] = useState('TR');
  const [resultado, setResultado] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isParcelasModalOpen, setIsParcelasModalOpen] = useState(false);
  
  const leadOptions = leads.map(lead => ({
    value: lead.id,
    label: `${lead.name} (${lead.phone || 'sem número'})`,
    lead: lead
  }));

  useEffect(() => {
    if (selectedLead) {
      toast.success(`Lead "${selectedLead.label}" selecionado.`);
    }
  }, [selectedLead]);

  const handleCalculate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResultado(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado.");
      const token = await user.getIdToken();
      const payload = { 
          valorImovel: valorImovel ? parseFloat(valorImovel.toString().replace(/\./g, '').replace(',', '.')) : 0, 
          valorFinanciamento: valorFinanciamento ? parseFloat(valorFinanciamento.toString().replace(/\./g, '').replace(',', '.')) : 0,
          prazo: Number(prazo), 
          rendaBruta: rendaBruta ? parseFloat(rendaBruta.toString().replace(/\./g, '').replace(',', '.')) : 0,
          sistemaAmortizacao, 
          indexador, 
          proponente: selectedLead?.lead, 
          companyId 
      };
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(`${BACKEND_URL}/api/calculator/simulate`, payload, config);
      setResultado(response.data);
    } catch (error) {
      console.error("Erro ao calcular:", error);
      toast.error("Falha ao calcular a simulação.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExportPDF = () => {
    if (!resultado) {
      toast.error("Você precisa calcular uma simulação antes de exportar o PDF.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // --- DADOS DA EMPRESA (Personalize aqui) ---
    // A importação da logo foi comentada para garantir que o erro não seja mais esse.
    // Descomente apenas quando a exportação sem logo funcionar 100%.
    // import logoBase64 from './assets/logo.png'; 
    const companyName = "Sua Construtora Inc.";
    const companyContact = "contato@suaconstrutora.com | (99) 99999-9999";
    const corporateColor = "#2c3e50"; 

    // --- CABEÇALHO ---
    // doc.addImage(logoBase64, 'PNG', margin, 10, 40, 15); 
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(corporateColor);
    doc.text(companyName, pageWidth - margin, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#888888");
    doc.text(companyContact, pageWidth - margin, 24, { align: 'right' });
    doc.setDrawColor(corporateColor);
    doc.line(margin, 30, pageWidth - margin, 30); 

    // --- TÍTULO DO DOCUMENTO ---
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(corporateColor);
    doc.text("Simulação de Financiamento Imobiliário", pageWidth / 2, 45, { align: 'center' });

    // --- DADOS DO PROPONENTE E SIMULAÇÃO ---
    const proponente = [
        { title: "Proponente:", value: resultado.nomeProponente || 'Não informado' },
        { title: "CPF:", value: resultado.cpfProponente || 'Não informado' },
        { title: "Status da Avaliação:", value: resultado.statusAvaliacao || '-' },
    ];
    const simulacao = [
        { title: "Valor do Imóvel:", value: (resultado.valorImovel || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { title: "Valor Financiado:", value: (resultado.valorFinanciamento || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { title: "Primeira Parcela:", value: (resultado.prestacao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { title: "Prazo:", value: `${resultado.prazo || 0} meses` },
        { title: "Sistema de Amortização:", value: resultado.sistemaAmortizacao || '-' },
        { title: "Validade da Proposta:", value: resultado.validade || '-' },
    ];

    // ALTERAÇÃO IMPORTANTE AQUI: A função agora é chamada como autoTable(doc, ...)
    autoTable(doc, {
        startY: 55,
        body: [...proponente, ...simulacao],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1.5 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: corporateColor },
            1: { halign: 'right' }
        }
    });

    // --- TABELA DE PARCELAS ---
    const tableColumn = ["Mês", "Data Venc.", "Prestação", "Juros", "Amortização", "Saldo Devedor"];
    const tableRows = (resultado.parcelas || []).map(p => [
        p.mes,
        p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString('pt-BR') : '-',
        Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        Number(p.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        Number(p.amortizacao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        Number(p.saldoDevedor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    // ALTERAÇÃO IMPORTANTE AQUI TAMBÉM
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: (doc).previousAutoTable.finalY + 10, // Acessa a propriedade através do objeto 'doc'
        theme: 'grid',
        headStyles: { fillColor: corporateColor, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 },
        didDrawPage: (data) => {
            // --- RODAPÉ ---
            doc.setFontSize(8);
            doc.setTextColor("#888888");
            const pageStr = `Página ${doc.internal.getNumberOfPages()}`;
            doc.text(pageStr, data.settings.margin.left, pageHeight - 10);
            doc.text(`Simulação gerada em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - data.settings.margin.right, pageHeight - 10, { align: 'right' });
        }
    });

    doc.save(`Simulacao_${resultado.nomeProponente.replace(/\s+/g, "_")}.pdf`);
};

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Calculadora de Vendas</h2>
        <p className="text-gray-600 mt-1">Simule uma avaliação de risco de financiamento com base nos dados do cliente.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Dados da Simulação</h3>
            <form onSubmit={handleCalculate} className="space-y-4">
                <div>
                <label className="block text-sm font-medium text-gray-700">Buscar Lead</label>
                <Select
                    options={leadOptions}
                    onChange={setSelectedLead}
                    value={selectedLead}
                    placeholder="Comece a digitar o nome de um lead..."
                    isClearable
                    className="mt-1"
                    styles={{
                        control: (base) => ({ ...base, borderColor: '#D1D5DB', borderRadius: '0.5rem', padding: '0.1rem' }),
                        option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? '#4f46e5' : isFocused ? '#e0e7ff' : base.backgroundColor, color: isSelected ? 'white' : 'black' })
                    }}
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700">Valor do Imóvel</label>
                <CurrencyInput name="valorImovel" value={valorImovel} onValueChange={(value) => setValorImovel(value || '')} className="w-full mt-1 p-2 border rounded-lg" intlConfig={{ locale: 'pt-BR', currency: 'BRL' }} placeholder="R$ 0,00" required />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700">Valor do Financiamento</label>
                <CurrencyInput name="valorFinanciamento" value={valorFinanciamento} onValueChange={(value) => setValorFinanciamento(value || '')} className="w-full mt-1 p-2 border rounded-lg" intlConfig={{ locale: 'pt-BR', currency: 'BRL' }} placeholder="R$ 0,00" required />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700">Prazo (Meses)</label>
                <input type="number" value={prazo} onChange={e => setPrazo(e.target.value)} className="w-full mt-1 p-2 border rounded-lg" placeholder="Ex: 420" required />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700">Renda Bruta Mensal</label>
                <CurrencyInput name="rendaBruta" value={rendaBruta} onValueChange={(value) => setRendaBruta(value || '')} className="w-full mt-1 p-2 border rounded-lg" intlConfig={{ locale: 'pt-BR', currency: 'BRL' }} placeholder="R$ 0,00" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Sistema de Amortização</label><select value={sistemaAmortizacao} onChange={e => setSistemaAmortizacao(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white"><option value="PRICE">PRICE</option><option value="SAC">SAC</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Indexador</label><select value={indexador} onChange={e => setIndexador(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white"><option value="TR">TR</option><option value="IPCA">IPCA</option></select></div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 flex justify-center items-center" disabled={isLoading}>{isLoading ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Calculando...</> : 'Calcular Simulação'}</button>
            </form>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h3 className="text-xl font-semibold">Resultado da Avaliação</h3>
            {resultado && (<div className="flex gap-2"><button onClick={() => setIsParcelasModalOpen(true)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full hover:bg-gray-300 flex items-center text-sm"><List size={16} className="mr-2" />Ver Parcelas</button><button onClick={handleExportPDF} className="bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700 flex items-center text-sm"><Download size={16} className="mr-2" />Exportar PDF</button></div>)}
          </div>
          <div className="flex-grow">
            {isLoading ? ( <div className="flex justify-center items-center h-full text-gray-500"><Loader2 className="animate-spin h-8 w-8" /></div> ) 
              : resultado ? (
              <div className="space-y-3 text-sm">
                {Object.entries(resultado).filter(([key]) => key !== 'parcelas').map(([key, value]) => {
                  let displayValue = value;
                  if (typeof value === 'number' && ['valorImovel', 'valorFinanciamento', 'prestacao', 'rendaBruta'].includes(key)) { displayValue = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return (
                    <div key={key} className="flex justify-between items-center p-3 odd:bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-600">{label}:</span>
                      <span className="font-bold text-gray-900 text-right">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            ) : ( <div className="text-center text-gray-500 flex items-center justify-center h-full"><p>Preencha os dados e clique em "Calcular" para ver a simulação.</p></div> )}
          </div>
        </div>
      </div>
      {isParcelasModalOpen && resultado && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Detalhamento das Parcelas - {resultado.sistemaAmortizacao}</h3>
              <button onClick={() => setIsParcelasModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <div className="overflow-auto flex-grow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0"><tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                    {/* NOVO: Cabeçalho da coluna de data */}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Venc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prestação</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Juros</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amortização</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Saldo Devedor</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {resultado.parcelas.map(p => (
                        <tr key={p.mes}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{p.mes}</td>
                        {/* NOVO: Célula que exibe a data formatada */}
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">{Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{Number(p.juros).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{Number(p.amortizacao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{Number(p.saldoDevedor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setIsParcelasModalOpen(false)} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculatorPage;