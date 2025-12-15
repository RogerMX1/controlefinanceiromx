import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard({ session }) {
  const user = session.user;
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [fixas, setFixas] = useState([]);
  
  const hoje = new Date().toISOString().split('T')[0];
  const [dataConsulta, setDataConsulta] = useState(hoje);

  const dataRef = new Date(dataConsulta);
  const mesRef = dataRef.getMonth();
  const anoRef = dataRef.getFullYear();

  const [abaAtiva, setAbaAtiva] = useState('lancamentos'); 
  const [novoLancamento, setNovoLancamento] = useState({ 
    descricao: '', valor: '', tipo: 'despesa', categoria: '', taxa_retorno: '', origem: 'saldo' 
  });
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaMeta, setNovaMeta] = useState({ categoria: '', valor_limite: '' });

  useEffect(() => { fetchData(); fetchFixas(); }, []);

  async function fetchData() {
    setLoading(true);
    // MELHORIA DE PERFORMANCE: Traz apenas as últimas 100 transações para não travar o celular
    const { data: tData } = await supabase
        .from('transacoes')
        .select('*')
        .order('data_transacao', { ascending: false })
        .limit(100); 
        
    if (tData) setTransacoes(tData);
    
    const { data: mData } = await supabase.from('metas').select('*');
    if (mData) setMetas(mData);
    setLoading(false);
  }

  async function fetchFixas() {
    const { data } = await supabase.from('despesas_fixas').select('*');
    if (data) setFixas(data);
  }

  async function handleSalvar(e) {
    e.preventDefault();
    if (!novoLancamento.descricao || !novoLancamento.valor) return alert("Preencha tudo!");
    
    const valorFloat = parseFloat(novoLancamento.valor);

    if (novoLancamento.tipo === 'investimento' && novoLancamento.origem === 'novo') {
        await supabase.from('transacoes').insert({
          user_id: user.id,
          descricao: `Aporte: ${novoLancamento.descricao}`,
          valor: valorFloat,
          tipo: 'receita',
          categoria: 'Aporte Externo',
          data_transacao: new Date().toISOString()
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

  async function handleSalvarFixa(e) {
    e.preventDefault();
    if (!novaFixa.descricao || !novaFixa.valor) return alert("Preencha tudo!");
    await supabase.from('despesas_fixas').insert({
      user_id: user.id, descricao: novaFixa.descricao, valor: parseFloat(novaFixa.valor), categoria: novaFixa.categoria || 'Fixa'
    });
    setNovaFixa({ descricao: '', valor: '', categoria: '' });
    fetchFixas();
    alert("Cadastrado!");
  }

  async function lancarFixasNoMes() {
    if (confirm(`Lançar ${fixas.length} contas fixas hoje?`)) {
      const novasTransacoes = fixas.map(f => ({
        user_id: user.id, descricao: f.descricao, valor: f.valor, tipo: 'despesa', categoria: f.categoria, data_transacao: new Date().toISOString()
      }));
      const { error } = await supabase.from('transacoes').insert(novasTransacoes);
      if (!error) { alert("Sucesso!"); fetchData(); }
    }
  }

  async function handleCriarMeta(e) {
    e.preventDefault();
    if (!novaMeta.categoria || !novaMeta.valor_limite) return alert("Erro");
    await supabase.from('metas').insert({
      user_id: user.id, categoria: novaMeta.categoria, valor_limite: parseFloat(novaMeta.valor_limite)
    });
    setNovaMeta({ categoria: '', valor_limite: '' });
    fetchData();
  }

  async function handleExcluirMeta(id) {
    if (confirm("Apagar meta?")) {
      await supabase.from('metas').delete().eq('id', id);
      fetchData();
    }
  }

  async function handleExcluirTransacao(id) {
    if (confirm("Apagar movimentação?")) {
      await supabase.from('transacoes').delete().eq('id', id);
      fetchData();
    }
  }

  // --- CÁLCULOS ---
  const dadosDespesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.categoria);
      if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor });
      return acc;
    }, []);

  const dadosInvestimentos = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.categoria);
      if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor });
      return acc;
    }, []);

  const CORES_DESPESAS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']; 
  const CORES_INVEST = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7'];
  const CORES_PATRIMONIO = ['#10B981', '#3B82F6']; 

  const totalReceitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const totalInvestido = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, t) => acc + t.valor, 0);
  
  const gastosDoMes = transacoes.filter(t => {
    const d = new Date(t.data_transacao);
    return t.tipo === 'despesa' && d.getMonth() === mesRef && d.getFullYear() === anoRef;
  }).reduce((acc, t) => acc + t.valor, 0);

  const totalDespesasGeral = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
  const saldoConta = totalReceitas - totalDespesasGeral - totalInvestido;

  const dadosPatrimonio = [
    { name: 'Em Conta', value: saldoConta > 0 ? saldoConta : 0 },
    { name: 'Investido', value: totalInvestido }
  ];

  const corBotaoConfirmar = 
    novoLancamento.tipo === 'receita' ? 'bg-green-600 hover:bg-green-700' :
    novoLancamento.tipo === 'investimento' ? 'bg-blue-600 hover:bg-blue-700' :
    'bg-red-600 hover:bg-red-700';

  // AJUSTE MOBILE: Input grande, mas sem quebrar a tela (text-base em vez de text-lg no mobile)
  const inputClass = "w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-base md:text-lg";

  return (
    <div className="min-h-screen bg-neutral-900 font-sans pb-24 text-gray-100 selection:bg-yellow-500 selection:text-white">
      
      {/* CABEÇALHO DOURADO (Compacto no Mobile) */}
      <div style={{ backgroundColor: '#C5A028' }} className="text-white pt-10 pb-16 px-4 md:px-6 rounded-b-[2rem] shadow-xl mb-[-3rem] relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 max-w-5xl mx-auto">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">Olá, Roger</h1>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Referência:</span>
              <input 
                type="date" 
                value={dataConsulta}
                onChange={(e) => setDataConsulta(e.target.value)}
                className="bg-black/20 border border-white/30 text-white text-sm font-bold rounded-lg px-3 py-1 outline-none focus:bg-black/30 cursor-pointer"
              />
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="mt-4 md:mt-0 bg-white/10 hover:bg-white/20 p-2 rounded-lg transition border border-white/20">🔄</button>
        </div>

        {/* CARDS RESUMO (Grid ajustado: 2 por linha no celular) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
          <CardResumo titulo="Saldo" valor={saldoConta} cor="green" />
          <CardResumo titulo="Investido" valor={totalInvestido} cor="blue" />
          <CardResumo titulo="Total" valor={saldoConta + totalInvestido} cor="gold" bgDark />
          <CardResumo titulo="Gasto Mês" valor={gastosDoMes} cor="red" />
        </div>
      </div>

      <div className="px-3 md:px-4 max-w-5xl mx-auto space-y-6 pt-16">
        
        {/* NAVEGAÇÃO DE ABAS (Mobile Friendly) */}
        <div className="flex justify-between gap-1 bg-neutral-800 p-1.5 rounded-xl max-w-lg mx-auto overflow-hidden">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition ${abaAtiva === 'lancamentos' ? 'bg-[#C5A028] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Diário</button>
          <button onClick={() => setAbaAtiva('fixas')} className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition ${abaAtiva === 'fixas' ? 'bg-[#C5A028] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Fixas</button>
          <button onClick={() => setAbaAtiva('metas')} className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition ${abaAtiva === 'metas' ? 'bg-[#C5A028] text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Metas</button>
        </div>

        {/* --- ABA 1: MOVIMENTAÇÃO (Dia a Dia) --- */}
        {abaAtiva === 'lancamentos' && (
          <>
            <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-lg border-t-4 text-gray-800 ${novoLancamento.tipo === 'receita' ? 'border-green-500' : novoLancamento.tipo === 'investimento' ? 'border-blue-500' : 'border-red-500'}`}>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                 🚀 Novo Lançamento
              </h2>
              <form onSubmit={handleSalvar}>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'receita'})} 
                    className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'receita' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-green-50 text-green-700 border-green-100'}`}>Receita</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'despesa'})} 
                    className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'despesa' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50 text-red-700 border-red-100'}`}>Despesa</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'investimento'})} 
                    className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'investimento' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>Invest.</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Descrição" className={inputClass} value={novoLancamento.descricao} onChange={e => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} />
                  <input type="number" placeholder="Valor (R$)" className={`${inputClass} font-bold`} value={novoLancamento.valor} onChange={e => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} />
                  <input type="text" list="sugestoes" placeholder="Categoria" className={inputClass} value={novoLancamento.categoria} onChange={e => setNovoLancamento({ ...novoLancamento, categoria: e.target.value })} />
                  <datalist id="sugestoes"><option value="Alimentação"/><option value="Transporte"/><option value="CDB"/><option value="Ações"/></datalist>
                  
                  {novoLancamento.tipo === 'investimento' && (
                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Origem do dinheiro:</label>
                        <div className="flex flex-col md:flex-row gap-3">
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-100">
                                <input type="radio" name="origem" checked={novoLancamento.origem !== 'novo'} onChange={() => setNovoLancamento({...novoLancamento, origem: 'saldo'})} />
                                <span className="text-sm text-gray-700">Saldo da Conta</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-100">
                                <input type="radio" name="origem" checked={novoLancamento.origem === 'novo'} onChange={() => setNovoLancamento({...novoLancamento, origem: 'novo'})} />
                                <span className="text-sm text-gray-700 font-bold">Dinheiro Novo</span>
                            </label>
                        </div>
                        <input type="number" step="0.01" placeholder="Taxa (% a.m.)" className={`mt-3 ${inputClass} border-blue-200 text-blue-700`} value={novoLancamento.taxa_retorno} onChange={e => setNovoLancamento({ ...novoLancamento, taxa_retorno: e.target.value })} />
                    </div>
                  )}
                </div>

                <button className={`w-full mt-6 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:opacity-90 active:scale-95 transition ${corBotaoConfirmar}`}>
                  Confirmar
                </button>
              </form>
            </div>

            {/* METAS NA HOME */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <h2 className="text-lg font-bold text-gray-800 mb-4">🎯 Metas ({dataRef.toLocaleString('pt-BR', { month: 'short' })})</h2>
                <div className="flex gap-2 mb-4 bg-gray-50 p-2 rounded-xl">
                  <input type="text" placeholder="Meta" className="flex-1 p-2 bg-white border rounded-lg text-sm" value={novaMeta.categoria} onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})} />
                  <input type="number" placeholder="Limite" className="w-20 p-2 bg-white border rounded-lg text-sm" value={novaMeta.valor_limite} onChange={e => setNovaMeta({...novaMeta, valor_limite: e.target.value})} />
                  <button onClick={handleCriarMeta} className="bg-[#C5A028] text-white px-3 rounded-lg font-bold shadow">+</button>
                </div>
                <div className="space-y-3">
                  {metas.length === 0 && <p className="text-center text-gray-400 text-xs">Nenhuma meta.</p>}
                  {metas.map(meta => {
                     const gasto = transacoes.filter(t => t.tipo === 'despesa' && t.categoria?.toLowerCase() === meta.categoria.toLowerCase() && new Date(t.data_transacao).getMonth() === mesRef).reduce((acc, t) => acc + t.valor, 0);
                     const pct = Math.min(100, (gasto / meta.valor_limite) * 100);
                     return (
                       <div key={meta.id} className="relative">
                         <div className="flex justify-between text-xs mb-1 font-bold text-gray-600">
                            <span className="capitalize">{meta.categoria}</span>
                            <div className="flex items-center gap-2">
                                <span className={pct >= 100 ? "text-red-500" : "text-gray-500"}>R$ {gasto} / {meta.valor_limite}</span>
                                <button onClick={() => handleExcluirMeta(meta.id)} className="text-gray-300 hover:text-red-500" title="Excluir">🗑️</button>
                            </div>
                         </div>
                         <div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }}></div></div>
                       </div>
                     )
                  })}
                </div>
            </div>

            {/* GRÁFICOS (Grid Responsivo) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GraficoCard titulo="💎 Patrimônio" dados={dadosPatrimonio} cores={CORES_PATRIMONIO} corBorda="green" />
              <GraficoCard titulo="🍕 Gastos" dados={dadosDespesas} cores={CORES_DESPESAS} corBorda="red" />
              <GraficoCard titulo="💰 Investimentos" dados={dadosInvestimentos} cores={CORES_INVEST} corBorda="blue" />
            </div>

            {/* EXTRATO */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-800 text-gray-800">
                <h2 className="text-lg font-bold text-gray-800 mb-4">📝 Histórico</h2>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
                  {transacoes.map(t => {
                    const dataT = new Date(t.data_transacao);
                    const dia = dataT.getDate().toString().padStart(2, '0');
                    const mes = dataT.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                    return (
                      <div key={t.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border-b border-gray-100">
                        <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center w-10 h-10 shadow-sm shrink-0">
                          <span className="text-sm font-bold text-gray-800 leading-none">{dia}</span>
                          <span className="text-[9px] font-bold text-gray-400 leading-none mt-0.5">{mes}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-700 text-sm truncate">{t.descricao}</p>
                          <p className="text-xs text-gray-400 capitalize truncate">{t.categoria} {t.taxa_retorno > 0 && `• ${t.taxa_retorno}%`}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-bold text-sm whitespace-nowrap ${t.tipo === 'receita' ? 'text-green-600' : t.tipo === 'investimento' ? 'text-blue-600' : 'text-red-500'}`}>
                            {t.tipo === 'receita' ? '+' : '-'} {t.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                          </span>
                          <button onClick={() => handleExcluirTransacao(t.id)} className="text-gray-300 hover:text-red-500 p-1" title="Apagar">🗑️</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>
          </>
        )}

        {/* --- ABA 2: FIXAS --- */}
        {abaAtiva === 'fixas' && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">⚙️ Despesas Fixas</h2>
                <button onClick={lancarFixasNoMes} className="w-full md:w-auto bg-green-600 text-white px-4 py-3 rounded-xl font-bold shadow-md active:scale-95 transition">✅ Lançar no Mês</button>
             </div>
             <form onSubmit={handleSalvarFixa} className="flex flex-col md:flex-row gap-2 mb-6 bg-gray-50 p-3 rounded-xl border">
                <input type="text" placeholder="Ex: Aluguel" className="p-3 bg-white border rounded-lg" value={novaFixa.descricao} onChange={e => setNovaFixa({...novaFixa, descricao: e.target.value})} />
                <input type="number" placeholder="Valor R$" className="p-3 bg-white border rounded-lg" value={novaFixa.valor} onChange={e => setNovaFixa({...novaFixa, valor: e.target.value})} />
                <button className="bg-blue-600 text-white py-3 px-6 rounded-lg font-bold shadow">Salvar</button>
             </form>
             <div className="space-y-2">
               {fixas.map(f => (
                 <div key={f.id} className="flex justify-between p-4 bg-gray-50 rounded-xl border-l-4 border-gray-400 shadow-sm">
                    <span className="font-bold text-gray-700">{f.descricao}</span>
                    <span className="font-bold text-gray-900">R$ {f.valor.toFixed(2)}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* --- ABA 3: METAS --- */}
        {abaAtiva === 'metas' && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
             <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">🎯 Gestão de Metas Fixas</h2>
                <p className="text-sm text-gray-500">Metas recorrentes.</p>
             </div>
             <form onSubmit={handleCriarMeta} className="flex gap-2 mb-6 bg-gray-50 p-3 rounded-xl border">
                <input type="text" placeholder="Categoria" className="flex-1 p-3 bg-white border rounded-lg" value={novaMeta.categoria} onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})} />
                <input type="number" placeholder="Limite" className="w-24 p-3 bg-white border rounded-lg" value={novaMeta.valor_limite} onChange={e => setNovaMeta({...novaMeta, valor_limite: e.target.value})} />
                <button className="bg-blue-600 text-white px-4 rounded-lg font-bold">OK</button>
             </form>
             <div className="space-y-2">
               {metas.map(m => (
                 <div key={m.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border-l-4 border-blue-400 shadow-sm">
                    <div>
                      <span className="font-bold block text-gray-800 capitalize">{m.categoria}</span>
                      <span className="text-xs text-gray-500">Limite Mensal</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-blue-600 text-lg">R$ {m.valor_limite}</span>
                      <button onClick={() => handleExcluirMeta(m.id)} className="text-red-500 p-2 text-xl" title="Excluir">🗑️</button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// COMPONENTES AUXILIARES PARA LIMPAR O CÓDIGO
function CardResumo({ titulo, valor, cor, bgDark }) {
  let corBorda = 'border-gray-200';
  let bg = 'bg-white';
  let txt = 'text-gray-800';
  if (bgDark) { bg = 'bg-[#C5A028]'; txt = 'text-white'; corBorda = 'border-yellow-600'; }
  else {
    if (cor === 'green') corBorda = 'border-green-500';
    if (cor === 'red') corBorda = 'border-red-500';
    if (cor === 'blue') corBorda = 'border-blue-500';
  }
  return (
    <div className={`p-3 md:p-4 rounded-xl shadow-md border-l-4 ${bg} ${corBorda} flex flex-col justify-between`}>
      <p className={`text-[9px] md:text-[10px] font-bold uppercase ${bgDark ? 'text-yellow-100' : 'text-gray-400'}`}>{titulo}</p>
      <p className={`text-sm md:text-lg font-bold mt-1 ${txt}`}>
        {valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
      </p>
    </div>
  );
}

function GraficoCard({ titulo, dados, cores, corBorda }) {
    let borderClass = 'border-gray-200';
    if(corBorda === 'green') borderClass = 'border-green-500';
    if(corBorda === 'red') borderClass = 'border-red-500';
    if(corBorda === 'blue') borderClass = 'border-blue-500';

    return (
        <div className={`bg-white p-4 rounded-2xl shadow-sm text-gray-800 border-t-4 ${borderClass}`}>
            <h3 className="text-xs font-bold text-gray-700 mb-2">{titulo}</h3>
            <div className="h-40 text-xs">
                {dados.length > 0 && dados.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie data={dados} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                        {dados.map((entry, index) => <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} />
                    <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{fontSize: '10px'}}/>
                    </PieChart>
                </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-gray-300">Sem dados</div>}
            </div>
        </div>
    )
}
