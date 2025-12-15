import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard({ session }) {
  const user = session.user;
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);
  const [fixas, setFixas] = useState([]);
  
  // Data Selecionada
  const hoje = new Date().toISOString().split('T')[0];
  const [dataConsulta, setDataConsulta] = useState(hoje);

  const dataRef = new Date(dataConsulta);
  const mesRef = dataRef.getMonth();
  const anoRef = dataRef.getFullYear();

  // Estados
  const [abaAtiva, setAbaAtiva] = useState('lancamentos'); 
  const [novoLancamento, setNovoLancamento] = useState({ 
    descricao: '', valor: '', tipo: 'despesa', categoria: '', taxa_retorno: '' 
  });
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaMeta, setNovaMeta] = useState({ categoria: '', valor_limite: '' });

  useEffect(() => { fetchData(); fetchFixas(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data: tData } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false });
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
    
    await supabase.from('transacoes').insert({
      user_id: user.id,
      descricao: novoLancamento.descricao,
      valor: parseFloat(novoLancamento.valor),
      tipo: novoLancamento.tipo,
      categoria: novoLancamento.categoria || 'Geral', 
      taxa_retorno: novoLancamento.tipo === 'investimento' ? parseFloat(novoLancamento.taxa_retorno || 0) : 0,
      data_transacao: new Date().toISOString()
    });
    
    setNovoLancamento({ ...novoLancamento, descricao: '', valor: '', taxa_retorno: '', categoria: '' });
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
    alert("Despesa fixa cadastrada!");
  }

  async function lancarFixasNoMes() {
    if (confirm(`Deseja lançar ${fixas.length} despesas fixas na data de hoje?`)) {
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
    // Não exibe alerta na tela principal para ser mais fluido, só atualiza
    if (abaAtiva === 'metas') alert("Meta Criada!"); 
  }

  async function handleExcluirMeta(id) {
    if (confirm("Tem certeza que deseja EXCLUIR essa meta?")) {
      await supabase.from('metas').delete().eq('id', id);
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

  const totalReceitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const totalInvestido = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, t) => acc + t.valor, 0);
  
  const gastosDoMes = transacoes.filter(t => {
    const d = new Date(t.data_transacao);
    return t.tipo === 'despesa' && d.getMonth() === mesRef && d.getFullYear() === anoRef;
  }).reduce((acc, t) => acc + t.valor, 0);

  const totalDespesasGeral = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
  const saldoConta = totalReceitas - totalDespesasGeral - totalInvestido;

  const corBotaoConfirmar = 
    novoLancamento.tipo === 'receita' ? 'bg-green-600 hover:bg-green-700' :
    novoLancamento.tipo === 'investimento' ? 'bg-blue-600 hover:bg-blue-700' :
    'bg-red-600 hover:bg-red-700';

  const inputClass = "w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-lg";

  return (
    <div className="min-h-screen bg-neutral-900 font-sans pb-20 text-gray-100">
      
      {/* CABEÇALHO DOURADO */}
      <div style={{ backgroundColor: '#C5A028' }} className="text-white pt-8 pb-20 px-6 rounded-b-[2.5rem] shadow-xl mb-[-3rem]">
        <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">Olá, Roger Medeiros</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-white/80">Referência:</span>
              <input 
                type="date" 
                value={dataConsulta}
                onChange={(e) => setDataConsulta(e.target.value)}
                className="bg-black/20 border border-white/30 text-white text-sm font-bold rounded-lg px-3 py-1 outline-none focus:bg-black/30 cursor-pointer"
              />
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition border border-white/20">🔄</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <CardResumo titulo="Saldo em Conta" valor={saldoConta} cor="green" />
          <CardResumo titulo="Total Investido" valor={totalInvestido} cor="blue" />
          <CardResumo titulo="Patrimônio Total" valor={saldoConta + totalInvestido} cor="gold" bgDark />
          <CardResumo titulo={`Gasto em ${dataRef.toLocaleString('pt-BR', { month: 'short' })}`} valor={gastosDoMes} cor="red" />
        </div>
      </div>

      <div className="px-4 max-w-5xl mx-auto space-y-8 pt-12">
        
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex justify-center gap-2 bg-neutral-800 p-2 rounded-xl max-w-lg mx-auto overflow-x-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${abaAtiva === 'lancamentos' ? 'bg-[#C5A028] text-white' : 'text-gray-400'}`}>Movimentação</button>
          <button onClick={() => setAbaAtiva('fixas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${abaAtiva === 'fixas' ? 'bg-[#C5A028] text-white' : 'text-gray-400'}`}>Despesas Fixas</button>
          <button onClick={() => setAbaAtiva('metas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${abaAtiva === 'metas' ? 'bg-[#C5A028] text-white' : 'text-gray-400'}`}>Metas Fixas 🎯</button>
        </div>

        {/* --- ABA 1: MOVIMENTAÇÃO (Dia a Dia) --- */}
        {abaAtiva === 'lancamentos' && (
          <>
            <div className={`bg-white p-6 rounded-2xl shadow-lg border-t-4 text-gray-800 ${novoLancamento.tipo === 'receita' ? 'border-green-500' : novoLancamento.tipo === 'investimento' ? 'border-blue-500' : 'border-red-500'}`}>
              <h2 className="text-lg font-bold text-gray-800 mb-4">🚀 Novo Lançamento</h2>
              <form onSubmit={handleSalvar}>
                <div className="flex gap-2 mb-4">
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'receita'})} 
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'receita' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'}`}>Receita</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'despesa'})} 
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'despesa' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}>Despesa</button>
                  <button type="button" onClick={() => setNovoLancamento({...novoLancamento, tipo: 'investimento'})} 
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition border-2 ${novoLancamento.tipo === 'investimento' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`}>Investimento</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Descrição" className={inputClass} value={novoLancamento.descricao} onChange={e => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} />
                  <input type="number" placeholder="Valor (R$)" className={`${inputClass} font-bold`} value={novoLancamento.valor} onChange={e => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} />
                  <input type="text" list="sugestoes" placeholder="Categoria" className={inputClass} value={novoLancamento.categoria} onChange={e => setNovoLancamento({ ...novoLancamento, categoria: e.target.value })} />
                  <datalist id="sugestoes"><option value="Alimentação"/><option value="Transporte"/><option value="CDB"/><option value="Ações"/></datalist>
                  {novoLancamento.tipo === 'investimento' && (
                    <input type="number" step="0.01" placeholder="Taxa (% a.m.)" className={`${inputClass} border-blue-200 text-blue-700`} value={novoLancamento.taxa_retorno} onChange={e => setNovoLancamento({ ...novoLancamento, taxa_retorno: e.target.value })} />
                  )}
                </div>

                <button className={`w-full mt-6 py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:opacity-90 transition ${corBotaoConfirmar}`}>
                  Confirmar {novoLancamento.tipo === 'receita' ? 'Entrada' : novoLancamento.tipo === 'investimento' ? 'Investimento' : 'Gasto'}
                </button>
              </form>
            </div>

            {/* ACOMPANHAMENTO DE METAS + FORMULÁRIO RÁPIDO RESTAURADO */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">🎯 Metas ({dataRef.toLocaleString('pt-BR', { month: 'long' })})</h2>
                  <span className="text-xs text-gray-400">Mensal</span>
                </div>
                
                {/* FORMULÁRIO RÁPIDO DE META (VOLTOU!) */}
                <div className="flex gap-2 mb-6 bg-gray-50 p-2 rounded-xl">
                  <input type="text" placeholder="Adicionar Meta (Ex: Ifood)" className="flex-1 p-2 bg-white border rounded-lg text-sm" value={novaMeta.categoria} onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})} />
                  <input type="number" placeholder="Limite R$" className="w-28 p-2 bg-white border rounded-lg text-sm" value={novaMeta.valor_limite} onChange={e => setNovaMeta({...novaMeta, valor_limite: e.target.value})} />
                  <button onClick={handleCriarMeta} className="bg-[#C5A028] text-white px-3 rounded-lg font-bold">+</button>
                </div>

                <div className="space-y-4">
                  {metas.length === 0 && <p className="text-center text-gray-400 text-sm">Nenhuma meta cadastrada.</p>}
                  {metas.map(meta => {
                     const gasto = transacoes.filter(t => t.tipo === 'despesa' && t.categoria?.toLowerCase() === meta.categoria.toLowerCase() && new Date(t.data_transacao).getMonth() === mesRef).reduce((acc, t) => acc + t.valor, 0);
                     const pct = Math.min(100, (gasto / meta.valor_limite) * 100);
                     return (
                       <div key={meta.id}>
                         <div className="flex justify-between text-sm mb-1 font-bold text-gray-600">
                            <span className="capitalize">{meta.categoria}</span>
                            <span className={pct >= 100 ? "text-red-500" : "text-gray-500"}>R$ {gasto} / {meta.valor_limite}</span>
                         </div>
                         <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }}></div></div>
                       </div>
                     )
                  })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm text-gray-800">
                <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">🍕 Gastos por Categoria</h3>
                <div className="h-64 text-xs">
                  {dadosDespesas.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={dadosDespesas} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dadosDespesas.map((entry, index) => <Cell key={`cell-${index}`} fill={CORES_DESPESAS[index % CORES_DESPESAS.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 mt-20">Sem despesas.</p>}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm text-gray-800">
                <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">💰 Distribuição de Investimentos</h3>
                <div className="h-64 text-xs">
                  {dadosInvestimentos.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={dadosInvestimentos} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dadosInvestimentos.map((entry, index) => <Cell key={`cell-${index}`} fill={CORES_INVEST[index % CORES_INVEST.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-gray-400 mt-20">Sem investimentos.</p>}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-800 text-gray-800">
                <h2 className="text-lg font-bold text-gray-800 mb-4">📝 Histórico</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {transacoes.map(t => {
                    const dataT = new Date(t.data_transacao);
                    const dia = dataT.getDate().toString().padStart(2, '0');
                    const mes = dataT.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                    return (
                      <div key={t.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border-b border-gray-100">
                        <div className="bg-white border border-gray-200 rounded flex flex-col items-center justify-center w-12 h-12 shadow-sm">
                          <span className="text-lg font-bold text-gray-800 leading-none">{dia}</span>
                          <span className="text-[10px] font-bold text-gray-500 leading-none mt-1">{mes}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-700 text-sm">{t.descricao}</p>
                          <p className="text-xs text-gray-400 capitalize">{t.categoria} {t.taxa_retorno > 0 && `• ${t.taxa_retorno}%`}</p>
                        </div>
                        <span className={`font-bold text-sm ${t.tipo === 'receita' ? 'text-green-600' : t.tipo === 'investimento' ? 'text-blue-600' : 'text-red-500'}`}>
                          {t.tipo === 'receita' ? '+' : '-'} R$ {t.valor.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
            </div>
          </>
        )}

        {/* --- ABA 2: DESPESAS FIXAS --- */}
        {abaAtiva === 'fixas' && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
             <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-xl font-bold text-gray-800">⚙️ Despesas Fixas</h2></div>
                <button onClick={lancarFixasNoMes} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-700">✅ Lançar no Mês</button>
             </div>
             <form onSubmit={handleSalvarFixa} className="flex gap-2 mb-6 bg-gray-50 p-3 rounded-xl border">
                <input type="text" placeholder="Ex: Aluguel" className="flex-1 p-3 bg-white border rounded" value={novaFixa.descricao} onChange={e => setNovaFixa({...novaFixa, descricao: e.target.value})} />
                <input type="number" placeholder="R$" className="w-24 p-3 bg-white border rounded" value={novaFixa.valor} onChange={e => setNovaFixa({...novaFixa, valor: e.target.value})} />
                <button className="bg-blue-600 text-white px-4 rounded font-bold">+</button>
             </form>
             <div className="space-y-2">
               {fixas.map(f => (
                 <div key={f.id} className="flex justify-between p-3 bg-gray-50 rounded border-l-4 border-gray-400">
                    <span className="font-bold">{f.descricao}</span>
                    <span className="font-bold text-gray-700">R$ {f.valor.toFixed(2)}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* --- ABA 3: METAS FIXAS (COM EXCLUSÃO) --- */}
        {abaAtiva === 'metas' && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
             <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">🎯 Gestão de Metas</h2>
                <p className="text-sm text-gray-500">Cadastre suas metas mensais aqui.</p>
             </div>
             
             {/* Formulário de Criar Meta */}
             <form onSubmit={handleCriarMeta} className="flex gap-2 mb-6 bg-gray-50 p-3 rounded-xl border">
                <input type="text" placeholder="Categoria (Ex: Mercado)" className="flex-1 p-3 bg-white border rounded" value={novaMeta.categoria} onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})} />
                <input type="number" placeholder="Limite R$" className="w-28 p-3 bg-white border rounded" value={novaMeta.valor_limite} onChange={e => setNovaMeta({...novaMeta, valor_limite: e.target.value})} />
                <button className="bg-blue-600 text-white px-4 rounded font-bold">Criar</button>
             </form>

             {/* Lista de Metas Ativas com botão de EXCLUIR 🗑️ */}
             <div className="space-y-2">
               {metas.length === 0 && <p className="text-gray-400 text-center">Nenhuma meta definida.</p>}
               {metas.map(m => (
                 <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border-l-4 border-blue-400">
                    <div>
                      <span className="font-bold block text-gray-800 capitalize">{m.categoria}</span>
                      <span className="text-xs text-gray-500">Limite Mensal</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-blue-600 text-lg">R$ {m.valor_limite}</span>
                      {/* BOTÃO DE EXCLUIR AQUI */}
                      <button onClick={() => handleExcluirMeta(m.id)} className="text-red-500 hover:text-red-700 p-2 font-bold text-xl transition-transform hover:scale-110" title="Excluir Meta">🗑️</button>
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
    <div className={`p-4 rounded-2xl shadow-lg border-l-4 ${bg} ${corBorda}`}>
      <p className={`text-[10px] font-bold uppercase ${bgDark ? 'text-yellow-100' : 'text-gray-400'}`}>{titulo}</p>
      <p className={`text-lg font-bold mt-1 ${txt}`}>R$ {valor.toFixed(2)}</p>
    </div>
  );
}