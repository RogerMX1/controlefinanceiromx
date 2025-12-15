import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- FUNÇÃO AUXILIAR: Normaliza texto (Crucial para as Metas funcionarem) ---
const limparTexto = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

export default function Dashboard({ session }) {
  const user = session.user;
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE DADOS ---
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [fixas, setFixas] = useState([]);          // Despesas Fixas (Modelos)
  const [receitasFixas, setReceitasFixas] = useState([]); // Receitas Fixas (Modelos)

  // --- FILTROS DE DATA ---
  const hoje = new Date().toISOString().split('T')[0];
  const [dataConsulta, setDataConsulta] = useState(hoje);
  const dataRef = new Date(dataConsulta);
  const mesRef = dataRef.getMonth();
  const anoRef = dataRef.getFullYear();

  // --- UI ---
  const [abaAtiva, setAbaAtiva] = useState('lancamentos');

  // --- INPUTS DOS FORMULÁRIOS ---
  const [novoLancamento, setNovoLancamento] = useState({ 
    descricao: '', valor: '', tipo: 'despesa', categoria: '', taxa_retorno: '', origem: 'saldo' 
  });
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaReceitaFixa, setNovaReceitaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  
  // O Estado da Meta que você queria de volta
  const [novaMeta, setNovaMeta] = useState({ categoria: '', valor_limite: '' });

  useEffect(() => { 
    fetchData(); 
    fetchFixas(); 
    fetchReceitasFixas();
  }, []);

  // --- BUSCAS NO BANCO ---
  async function fetchData() {
    setLoading(true);
    const { data: tData } = await supabase
        .from('transacoes')
        .select('*')
        .order('data_transacao', { ascending: false })
        .limit(2000); 
    if (tData) setTransacoes(tData);
    
    const { data: mData } = await supabase.from('metas').select('*');
    if (mData) setMetas(mData);
    setLoading(false);
  }

  async function fetchFixas() {
    const { data } = await supabase.from('despesas_fixas').select('*');
    if (data) setFixas(data);
  }

  async function fetchReceitasFixas() {
    const { data } = await supabase.from('receitas_fixas').select('*');
    if (data) setReceitasFixas(data);
  }

  // --- LANÇAMENTOS (Diário) ---
  async function handleSalvar(e) {
    e.preventDefault();
    if (!novoLancamento.descricao || !novoLancamento.valor) return alert("Preencha tudo!");
    
    const valorFloat = parseFloat(novoLancamento.valor);

    // Lógica Aporte Externo
    if (novoLancamento.tipo === 'investimento' && novoLancamento.origem === 'novo') {
        await supabase.from('transacoes').insert({
          user_id: user.id, descricao: `Aporte: ${novoLancamento.descricao}`, valor: valorFloat, tipo: 'receita', categoria: 'Aporte Externo', data_transacao: new Date().toISOString()
        });
    }

    await supabase.from('transacoes').insert({
      user_id: user.id,
      descricao: novoLancamento.descricao,
      valor: valorFloat,
      tipo: novoLancamento.tipo,
      categoria: novoLancamento.categoria || 'Geral', 
      taxa_retorno: novoLancamento.tipo === 'investimento' ? parseFloat(novoLancamento.taxa_retorno || 0) : 0,
      data_transacao: new Date().toISOString()
    });
    
    setNovoLancamento({ ...novoLancamento, descricao: '', valor: '', taxa_retorno: '', categoria: '', origem: 'saldo' });
    fetchData();
  }

  // --- CADASTROS DE FIXAS (Modelos) ---
  async function handleSalvarFixa(e) {
    e.preventDefault();
    if (!novaFixa.descricao || !novaFixa.valor) return alert("Preencha tudo!");
    await supabase.from('despesas_fixas').insert({
      user_id: user.id, descricao: novaFixa.descricao, valor: parseFloat(novaFixa.valor), categoria: novaFixa.categoria || 'Fixa'
    });
    setNovaFixa({ descricao: '', valor: '', categoria: '' });
    fetchFixas();
    alert("Despesa Fixa salva!");
  }

  async function handleSalvarReceitaFixa(e) {
    e.preventDefault();
    if (!novaReceitaFixa.descricao || !novaReceitaFixa.valor) return alert("Preencha tudo!");
    await supabase.from('receitas_fixas').insert({
      user_id: user.id, descricao: novaReceitaFixa.descricao, valor: parseFloat(novaReceitaFixa.valor), categoria: novaReceitaFixa.categoria || 'Salário'
    });
    setNovaReceitaFixa({ descricao: '', valor: '', categoria: '' });
    fetchReceitasFixas();
    alert("Receita Fixa salva!");
  }

  // --- AÇÃO DE LANÇAR NO MÊS (O botão "Confirmar" mensal) ---
  async function lancarFixasNoMes() {
    if (confirm(`Lançar ${fixas.length} contas fixas como DESPESA hoje?`)) {
      const novas = fixas.map(f => ({
        user_id: user.id, descricao: f.descricao, valor: f.valor, tipo: 'despesa', categoria: f.categoria, data_transacao: new Date().toISOString()
      }));
      const { error } = await supabase.from('transacoes').insert(novas);
      if (!error) { alert("Lançado!"); fetchData(); }
    }
  }

  async function lancarReceitasFixasNoMes() {
    if (confirm(`Lançar ${receitasFixas.length} receitas fixas como RECEITA hoje?`)) {
      const novas = receitasFixas.map(r => ({
        user_id: user.id, descricao: r.descricao, valor: r.valor, tipo: 'receita', categoria: r.categoria, data_transacao: new Date().toISOString()
      }));
      const { error } = await supabase.from('transacoes').insert(novas);
      if (!error) { alert("Lançado!"); fetchData(); }
    }
  }

  // --- GESTÃO DE METAS (O que estava faltando) ---
  async function handleCriarMeta(e) {
    e.preventDefault();
    if (!novaMeta.categoria || !novaMeta.valor_limite) return alert("Preencha categoria e valor!");
    
    await supabase.from('metas').insert({
      user_id: user.id, 
      categoria: novaMeta.categoria, 
      valor_limite: parseFloat(novaMeta.valor_limite)
    });
    
    setNovaMeta({ categoria: '', valor_limite: '' });
    fetchData(); // Atualiza para aparecer na lista imediatamente
  }

  // --- EXCLUSÕES ---
  async function handleExcluirMeta(id) { if(confirm("Apagar meta?")) { await supabase.from('metas').delete().eq('id', id); fetchData(); } }
  async function handleExcluirTransacao(id) { if(confirm("Apagar?")) { await supabase.from('transacoes').delete().eq('id', id); fetchData(); } }
  async function handleExcluirFixa(id) { if(confirm("Remover fixa?")) { await supabase.from('despesas_fixas').delete().eq('id', id); fetchFixas(); } }
  async function handleExcluirReceitaFixa(id) { if(confirm("Remover receita?")) { await supabase.from('receitas_fixas').delete().eq('id', id); fetchReceitasFixas(); } }

  // --- CÁLCULOS MATEMÁTICOS ---

  // 1. Saldos e Totais Reais (Baseado no histórico)
  const totalReceitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const totalInvestido = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, t) => acc + t.valor, 0);
  const totalDespesasGeral = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
  const saldoConta = totalReceitas - totalDespesasGeral - totalInvestido;

  const gastosDoMes = transacoes.filter(t => {
    const d = new Date(t.data_transacao);
    return t.tipo === 'despesa' && d.getMonth() === mesRef && d.getFullYear() === anoRef;
  }).reduce((acc, t) => acc + t.valor, 0);

  // 2. Gráficos
  const dadosDespesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.categoria);
      if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor });
      return acc;
    }, []);

  const dadosPatrimonio = [
    { name: 'Em Conta', value: saldoConta > 0 ? saldoConta : 0 },
    { name: 'Investido', value: totalInvestido }
  ];

  const CORES_DESPESAS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
  const CORES_PATRIMONIO = ['#10B981', '#3B82F6'];

  // 3. PREVISÃO DE CAIXA (A Lógica que você pediu)
  // Receita Fixa (Lançada) + Variáveis (Lançadas) - Metas - Despesas Fixas (Lançadas)
  // Como 'SaldoConta' já contém (Receitas Lançadas - Despesas Lançadas), a conta simplifica para:
  // Saldo Atual - Valor das Metas que eu ainda pretendo gastar.
  // Mas para seguir sua lógica estrita de "Subtraído pelas metas":
  const somaMetas = metas.reduce((acc, m) => acc + m.valor_limite, 0);
  
  // Vamos ser conservadores: Saldo que eu tenho HOJE - Tudo que planejei gastar (Metas)
  const previsaoCaixa = saldoConta - somaMetas; 

  const inputClass = "w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-base md:text-lg";

  return (
    <div className="min-h-screen bg-neutral-900 font-sans pb-24 text-gray-100">
      
      {/* HEADER + PREVISÃO */}
      <div style={{ backgroundColor: '#C5A028' }} className="text-white pt-10 pb-20 px-4 md:px-6 rounded-b-[2rem] shadow-xl mb-[-3rem] relative z-10">
        <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center">
             <div>
                <h1 className="text-2xl font-bold">Olá, Roger</h1>
                <p className="text-xs text-white/80">Gestão Inteligente</p>
             </div>
             <button onClick={() => window.location.reload()} className="bg-white/20 p-2 rounded hover:bg-white/30">🔄</button>
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto mb-6">
          <CardResumo titulo="Saldo Atual" valor={saldoConta} cor="green" />
          <CardResumo titulo="Gasto Mês" valor={gastosDoMes} cor="red" />
          <CardResumo titulo="Investido" valor={totalInvestido} cor="blue" />
          <CardResumo titulo="Patrimônio" valor={saldoConta + totalInvestido} cor="gold" bgDark />
        </div>
      </div>

      <div className="px-3 md:px-4 max-w-5xl mx-auto space-y-6 pt-16">
        
        {/* CARD DE PREVISÃO (Lógica Solicitada) */}
        <div className="bg-neutral-800 p-5 rounded-2xl shadow-lg border border-neutral-700">
            <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">🔮 Previsão (Saldo - Metas)</h3>
            <div className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-xl border border-neutral-700">
                <div className="text-center">
                    <p className="text-xs text-gray-500">Saldo Real</p>
                    <p className="text-lg font-bold text-white">{saldoConta.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <span className="text-gray-600 font-bold">-</span>
                <div className="text-center">
                    <p className="text-xs text-gray-500">Metas</p>
                    <p className="text-lg font-bold text-red-400">{somaMetas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <span className="text-gray-600 font-bold">=</span>
                <div className={`text-center p-2 rounded ${previsaoCaixa >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                    <p className="text-xs text-gray-400">Previsão</p>
                    <p className={`text-xl font-bold ${previsaoCaixa >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                        {previsaoCaixa.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </p>
                </div>
            </div>
        </div>

        {/* NAVEGAÇÃO ABAS */}
        <div className="flex justify-between gap-1 bg-neutral-800 p-1.5 rounded-xl max-w-2xl mx-auto overflow-hidden">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition ${abaAtiva === 'lancamentos' ? 'bg-[#C5A028] text-white' : 'text-gray-400 hover:text-gray-200'}`}>Diário</button>
          <button onClick={() => setAbaAtiva('receitas')} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition ${abaAtiva === 'receitas' ? 'bg-[#C5A028] text-white' : 'text-gray-400 hover:text-gray-200'}`}>Receitas</button>
          <button onClick={() => setAbaAtiva('fixas')} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition ${abaAtiva === 'fixas' ? 'bg-[#C5A028] text-white' : 'text-gray-400 hover:text-gray-200'}`}>Desp. Fixas</button>
          <button onClick={() => setAbaAtiva('metas')} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition ${abaAtiva === 'metas' ? 'bg-[#C5A028] text-white' : 'text-gray-400 hover:text-gray-200'}`}>METAS</button>
        </div>

        {/* --- ABA 1: DIÁRIO --- */}
        {abaAtiva === 'lancamentos' && (
          <div className="space-y-6">
            <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-lg border-t-4 text-gray-800 ${novoLancamento.tipo === 'receita' ? 'border-green-500' : 'border-red-500'}`}>
              <h2 className="text-lg font-bold text-gray-800 mb-4">🚀 Novo Lançamento</h2>
              <form onSubmit={handleSalvar}>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'receita'})} className={`flex-1 py-2 font-bold rounded border ${novoLancamento.tipo === 'receita' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>Receita</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'despesa'})} className={`flex-1 py-2 font-bold rounded border ${novoLancamento.tipo === 'despesa' ? 'bg-red-600 text-white' : 'text-gray-600'}`}>Despesa</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'investimento'})} className={`flex-1 py-2 font-bold rounded border ${novoLancamento.tipo === 'investimento' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Invest.</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" placeholder="Descrição" className={inputClass} value={novoLancamento.descricao} onChange={e => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} />
                    <input type="number" placeholder="Valor" className={inputClass} value={novoLancamento.valor} onChange={e => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} />
                    <input type="text" list="sugestoes" placeholder="Categoria" className={inputClass} value={novoLancamento.categoria} onChange={e => setNovoLancamento({ ...novoLancamento, categoria: e.target.value })} />
                    <datalist id="sugestoes"><option value="Alimentação"/><option value="Transporte"/><option value="Lazer"/><option value="Casa"/></datalist>
                </div>
                <button className="w-full mt-4 bg-neutral-800 text-white py-4 rounded-xl font-bold hover:bg-neutral-700">Confirmar Lançamento</button>
              </form>
            </div>

            {/* Gráficos Resumidos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GraficoCard titulo="Patrimônio" dados={dadosPatrimonio} cores={CORES_PATRIMONIO} corBorda="gold" />
                <GraficoCard titulo="Gastos por Categoria" dados={dadosDespesas} cores={CORES_DESPESAS} corBorda="red" />
            </div>
            
            {/* Lista Histórico */}
            <div className="bg-white rounded-xl shadow p-4 text-gray-800">
                <h3 className="font-bold mb-3">Últimas Movimentações</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {transacoes.map(t => (
                        <div key={t.id} className="flex justify-between items-center border-b py-2 text-sm">
                            <div>
                                <p className="font-bold">{t.descricao}</p>
                                <p className="text-xs text-gray-500">{new Date(t.data_transacao).toLocaleDateString()} - {t.categoria}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                                    {t.tipo === 'receita' ? '+' : '-'} R$ {t.valor}
                                </p>
                                <button onClick={() => handleExcluirTransacao(t.id)} className="text-xs text-red-400">Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* --- ABA 2: RECEITAS FIXAS --- */}
        {abaAtiva === 'receitas' && (
            <div className="bg-white p-6 rounded-2xl text-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">💰 Receitas Fixas</h2>
                    <button onClick={lancarReceitasFixasNoMes} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-green-700">Lançar no Mês</button>
                </div>
                <form onSubmit={handleSalvarReceitaFixa} className="flex gap-2 mb-6">
                    <input className="border p-2 rounded flex-1" placeholder="Ex: Salário" value={novaReceitaFixa.descricao} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, descricao: e.target.value})} />
                    <input className="border p-2 rounded w-24" type="number" placeholder="R$" value={novaReceitaFixa.valor} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, valor: e.target.value})} />
                    <button className="bg-green-600 text-white p-2 rounded">Salvar</button>
                </form>
                {receitasFixas.map(r => (
                    <div key={r.id} className="flex justify-between p-3 bg-gray-50 border-b mb-2 rounded">
                        <span>{r.descricao}</span>
                        <div className="flex gap-4">
                            <span className="font-bold text-green-600">R$ {r.valor}</span>
                            <button onClick={() => handleExcluirReceitaFixa(r.id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- ABA 3: DESPESAS FIXAS --- */}
        {abaAtiva === 'fixas' && (
            <div className="bg-white p-6 rounded-2xl text-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">⚙️ Despesas Fixas</h2>
                    <button onClick={lancarFixasNoMes} className="bg-red-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-red-700">Lançar no Mês</button>
                </div>
                <form onSubmit={handleSalvarFixa} className="flex gap-2 mb-6">
                    <input className="border p-2 rounded flex-1" placeholder="Ex: Aluguel" value={novaFixa.descricao} onChange={e => setNovaFixa({...novaFixa, descricao: e.target.value})} />
                    <input className="border p-2 rounded w-24" type="number" placeholder="R$" value={novaFixa.valor} onChange={e => setNovaFixa({...novaFixa, valor: e.target.value})} />
                    <button className="bg-red-600 text-white p-2 rounded">Salvar</button>
                </form>
                {fixas.map(f => (
                    <div key={f.id} className="flex justify-between p-3 bg-gray-50 border-b mb-2 rounded">
                        <span>{f.descricao}</span>
                        <div className="flex gap-4">
                            <span className="font-bold text-red-600">R$ {f.valor}</span>
                            <button onClick={() => handleExcluirFixa(f.id)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- ABA 4: METAS (RESTAURADA) --- */}
        {abaAtiva === 'metas' && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <h2 className="text-xl font-bold mb-4">🎯 Controle de Metas</h2>
                
                {/* Formulário de Metas (Restaurado) */}
                <form onSubmit={handleCriarMeta} className="flex flex-col md:flex-row gap-3 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <input 
                        type="text" 
                        placeholder="Categoria (Ex: Alimentação)" 
                        className="flex-1 p-3 rounded border border-blue-200" 
                        value={novaMeta.categoria} 
                        onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})} 
                    />
                    <input 
                        type="number" 
                        placeholder="Limite Mensal (R$)" 
                        className="w-full md:w-40 p-3 rounded border border-blue-200" 
                        value={novaMeta.valor_limite} 
                        onChange={e => setNovaMeta({...novaMeta, valor_limite: e.target.value})} 
                    />
                    <button className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700">Criar Meta</button>
                </form>

                <div className="space-y-4">
                    {metas.length === 0 && <p className="text-center text-gray-400">Nenhuma meta definida.</p>}
                    
                    {metas.map(meta => {
                        // Lógica de cálculo da barra de progresso
                        const gastoNaCategoria = transacoes
                            .filter(t => { 
                                const d = new Date(t.data_transacao);
                                return t.tipo === 'despesa' && 
                                       d.getMonth() === mesRef && 
                                       limparTexto(t.categoria) === limparTexto(meta.categoria); 
                            })
                            .reduce((acc, t) => acc + t.valor, 0);
                        
                        const porcentagem = Math.min(100, (gastoNaCategoria / meta.valor_limite) * 100);
                        const estourou = gastoNaCategoria > meta.valor_limite;

                        return (
                            <div key={meta.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-gray-700 capitalize text-lg">{meta.categoria}</span>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${estourou ? 'text-red-500' : 'text-gray-500'}`}>
                                            R$ {gastoNaCategoria.toFixed(2)} / {meta.valor_limite}
                                        </span>
                                        <button onClick={() => handleExcluirMeta(meta.id)} className="text-gray-400 hover:text-red-600">🗑️</button>
                                    </div>
                                </div>
                                
                                {/* Barra de Progresso Visual */}
                                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden relative">
                                    <div 
                                        className={`h-full transition-all duration-500 ${estourou ? 'bg-red-500' : 'bg-green-500'}`} 
                                        style={{ width: `${porcentagem}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-right mt-1 text-gray-400">{porcentagem.toFixed(1)}% do limite</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

function CardResumo({ titulo, valor, cor, bgDark }) {
    let style = bgDark ? 'bg-[#C5A028] text-white border-yellow-600' : `bg-white text-gray-800 border-${cor}-500`;
    return (
        <div className={`p-4 rounded-xl shadow border-l-4 ${style}`}>
            <p className="text-xs font-bold uppercase opacity-70">{titulo}</p>
            <p className="text-lg font-bold">R$ {Number(valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
    )
}

function GraficoCard({ titulo, dados, cores, corBorda }) {
    return (
        <div className={`bg-white p-4 rounded-xl shadow border-t-4 border-${corBorda}-500 text-gray-800`}>
             <h3 className="text-sm font-bold mb-2">{titulo}</h3>
             <div className="h-48 text-xs">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={dados} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                            {dados.map((entry, index) => <Cell key={index} fill={cores[index % cores.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
             </div>
        </div>
    )
}
