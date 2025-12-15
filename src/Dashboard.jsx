import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- FUNÇÃO AUXILIAR ---
const limparTexto = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

export default function Dashboard({ session }) {
  const user = session.user;
  const [loading, setLoading] = useState(true);

  // --- DADOS ---
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);             // Metas ATIVAS (Mês Atual)
  const [metasFixas, setMetasFixas] = useState([]);   // Metas MODELO
  const [fixas, setFixas] = useState([]);             // Despesas Fixas
  const [receitasFixas, setReceitasFixas] = useState([]); 

  // --- DATAS ---
  const hoje = new Date().toISOString().split('T')[0];
  const [dataConsulta, setDataConsulta] = useState(hoje);
  const dataRef = new Date(dataConsulta);
  const mesRef = dataRef.getMonth();
  const anoRef = dataRef.getFullYear();

  // --- UI ---
  const [abaAtiva, setAbaAtiva] = useState('lancamentos');

  // --- FORMULÁRIOS ---
  const [novoLancamento, setNovoLancamento] = useState({ 
    descricao: '', valor: '', tipo: 'despesa', categoria: '', origem: 'saldo' 
  });
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaReceitaFixa, setNovaReceitaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaMetaFixa, setNovaMetaFixa] = useState({ categoria: '', valor_limite: '' }); 
  const [novaMetaManual, setNovaMetaManual] = useState({ categoria: '', valor_limite: '' }); 

  useEffect(() => { 
    fetchData(); 
    fetchFixas(); 
    fetchReceitasFixas();
    fetchMetasFixas(); 
  }, []);

  // --- BUSCAS ---
  async function fetchData() {
    setLoading(true);
    const { data: tData } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false }).limit(2000); 
    if (tData) setTransacoes(tData);
    const { data: mData } = await supabase.from('metas').select('*');
    if (mData) setMetas(mData);
    setLoading(false);
  }
  async function fetchFixas() { const { data } = await supabase.from('despesas_fixas').select('*'); if (data) setFixas(data); }
  async function fetchReceitasFixas() { const { data } = await supabase.from('receitas_fixas').select('*'); if (data) setReceitasFixas(data); }
  async function fetchMetasFixas() { const { data } = await supabase.from('metas_fixas').select('*'); if (data) setMetasFixas(data); }

  // --- AÇÕES DE SALVAR ---
  async function handleSalvar(e) {
    e.preventDefault();
    if (!novoLancamento.descricao || !novoLancamento.valor) return alert("Preencha tudo!");
    const valorFloat = parseFloat(novoLancamento.valor);

    if (novoLancamento.tipo === 'investimento' && novoLancamento.origem === 'novo') {
        await supabase.from('transacoes').insert({
          user_id: user.id, descricao: `Aporte: ${novoLancamento.descricao}`, valor: valorFloat, tipo: 'receita', categoria: 'Aporte Externo', data_transacao: new Date().toISOString()
        });
    }
    await supabase.from('transacoes').insert({
      user_id: user.id, descricao: novoLancamento.descricao, valor: valorFloat, tipo: novoLancamento.tipo, categoria: novoLancamento.categoria || 'Geral', data_transacao: new Date().toISOString()
    });
    setNovoLancamento({ ...novoLancamento, descricao: '', valor: '', categoria: '', origem: 'saldo' });
    fetchData();
  }

  async function handleSalvarFixa(e) { e.preventDefault(); if(!novaFixa.descricao) return; await supabase.from('despesas_fixas').insert({ user_id: user.id, descricao: novaFixa.descricao, valor: parseFloat(novaFixa.valor), categoria: novaFixa.categoria || 'Fixa' }); setNovaFixa({descricao:'', valor:'', categoria:''}); fetchFixas(); }
  async function handleSalvarReceitaFixa(e) { e.preventDefault(); if(!novaReceitaFixa.descricao) return; await supabase.from('receitas_fixas').insert({ user_id: user.id, descricao: novaReceitaFixa.descricao, valor: parseFloat(novaReceitaFixa.valor), categoria: novaReceitaFixa.categoria || 'Salário' }); setNovaReceitaFixa({descricao:'', valor:'', categoria:''}); fetchReceitasFixas(); }
  async function handleSalvarMetaFixa(e) { e.preventDefault(); if(!novaMetaFixa.categoria) return; await supabase.from('metas_fixas').insert({ user_id: user.id, categoria: novaMetaFixa.categoria, valor_limite: parseFloat(novaMetaFixa.valor_limite) }); setNovaMetaFixa({ categoria: '', valor_limite: '' }); fetchMetasFixas(); }
  async function handleCriarMetaManual(e) { e.preventDefault(); if(!novaMetaManual.categoria) return; await supabase.from('metas').insert({ user_id: user.id, categoria: novaMetaManual.categoria, valor_limite: parseFloat(novaMetaManual.valor_limite) }); setNovaMetaManual({ categoria: '', valor_limite: '' }); fetchData(); }

  // --- BOTÕES "LANÇAR NO MÊS" ---
  async function lancarFixasNoMes() { if (confirm(`Lançar ${fixas.length} contas fixas?`)) { const novas = fixas.map(f => ({ user_id: user.id, descricao: f.descricao, valor: f.valor, tipo: 'despesa', categoria: f.categoria, data_transacao: new Date().toISOString() })); await supabase.from('transacoes').insert(novas); fetchData(); } }
  async function lancarReceitasFixasNoMes() { if (confirm(`Lançar ${receitasFixas.length} receitas fixas?`)) { const novas = receitasFixas.map(r => ({ user_id: user.id, descricao: r.descricao, valor: r.valor, tipo: 'receita', categoria: r.categoria, data_transacao: new Date().toISOString() })); await supabase.from('transacoes').insert(novas); fetchData(); } }
  async function lancarMetasFixasNoMes() { if (confirm(`Lançar ${metasFixas.length} METAS para controle neste mês?`)) { const novas = metasFixas.map(m => ({ user_id: user.id, categoria: m.categoria, valor_limite: m.valor_limite })); await supabase.from('metas').insert(novas); fetchData(); } }

  // --- EXCLUSÃO ---
  async function handleExcluir(id, table) { if(confirm("Excluir item?")) { await supabase.from(table).delete().eq('id', id); if(table === 'transacoes' || table === 'metas') fetchData(); if(table === 'despesas_fixas') fetchFixas(); if(table === 'receitas_fixas') fetchReceitasFixas(); if(table === 'metas_fixas') fetchMetasFixas(); } }

  // --- CÁLCULOS ---
  const totalReceitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const totalInvestido = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, t) => acc + t.valor, 0);
  const totalDespesasGeral = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
  const saldoConta = totalReceitas - totalDespesasGeral - totalInvestido;

  // Previsão: Saldo Atual - (Metas Ativas - Gasto Realizado nelas)
  const somaMetasRestantes = metas.reduce((acc, meta) => {
      const gastoNaCategoria = transacoes.filter(t => {
            const d = new Date(t.data_transacao);
            return t.tipo === 'despesa' && d.getMonth() === mesRef && d.getFullYear() === anoRef && limparTexto(t.categoria) === limparTexto(meta.categoria);
      }).reduce((sum, t) => sum + t.valor, 0);
      return acc + Math.max(0, meta.valor_limite - gastoNaCategoria);
  }, 0);

  const previsaoCaixa = saldoConta - somaMetasRestantes;

  // DADOS PARA GRÁFICOS (RESTAURADOS)
  const dadosDespesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.categoria);
      if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor }); return acc;
  }, []);

  const dadosInvestimentos = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, curr) => {
    const found = acc.find(item => item.name === curr.categoria);
    if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor }); return acc;
  }, []);
    
  const dadosPatrimonio = [{ name: 'Em Conta', value: saldoConta > 0 ? saldoConta : 0 }, { name: 'Investido', value: totalInvestido }];

  const CORES_DESPESAS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
  const CORES_INVEST = ['#3B82F6', '#6366F1', '#8B5CF6'];
  const CORES_PATRIMONIO = ['#10B981', '#3B82F6'];
  
  const inputClass = "w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm md:text-base";

  return (
    <div className="min-h-screen bg-neutral-900 font-sans pb-24 text-gray-100">
      
      {/* HEADER */}
      <div style={{ backgroundColor: '#C5A028' }} className="text-white pt-8 pb-16 px-4 rounded-b-[2rem] shadow-xl mb-[-3rem] relative z-10">
        <div className="max-w-5xl mx-auto mb-4 flex justify-between items-center">
             <div><h1 className="text-xl md:text-2xl font-bold">Olá, Roger</h1><p className="text-xs text-white/80">Gestão Inteligente</p></div>
             <button onClick={() => window.location.reload()} className="bg-white/20 p-2 rounded hover:bg-white/30">🔄</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-5xl mx-auto">
          <CardResumo titulo="Saldo Real" valor={saldoConta} cor="green" />
          <CardResumo titulo="Gasto Mês" valor={totalDespesasGeral} cor="red" />
          <CardResumo titulo="Investido" valor={totalInvestido} cor="blue" />
          <CardResumo titulo="Patrimônio" valor={saldoConta + totalInvestido} cor="gold" bgDark />
        </div>
      </div>

      <div className="px-3 max-w-5xl mx-auto space-y-5 pt-14">
        
        {/* PREVISÃO */}
        <div className="bg-neutral-800 p-4 rounded-2xl shadow-lg border border-neutral-700">
            <h3 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">🔮 Previsão de Caixa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-700">
                    <p className="text-[10px] text-gray-500 uppercase">Restante Metas</p>
                    <p className="text-base font-bold text-red-400">-{somaMetasRestantes.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-700">
                    <p className="text-[10px] text-gray-500 uppercase">Saldo Atual</p>
                    <p className="text-base font-bold text-white">{saldoConta.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
                <div className={`p-3 rounded-xl border ${previsaoCaixa >= 0 ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Previsão Final</p>
                    <p className={`text-lg font-bold ${previsaoCaixa >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                        {previsaoCaixa.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </p>
                </div>
            </div>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="flex justify-between gap-1 bg-neutral-800 p-1 rounded-xl max-w-full overflow-x-auto">
          {['lancamentos', 'receitas', 'fixas', 'metas'].map(aba => (
             <button key={aba} onClick={() => setAbaAtiva(aba)} className={`flex-1 min-w-[70px] py-2 text-[10px] md:text-sm font-bold rounded-lg transition ${abaAtiva === aba ? 'bg-[#C5A028] text-white' : 'text-gray-400 hover:text-gray-200 uppercase'}`}>
                {aba === 'lancamentos' ? 'Diário' : aba === 'fixas' ? 'Desp. Fixas' : aba === 'metas' ? 'Metas Fixas' : aba.toUpperCase()}
             </button>
          ))}
        </div>

        {/* --- ABA DIÁRIO (COMPLETA) --- */}
        {abaAtiva === 'lancamentos' && (
          <div className="space-y-6">
            
            {/* 1. NOVO LANÇAMENTO */}
            <div className={`bg-white p-4 rounded-2xl shadow border-t-4 text-gray-800 ${novoLancamento.tipo === 'receita' ? 'border-green-500' : 'border-red-500'}`}>
              <h2 className="text-sm md:text-lg font-bold text-gray-800 mb-3">🚀 Novo Lançamento</h2>
              <form onSubmit={handleSalvar}>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'receita'})} className={`flex-1 py-2 text-xs font-bold rounded border ${novoLancamento.tipo === 'receita' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>Receita</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'despesa'})} className={`flex-1 py-2 text-xs font-bold rounded border ${novoLancamento.tipo === 'despesa' ? 'bg-red-600 text-white' : 'text-gray-600'}`}>Despesa</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'investimento'})} className={`flex-1 py-2 text-xs font-bold rounded border ${novoLancamento.tipo === 'investimento' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Invest.</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" placeholder="Descrição" className={inputClass} value={novoLancamento.descricao} onChange={e => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} />
                    <input type="number" placeholder="Valor" className={inputClass} value={novoLancamento.valor} onChange={e => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} />
                    <input type="text" list="sugestoes" placeholder="Categoria" className={inputClass} value={novoLancamento.categoria} onChange={e => setNovoLancamento({ ...novoLancamento, categoria: e.target.value })} />
                    <datalist id="sugestoes"><option value="Alimentação"/><option value="Transporte"/><option value="Lazer"/><option value="Casa"/></datalist>
                </div>
                <button className="w-full mt-3 bg-neutral-800 text-white py-3 rounded-lg font-bold hover:bg-neutral-700 text-sm">LANÇAR</button>
              </form>
            </div>

            {/* 2. METAS DO MÊS (RESTAURADO AQUI) */}
            <div className="bg-white p-4 rounded-2xl shadow border-gray-200 text-gray-800">
                <h2 className="text-lg font-bold mb-3">🎯 Metas do Mês</h2>
                
                {/* Criar Meta Manual Rápida */}
                <form onSubmit={handleCriarMetaManual} className="flex gap-2 mb-4 bg-gray-50 p-2 rounded-lg">
                    <input type="text" placeholder="Nova Meta" className="flex-1 p-2 text-sm border rounded" value={novaMetaManual.categoria} onChange={e => setNovaMetaManual({...novaMetaManual, categoria: e.target.value})} />
                    <input type="number" placeholder="Limite" className="w-24 p-2 text-sm border rounded" value={novaMetaManual.valor_limite} onChange={e => setNovaMetaManual({...novaMetaManual, valor_limite: e.target.value})} />
                    <button className="bg-blue-600 text-white px-3 rounded font-bold text-xs">+</button>
                </form>

                <div className="space-y-4">
                    {metas.length === 0 && <p className="text-center text-gray-400 text-sm">Nenhuma meta ativa.</p>}
                    {metas.map(meta => {
                        const gastoNaCategoria = transacoes.filter(t => { 
                                const d = new Date(t.data_transacao);
                                return t.tipo === 'despesa' && d.getMonth() === mesRef && limparTexto(t.categoria) === limparTexto(meta.categoria); 
                            }).reduce((acc, t) => acc + t.valor, 0);
                        const porcentagem = Math.min(100, (gastoNaCategoria / meta.valor_limite) * 100);
                        const estourou = gastoNaCategoria > meta.valor_limite;
                        const disponivel = meta.valor_limite - gastoNaCategoria;

                        return (
                            <div key={meta.id}>
                                <div className="flex justify-between items-center mb-1 text-sm">
                                    <span className="font-bold text-gray-700 capitalize">{meta.categoria}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${estourou ? 'text-red-500 font-bold' : 'text-gray-500'}`}>R$ {gastoNaCategoria.toFixed(0)} / {meta.valor_limite}</span>
                                        <button onClick={() => handleExcluir(meta.id, 'metas')} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative">
                                    <div className={`h-full transition-all duration-500 ${estourou ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${porcentagem}%` }}></div>
                                </div>
                                <p className="text-[10px] text-right mt-1 text-gray-500">
                                    {disponivel < 0 ? `Passou R$ ${Math.abs(disponivel).toFixed(0)}` : `Resta R$ ${disponivel.toFixed(0)}`}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. GRÁFICOS (RESTAURADOS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GraficoCard titulo="Patrimônio" dados={dadosPatrimonio} cores={CORES_PATRIMONIO} corBorda="gold" />
                <GraficoCard titulo="Gastos por Categoria" dados={dadosDespesas} cores={CORES_DESPESAS} corBorda="red" />
                <GraficoCard titulo="Investimentos" dados={dadosInvestimentos} cores={CORES_INVEST} corBorda="blue" />
            </div>
            
            {/* 4. HISTÓRICO */}
            <div className="bg-white rounded-xl shadow p-4 text-gray-800">
                <h3 className="font-bold text-sm mb-3">Últimas Movimentações</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {transacoes.map(t => (
                        <div key={t.id} className="flex justify-between items-center border-b py-2 text-sm last:border-0">
                            <div className="max-w-[60%]">
                                <p className="font-bold truncate">{t.descricao}</p>
                                <p className="text-[10px] text-gray-500">{new Date(t.data_transacao).toLocaleDateString()} - {t.categoria}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>{t.tipo === 'receita' ? '+' : '-'} {t.valor}</p>
                                <button onClick={() => handleExcluir(t.id, 'transacoes')} className="text-[10px] text-red-400 p-1">Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* --- ABA RECEITAS FIXAS --- */}
        {abaAtiva === 'receitas' && (
            <div className="bg-white p-4 rounded-2xl text-gray-800 shadow">
                <div className="flex flex-col gap-3 mb-4 border-b pb-4">
                    <h2 className="text-lg font-bold text-green-700">💰 Receitas Fixas</h2>
                    <button onClick={lancarReceitasFixasNoMes} className="bg-green-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ LANÇAR NO MÊS ATUAL</button>
                </div>
                <form onSubmit={handleSalvarReceitaFixa} className="flex flex-col md:flex-row gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                    <input className={`${inputClass} bg-white`} placeholder="Descrição" value={novaReceitaFixa.descricao} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, descricao: e.target.value})} />
                    <input className={`${inputClass} md:w-32 bg-white`} type="number" placeholder="R$" value={novaReceitaFixa.valor} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, valor: e.target.value})} />
                    <button className="bg-green-600 text-white py-2 px-4 rounded-lg font-bold text-sm">Add</button>
                </form>
                <div className="space-y-2">
                    {receitasFixas.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                            <span className="font-bold text-sm">{r.descricao}</span>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-green-700">R$ {r.valor}</span>
                                <button onClick={() => handleExcluir(r.id, 'receitas_fixas')} className="text-red-400 text-xs">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ABA DESPESAS FIXAS --- */}
        {abaAtiva === 'fixas' && (
            <div className="bg-white p-4 rounded-2xl text-gray-800 shadow">
                <div className="flex flex-col gap-3 mb-4 border-b pb-4">
                    <h2 className="text-lg font-bold text-red-700">⚙️ Despesas Fixas</h2>
                    <button onClick={lancarFixasNoMes} className="bg-red-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ LANÇAR NO MÊS ATUAL</button>
                </div>
                <form onSubmit={handleSalvarFixa} className="flex flex-col md:flex-row gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                    <input className={`${inputClass} bg-white`} placeholder="Descrição" value={novaFixa.descricao} onChange={e => setNovaFixa({...novaFixa, descricao: e.target.value})} />
                    <input className={`${inputClass} md:w-32 bg-white`} type="number" placeholder="R$" value={novaFixa.valor} onChange={e => setNovaFixa({...novaFixa, valor: e.target.value})} />
                    <button className="bg-red-600 text-white py-2 px-4 rounded-lg font-bold text-sm">Add</button>
                </form>
                <div className="space-y-2">
                    {fixas.map(f => (
                        <div key={f.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                            <span className="font-bold text-sm">{f.descricao}</span>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-red-700">R$ {f.valor}</span>
                                <button onClick={() => handleExcluir(f.id, 'despesas_fixas')} className="text-red-400 text-xs">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ABA METAS FIXAS (Apenas Modelos) --- */}
        {abaAtiva === 'metas' && (
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <div className="flex flex-col gap-3 mb-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h2 className="text-sm font-bold text-blue-800 uppercase">📁 Modelos de Metas (Fixas)</h2>
                    <p className="text-xs text-gray-500">Cadastre aqui metas que se repetem todo mês.</p>
                    <button onClick={lancarMetasFixasNoMes} className="bg-blue-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ LANÇAR TODAS NO MÊS ATUAL</button>
                </div>
                
                <form onSubmit={handleSalvarMetaFixa} className="flex flex-col md:flex-row gap-2 mb-3 mt-4">
                     <input className={`${inputClass} bg-gray-50 border`} placeholder="Categoria Fixa" value={novaMetaFixa.categoria} onChange={e => setNovaMetaFixa({...novaMetaFixa, categoria: e.target.value})} />
                     <input className={`${inputClass} md:w-32 bg-gray-50 border`} type="number" placeholder="Limite" value={novaMetaFixa.valor_limite} onChange={e => setNovaMetaFixa({...novaMetaFixa, valor_limite: e.target.value})} />
                     <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Add</button>
                </form>

                <div className="space-y-1">
                    {metasFixas.map(mf => (
                         <div key={mf.id} className="flex justify-between items-center text-xs p-3 bg-white rounded border border-gray-100 shadow-sm">
                             <span className="font-bold text-gray-700">{mf.categoria}</span>
                             <div className="flex gap-3">
                                 <span className="font-bold text-blue-600">R$ {mf.valor_limite}</span>
                                 <button onClick={() => handleExcluir(mf.id, 'metas_fixas')} className="text-red-400">🗑️</button>
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

// COMPONENTES VISUAIS
function CardResumo({ titulo, valor, cor, bgDark }) {
    let style = bgDark ? 'bg-[#C5A028] text-white border-yellow-600' : `bg-white text-gray-800 border-${cor}-500`;
    return (
        <div className={`p-2 md:p-3 rounded-xl shadow border-l-4 ${style}`}>
            <p className="text-[10px] font-bold uppercase opacity-70">{titulo}</p>
            <p className="text-sm md:text-lg font-bold">R$ {Number(valor).toLocaleString('pt-BR', {minimumFractionDigits: 0})}</p>
        </div>
    )
}

function GraficoCard({ titulo, dados, cores, corBorda }) {
    return (
        <div className={`bg-white p-3 rounded-xl shadow border-t-4 border-${corBorda}-500 text-gray-800`}>
             <h3 className="text-xs font-bold mb-2 uppercase">{titulo}</h3>
             <div className="h-40 text-xs">
                {dados.some(d=>d.value>0) ? (
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={dados} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                            {dados.map((entry, index) => <Cell key={index} fill={cores[index % cores.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val) => `R$ ${val}`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-full text-gray-300">Sem dados</div>}
             </div>
        </div>
    )
}
