import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const limparTexto = (texto) => {
  if (!texto) return '';
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

export default function Dashboard({ session }) {
  const user = session.user;
  const [loading, setLoading] = useState(true);

  // --- DADOS ---
  const [transacoes, setTransacoes] = useState([]);
  const [metas, setMetas] = useState([]);             
  const [metasFixas, setMetasFixas] = useState([]);   
  const [fixas, setFixas] = useState([]);             
  const [receitasFixas, setReceitasFixas] = useState([]); 

  // --- UI ---
  const [abaAtiva, setAbaAtiva] = useState('lancamentos');
  const [tipoLancamento, setTipoLancamento] = useState('despesa'); // receita, despesa, investimento, resgate

  // --- INPUTS ---
  const [novoLancamento, setNovoLancamento] = useState({ descricao: '', valor: '', categoria: '' });
  
  // Inputs Fixos
  const [novaFixa, setNovaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaReceitaFixa, setNovaReceitaFixa] = useState({ descricao: '', valor: '', categoria: '' });
  const [novaMetaFixa, setNovaMetaFixa] = useState({ categoria: '', valor_limite: '' }); 
  const [novaMetaManual, setNovaMetaManual] = useState({ categoria: '', valor_limite: '' }); 

  // Datas
  const hoje = new Date().toISOString().split('T')[0];
  const [dataConsulta, setDataConsulta] = useState(hoje);
  const dataRef = new Date(dataConsulta);
  const mesRef = dataRef.getMonth();
  const anoRef = dataRef.getFullYear();

  useEffect(() => { 
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setLoading(true);
    await Promise.all([fetchTransacoes(), fetchMetas(), fetchFixas(), fetchReceitasFixas(), fetchMetasFixas()]);
    setLoading(false);
  }

  // --- BUSCAS (Refatoradas para garantir atualização) ---
  async function fetchTransacoes() {
    const { data } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false }).limit(2000);
    if (data) setTransacoes(data);
  }
  async function fetchMetas() { const { data } = await supabase.from('metas').select('*'); if (data) setMetas(data); }
  async function fetchFixas() { const { data } = await supabase.from('despesas_fixas').select('*'); if (data) setFixas(data); }
  async function fetchReceitasFixas() { const { data } = await supabase.from('receitas_fixas').select('*'); if (data) setReceitasFixas(data); }
  async function fetchMetasFixas() { const { data } = await supabase.from('metas_fixas').select('*'); if (data) setMetasFixas(data); }

  // --- NOVO LANÇAMENTO (COM RESGATE) ---
  async function handleSalvarLancamento(e) {
    e.preventDefault();
    if (!novoLancamento.descricao || !novoLancamento.valor) return alert("Preencha tudo!");
    
    const valorFloat = parseFloat(novoLancamento.valor);
    let categoriaFinal = novoLancamento.categoria;

    // Ajustes automáticos de categoria
    if (tipoLancamento === 'resgate') categoriaFinal = 'Resgate Investimento';
    if (!categoriaFinal) categoriaFinal = 'Geral';

    const { error } = await supabase.from('transacoes').insert({
      user_id: user.id,
      descricao: novoLancamento.descricao,
      valor: valorFloat,
      tipo: tipoLancamento, // 'receita', 'despesa', 'investimento', 'resgate'
      categoria: categoriaFinal,
      data_transacao: new Date().toISOString()
    });

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        setNovoLancamento({ descricao: '', valor: '', categoria: '' });
        fetchTransacoes();
    }
  }

  // --- FUNÇÕES DE CADASTRO FIXO (Com verificação de erro) ---
  async function handleSalvarFixa(e) {
      e.preventDefault();
      if(!novaFixa.descricao) return;
      const { error } = await supabase.from('despesas_fixas').insert({ user_id: user.id, descricao: novaFixa.descricao, valor: parseFloat(novaFixa.valor), categoria: novaFixa.categoria || 'Fixa' });
      if(!error) { setNovaFixa({descricao:'', valor:'', categoria:''}); fetchFixas(); }
  }
  async function handleSalvarReceitaFixa(e) {
      e.preventDefault();
      if(!novaReceitaFixa.descricao) return;
      const { error } = await supabase.from('receitas_fixas').insert({ user_id: user.id, descricao: novaReceitaFixa.descricao, valor: parseFloat(novaReceitaFixa.valor), categoria: novaReceitaFixa.categoria || 'Salário' });
      if(!error) { setNovaReceitaFixa({descricao:'', valor:'', categoria:''}); fetchReceitasFixas(); }
  }
  async function handleSalvarMetaFixa(e) {
      e.preventDefault();
      if(!novaMetaFixa.categoria) return;
      const { error } = await supabase.from('metas_fixas').insert({ user_id: user.id, categoria: novaMetaFixa.categoria, valor_limite: parseFloat(novaMetaFixa.valor_limite) });
      if(!error) { setNovaMetaFixa({ categoria: '', valor_limite: '' }); fetchMetasFixas(); }
  }
  async function handleCriarMetaManual(e) {
      e.preventDefault();
      if(!novaMetaManual.categoria) return;
      await supabase.from('metas').insert({ user_id: user.id, categoria: novaMetaManual.categoria, valor_limite: parseFloat(novaMetaManual.valor_limite) });
      setNovaMetaManual({ categoria: '', valor_limite: '' }); fetchMetas();
  }

  // --- LANÇAMENTOS EM MASSA ---
  async function lancarMassa(lista, tipoTransacao, tabelaDestino) {
      if (!confirm(`Lançar todos (${lista.length} itens)?`)) return;
      const novas = lista.map(item => ({
          user_id: user.id,
          descricao: item.descricao || item.categoria, // Metas usam categoria como desc
          valor: item.valor || item.valor_limite,      // Metas usam valor_limite
          tipo: tipoTransacao,
          categoria: item.categoria,
          valor_limite: item.valor_limite, // Apenas para metas
          data_transacao: new Date().toISOString()
      }));
      
      // Se for meta, insere na tabela 'metas', senão em 'transacoes'
      const tabela = tabelaDestino === 'metas' ? 'metas' : 'transacoes';
      
      // Para metas, precisamos limpar campos que não existem na tabela metas (tipo, descricao, data_transacao, valor)
      // Ajuste fino para inserção correta
      let payload = novas;
      if (tabela === 'metas') {
          payload = lista.map(m => ({ user_id: user.id, categoria: m.categoria, valor_limite: m.valor_limite }));
      } else {
          payload = novas.map(({ valor_limite, ...resto }) => resto); // Remove valor_limite para transacoes
      }

      await supabase.from(tabela).insert(payload);
      tabela === 'metas' ? fetchMetas() : fetchTransacoes();
  }

  // --- LANÇAMENTO INDIVIDUAL (NOVIDADE) ---
  async function lancarIndividual(item, tipo, tabelaDestino) {
      const nome = item.descricao || item.categoria;
      if (!confirm(`Lançar apenas "${nome}" neste mês?`)) return;

      if (tabelaDestino === 'metas') {
          await supabase.from('metas').insert({ user_id: user.id, categoria: item.categoria, valor_limite: item.valor_limite });
          fetchMetas();
      } else {
          await supabase.from('transacoes').insert({
              user_id: user.id,
              descricao: item.descricao,
              valor: item.valor,
              tipo: tipo,
              categoria: item.categoria,
              data_transacao: new Date().toISOString()
          });
          fetchTransacoes();
      }
  }

  // --- EXCLUSÃO ---
  async function handleExcluir(id, table) {
      if(confirm("Excluir item?")) {
          await supabase.from(table).delete().eq('id', id);
          if(table === 'transacoes') fetchTransacoes();
          if(table === 'metas') fetchMetas();
          if(table === 'despesas_fixas') fetchFixas();
          if(table === 'receitas_fixas') fetchReceitasFixas();
          if(table === 'metas_fixas') fetchMetasFixas();
      }
  }

  // --- CÁLCULOS FINANCEIROS ATUALIZADOS ---
  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
  
  // INVESTIMENTO:
  // Aporte (tipo='investimento'): Sai do saldo, soma no investido.
  // Resgate (tipo='resgate'): Soma no saldo, sai do investido.
  const aportes = transacoes.filter(t => t.tipo === 'investimento').reduce((acc, t) => acc + t.valor, 0);
  const resgates = transacoes.filter(t => t.tipo === 'resgate').reduce((acc, t) => acc + t.valor, 0);

  // FÓRMULAS FINAIS:
  // Saldo Disponível = (Receitas + Resgates) - (Despesas + Aportes)
  const saldoConta = (receitas + resgates) - (despesas + aportes);
  
  // Total Investido = Aportes - Resgates (Lógica Simples de Fluxo)
  const totalInvestido = Math.max(0, aportes - resgates);

  // Previsão
  const somaMetasRestantes = metas.reduce((acc, meta) => {
      const gastoNaCategoria = transacoes.filter(t => {
            const d = new Date(t.data_transacao);
            return t.tipo === 'despesa' && d.getMonth() === mesRef && limparTexto(t.categoria) === limparTexto(meta.categoria);
      }).reduce((sum, t) => sum + t.valor, 0);
      return acc + Math.max(0, meta.valor_limite - gastoNaCategoria);
  }, 0);

  const previsaoCaixa = saldoConta - somaMetasRestantes;

  // Gráficos
  const dadosDespesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.categoria);
      if (found) found.value += curr.valor; else acc.push({ name: curr.categoria, value: curr.valor }); return acc;
  }, []);
  const dadosInvestimentos = [{name: 'Aportes', value: aportes}, {name: 'Resgates', value: resgates}];
  const dadosPatrimonio = [{ name: 'Em Conta', value: saldoConta > 0 ? saldoConta : 0 }, { name: 'Investido', value: totalInvestido }];

  const CORES_DESPESAS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
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
          <CardResumo titulo="Gasto Mês" valor={despesas} cor="red" />
          <CardResumo titulo="Total Investido" valor={totalInvestido} cor="blue" />
          <CardResumo titulo="Patrimônio" valor={saldoConta + totalInvestido} cor="gold" bgDark />
        </div>
      </div>

      <div className="px-3 max-w-5xl mx-auto space-y-5 pt-14">
        
        {/* PREVISÃO */}
        <div className="bg-neutral-800 p-4 rounded-2xl shadow-lg border border-neutral-700">
            <h3 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">🔮 Previsão de Caixa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-700">
                    <p className="text-[10px] text-gray-500 uppercase">Falta Gastar (Metas)</p>
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

        {/* --- ABA 1: DIÁRIO --- */}
        {abaAtiva === 'lancamentos' && (
          <div className="space-y-6">
            
            {/* FORMULÁRIO PRINCIPAL */}
            <div className={`bg-white p-4 rounded-2xl shadow border-t-4 text-gray-800 border-${tipoLancamento === 'receita' ? 'green' : tipoLancamento === 'investimento' ? 'blue' : tipoLancamento === 'resgate' ? 'yellow' : 'red'}-500`}>
              <h2 className="text-sm md:text-lg font-bold text-gray-800 mb-3">🚀 Novo Lançamento</h2>
              
              {/* Seletor de Tipo */}
              <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={() => setTipoLancamento('receita')} className={`flex-1 py-2 text-xs font-bold rounded border ${tipoLancamento === 'receita' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>Receita</button>
                  <button onClick={() => setTipoLancamento('despesa')} className={`flex-1 py-2 text-xs font-bold rounded border ${tipoLancamento === 'despesa' ? 'bg-red-600 text-white' : 'text-gray-600'}`}>Despesa</button>
                  <button onClick={() => setTipoLancamento('investimento')} className={`flex-1 py-2 text-xs font-bold rounded border ${tipoLancamento === 'investimento' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Aporte</button>
                  <button onClick={() => setTipoLancamento('resgate')} className={`flex-1 py-2 text-xs font-bold rounded border ${tipoLancamento === 'resgate' ? 'bg-yellow-500 text-white' : 'text-gray-600'}`}>Resgate</button>
              </div>

              <form onSubmit={handleSalvarLancamento}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" placeholder="Descrição" className={inputClass} value={novoLancamento.descricao} onChange={e => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })} />
                    <input type="number" placeholder="Valor" className={inputClass} value={novoLancamento.valor} onChange={e => setNovoLancamento({ ...novoLancamento, valor: e.target.value })} />
                    {tipoLancamento !== 'resgate' && (
                        <>
                        <input type="text" list="sugestoes" placeholder="Categoria" className={inputClass} value={novoLancamento.categoria} onChange={e => setNovoLancamento({ ...novoLancamento, categoria: e.target.value })} />
                        <datalist id="sugestoes"><option value="Alimentação"/><option value="Transporte"/><option value="Lazer"/><option value="Casa"/></datalist>
                        </>
                    )}
                </div>
                <button className="w-full mt-3 bg-neutral-800 text-white py-3 rounded-lg font-bold hover:bg-neutral-700 text-sm">LANÇAR</button>
              </form>
            </div>

            {/* SEÇÃO METAS DO MÊS (NA ABA DIÁRIA) */}
            <div className="bg-white p-4 rounded-2xl shadow border-gray-200 text-gray-800">
                <h2 className="text-lg font-bold mb-3">🎯 Metas do Mês</h2>
                <form onSubmit={handleCriarMetaManual} className="flex gap-2 mb-4 bg-gray-50 p-2 rounded-lg">
                    <input type="text" placeholder="Nova Meta" className="flex-1 p-2 text-sm border rounded" value={novaMetaManual.categoria} onChange={e => setNovaMetaManual({...novaMetaManual, categoria: e.target.value})} />
                    <input type="number" placeholder="Limite" className="w-24 p-2 text-sm border rounded" value={novaMetaManual.valor_limite} onChange={e => setNovaMetaManual({...novaMetaManual, valor_limite: e.target.value})} />
                    <button className="bg-blue-600 text-white px-3 rounded font-bold text-xs">+</button>
                </form>
                <div className="space-y-4">
                    {metas.map(meta => {
                        const gastoNaCategoria = transacoes.filter(t => t.tipo === 'despesa' && (new Date(t.data_transacao)).getMonth() === mesRef && limparTexto(t.categoria) === limparTexto(meta.categoria)).reduce((acc, t) => acc + t.valor, 0);
                        const pct = Math.min(100, (gastoNaCategoria / meta.valor_limite) * 100);
                        return (
                            <div key={meta.id}>
                                <div className="flex justify-between text-sm mb-1"><span className="font-bold">{meta.categoria}</span><span className="text-xs text-gray-500">R$ {gastoNaCategoria.toFixed(0)} / {meta.valor_limite} <button onClick={() => handleExcluir(meta.id, 'metas')} className="ml-2 text-red-500">✕</button></span></div>
                                <div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }}></div></div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* GRÁFICOS RESTAURADOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GraficoCard titulo="Patrimônio" dados={dadosPatrimonio} cores={['#10B981', '#3B82F6']} corBorda="gold" />
                <GraficoCard titulo="Gastos" dados={dadosDespesas} cores={CORES_DESPESAS} corBorda="red" />
            </div>
            
            {/* HISTÓRICO */}
            <div className="bg-white rounded-xl shadow p-4 text-gray-800">
                <h3 className="font-bold text-sm mb-3">Últimas Movimentações</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {transacoes.map(t => (
                        <div key={t.id} className="flex justify-between items-center border-b py-2 text-sm last:border-0">
                            <div><p className="font-bold">{t.descricao}</p><p className="text-[10px] text-gray-500">{t.tipo.toUpperCase()} • {t.categoria}</p></div>
                            <div className="text-right">
                                <p className={`font-bold ${t.tipo === 'receita' || t.tipo === 'resgate' ? 'text-green-600' : 'text-red-500'}`}>{t.tipo === 'receita' || t.tipo === 'resgate' ? '+' : '-'} {t.valor}</p>
                                <button onClick={() => handleExcluir(t.id, 'transacoes')} className="text-[10px] text-red-400">Excluir</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* --- ABA 2: RECEITAS FIXAS --- */}
        {abaAtiva === 'receitas' && (
            <div className="bg-white p-4 rounded-2xl text-gray-800 shadow">
                <div className="flex flex-col gap-3 mb-4 border-b pb-4">
                    <h2 className="text-lg font-bold text-green-700">💰 Receitas Fixas</h2>
                    <button onClick={() => lancarMassa(receitasFixas, 'receita', 'transacoes')} className="bg-green-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ LANÇAR TODAS NO MÊS</button>
                </div>
                <form onSubmit={handleSalvarReceitaFixa} className="flex flex-col md:flex-row gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                    <input className={`${inputClass} bg-white`} placeholder="Ex: Salário" value={novaReceitaFixa.descricao} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, descricao: e.target.value})} />
                    <input className={`${inputClass} md:w-32 bg-white`} type="number" placeholder="R$" value={novaReceitaFixa.valor} onChange={e => setNovaReceitaFixa({...novaReceitaFixa, valor: e.target.value})} />
                    <button className="bg-green-600 text-white py-2 px-4 rounded-lg font-bold text-sm">Add</button>
                </form>
                <div className="space-y-2">
                    {receitasFixas.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                            <span className="font-bold text-sm">{r.descricao}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-700">R$ {r.valor}</span>
                                <button onClick={() => lancarIndividual(r, 'receita', 'transacoes')} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200" title="Lançar só este">▶️</button>
                                <button onClick={() => handleExcluir(r.id, 'receitas_fixas')} className="text-red-400 text-xs ml-2">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ABA 3: DESPESAS FIXAS --- */}
        {abaAtiva === 'fixas' && (
            <div className="bg-white p-4 rounded-2xl text-gray-800 shadow">
                <div className="flex flex-col gap-3 mb-4 border-b pb-4">
                    <h2 className="text-lg font-bold text-red-700">⚙️ Despesas Fixas</h2>
                    <button onClick={() => lancarMassa(fixas, 'despesa', 'transacoes')} className="bg-red-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ LANÇAR TODAS NO MÊS</button>
                </div>
                <form onSubmit={handleSalvarFixa} className="flex flex-col md:flex-row gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                    <input className={`${inputClass} bg-white`} placeholder="Ex: Aluguel" value={novaFixa.descricao} onChange={e => setNovaFixa({...novaFixa, descricao: e.target.value})} />
                    <input className={`${inputClass} md:w-32 bg-white`} type="number" placeholder="R$" value={novaFixa.valor} onChange={e => setNovaFixa({...novaFixa, valor: e.target.value})} />
                    <button className="bg-red-600 text-white py-2 px-4 rounded-lg font-bold text-sm">Add</button>
                </form>
                <div className="space-y-2">
                    {fixas.map(f => (
                        <div key={f.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                            <span className="font-bold text-sm">{f.descricao}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-red-700">R$ {f.valor}</span>
                                <button onClick={() => lancarIndividual(f, 'despesa', 'transacoes')} className="bg-red-100 text-red-700 p-1 rounded hover:bg-red-200" title="Lançar só este">▶️</button>
                                <button onClick={() => handleExcluir(f.id, 'despesas_fixas')} className="text-red-400 text-xs ml-2">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ABA 4: METAS FIXAS (MODELOS) --- */}
        {abaAtiva === 'metas' && (
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <div className="flex flex-col gap-3 mb-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h2 className="text-sm font-bold text-blue-800 uppercase">📁 Modelos de Metas (Fixas)</h2>
                    <button onClick={() => lancarMassa(metasFixas, null, 'metas')} className="bg-blue-600 text-white w-full py-3 rounded-lg font-bold text-sm shadow">⬇ IMPORTAR TODAS PARA O MÊS</button>
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
                             <div className="flex gap-2">
                                 <span className="font-bold text-blue-600">R$ {mf.valor_limite}</span>
                                 <button onClick={() => lancarIndividual(mf, null, 'metas')} className="bg-blue-100 text-blue-700 p-1 rounded hover:bg-blue-200" title="Importar só esta">▶️</button>
                                 <button onClick={() => handleExcluir(mf.id, 'metas_fixas')} className="text-red-400 ml-2">🗑️</button>
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
