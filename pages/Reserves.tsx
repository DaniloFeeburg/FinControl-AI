import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Card, Button, Input } from '../components/ui';
import { formatCurrency, calculateMonthlySavingsNeeded } from '../utils/projection';
import { PiggyBank, Plus, Target, X, Trash2, Calculator, AlertTriangle, CheckCircle2, History, ArrowDown, ArrowUp } from 'lucide-react';
import { Reserve } from '../types';

export const Reserves: React.FC = () => {
  const { reserves, categories, recurringRules, addReserve, updateReserve, deleteReserve, getAvailableBalance, addRecurringRule, addReserveTransaction } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [createAutoRule, setCreateAutoRule] = useState(false);
  
  // Deposit/Withdraw & History State
  const [activeReserveId, setActiveReserveId] = useState<string | null>(null);
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');

  // Lógica de Cálculo de Impacto Financeiro
  const simulation = useMemo(() => {
    if (!target || !deadline) return null;
    const targetVal = parseFloat(target) * 100;
    if (isNaN(targetVal)) return null;

    const calc = calculateMonthlySavingsNeeded(targetVal, 0, deadline);
    
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    recurringRules.forEach(r => {
        if(r.active) {
            if(r.amount > 0) monthlyIncome += r.amount;
            else monthlyExpenses += Math.abs(r.amount);
        }
    });

    const currentFreeFlow = monthlyIncome - monthlyExpenses;
    const futureFreeFlow = currentFreeFlow - calc.monthlyAmount;

    return {
        ...calc,
        monthlyIncome,
        monthlyExpenses,
        currentFreeFlow,
        futureFreeFlow
    };
  }, [target, deadline, recurringRules]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseFloat(target) * 100;
    
    addReserve({
        name,
        target_amount: targetVal,
        current_amount: 0,
        deadline
    });

    if (createAutoRule && simulation && simulation.monthlyAmount > 0) {
        const expenseCategory = categories.find(c => c.name.toLowerCase().includes('reserva') || c.name.toLowerCase().includes('investimento')) 
                             || categories.find(c => c.type === 'EXPENSE');

        addRecurringRule({
            category_id: expenseCategory?.id || 'unknown',
            amount: -simulation.monthlyAmount,
            description: `Aporte: ${name}`,
            rrule: `FREQ=MONTHLY;BYMONTHDAY=${new Date().getDate()}`,
            active: true
        });
    }

    setName('');
    setTarget('');
    setDeadline('');
    setCreateAutoRule(false);
    setIsAdding(false);
  };

  const handleTransfer = (type: 'DEPOSIT' | 'WITHDRAW') => {
      if(!activeReserveId) return;
      const reserve = reserves.find(r => r.id === activeReserveId);
      if(!reserve) return;

      const val = parseFloat(transferAmount) * 100;
      if(isNaN(val) || val <= 0) return;

      if(type === 'WITHDRAW' && val > reserve.current_amount) {
          alert("Saldo insuficiente na reserva.");
          return;
      }

      // Utiliza a action que atualiza saldo e histórico
      addReserveTransaction(activeReserveId, val, type);

      setTransferAmount('');
      setActiveReserveId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservas & Metas</h1>
          <p className="text-zinc-400 text-sm">Gerencie seus objetivos de longo prazo e confirme seus aportes.</p>
        </div>
        <div className="text-right bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
             <span className="text-xs text-zinc-500 uppercase block mb-1">Disponível (Líquido)</span>
             <span className="text-xl font-bold text-emerald-500 font-mono">{formatCurrency(getAvailableBalance())}</span>
        </div>
      </div>

      <div className="flex justify-end">
        {!isAdding && (
            <Button onClick={() => setIsAdding(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova Meta
            </Button>
        )}
      </div>

      {/* MODAL: Nova Reserva */}
      {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => {if(e.target === e.currentTarget) setIsAdding(false)}}>
            <Card className="p-6 bg-zinc-900 border-zinc-800 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Target className="text-emerald-500" />
                        Planejador de Metas
                    </h3>
                    <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Nome do Objetivo</label>
                            <Input placeholder="Ex: Viagem de Férias, Carro Novo" value={name} onChange={e => setName(e.target.value)} required autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Valor Total</label>
                                <Input type="number" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)} required min="1" step="0.01" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Data Limite</label>
                                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required />
                            </div>
                        </div>

                        {simulation && simulation.monthlyAmount > 0 && (
                             <div className="pt-4 border-t border-zinc-800">
                                <label className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={createAutoRule} 
                                        onChange={e => setCreateAutoRule(e.target.checked)}
                                        className="mt-1 rounded border-zinc-700 bg-zinc-800"
                                    />
                                    <div>
                                        <span className="block text-sm font-medium text-white">Criar Regra Automática</span>
                                        <span className="block text-xs text-zinc-500">
                                            Adiciona despesa recorrente de <strong>{formatCurrency(simulation.monthlyAmount)}</strong> para projeção.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        )}

                        <Button type="submit" className="w-full mt-4">Criar Meta</Button>
                    </form>

                    <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 flex flex-col justify-center">
                        {!simulation ? (
                            <div className="text-center text-zinc-500">
                                <Calculator className="mx-auto mb-2 opacity-20" size={48} />
                                <p className="text-sm">Preencha o valor e a data para ver a análise.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Aporte Mensal Sugerido</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-bold text-emerald-400">{formatCurrency(simulation.monthlyAmount)}</span>
                                        <span className="text-sm text-zinc-400">/ mês</span>
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                        <CheckCircle2 size={12} className="text-emerald-500"/>
                                        {simulation.monthsRemaining} meses restantes
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-zinc-800">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-zinc-300">Impacto no Fluxo:</span>
                                        <span className={simulation.futureFreeFlow < 0 ? "text-red-500" : "text-emerald-400"}>
                                            {formatCurrency(simulation.futureFreeFlow)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500">Valor restante do seu orçamento mensal após este aporte.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
          </div>
      )}

      {/* MODAL: Histórico (Extrato) */}
      {viewHistoryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => {if(e.target === e.currentTarget) setViewHistoryId(null)}}>
            <Card className="p-6 bg-zinc-900 border-zinc-800 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white">Extrato da Reserva</h3>
                    <button onClick={() => setViewHistoryId(null)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                    {reserves.find(r => r.id === viewHistoryId)?.history.length === 0 ? (
                        <p className="text-center text-zinc-500 py-4 text-sm">Nenhuma movimentação registrada.</p>
                    ) : (
                        reserves.find(r => r.id === viewHistoryId)?.history.map(h => (
                            <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-full ${h.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {h.type === 'DEPOSIT' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">{h.type === 'DEPOSIT' ? 'Aporte Confirmado' : 'Retirada'}</p>
                                        <p className="text-xs text-zinc-500">{new Date(h.date).toLocaleDateString('pt-BR')} às {new Date(h.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                                <span className={`font-mono text-sm ${h.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {h.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(h.amount)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
      )}

      {/* Grid de Reservas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reserves.map(r => {
              const progress = Math.min(100, Math.round((r.current_amount / r.target_amount) * 100));
              const isInteracting = activeReserveId === r.id;
              const info = calculateMonthlySavingsNeeded(r.target_amount, r.current_amount, r.deadline);

              return (
                <Card key={r.id} className="p-6 relative group overflow-hidden flex flex-col justify-between border-t-4 border-t-zinc-800 hover:border-t-emerald-500 transition-all">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{r.name}</h3>
                                    <p className="text-xs text-zinc-500">Prazo: {new Date(r.deadline).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setViewHistoryId(r.id)} className="p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-emerald-400 rounded transition-colors" title="Ver Histórico">
                                    <History size={16} />
                                </button>
                                <button onClick={() => deleteReserve(r.id)} className="p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-red-400 rounded transition-colors" title="Excluir Meta">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="mb-2 flex justify-between items-end">
                            <span className="text-2xl font-bold font-mono">{formatCurrency(r.current_amount)}</span>
                            <div className="text-right">
                                <span className="text-xs text-zinc-500 block">Meta: {formatCurrency(r.target_amount)}</span>
                                <span className="text-sm font-medium text-emerald-500">{progress}%</span>
                            </div>
                        </div>

                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-4">
                            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>

                        {progress < 100 && (
                            <div className="mb-4 bg-zinc-900/50 p-2 rounded text-xs text-zinc-400 border border-zinc-800/50 flex items-center gap-2">
                                <AlertTriangle size={12} className={info.isLate ? "text-red-500" : "text-emerald-500"}/>
                                {info.isLate ? (
                                    <span>Prazo curto! Aumente aportes.</span>
                                ) : (
                                    <span>Sugestão: <span className="text-emerald-400 font-bold">{formatCurrency(info.monthlyAmount)}</span>/mês.</span>
                                )}
                            </div>
                        )}
                    </div>

                    {isInteracting ? (
                        <div className="bg-zinc-900/90 p-3 rounded-lg border border-zinc-700 space-y-2 animate-in fade-in relative z-10">
                            <p className="text-xs font-semibold text-zinc-400 uppercase text-center mb-1">Confirmar Movimentação</p>
                            <Input 
                                type="number" 
                                autoFocus
                                placeholder="Valor" 
                                value={transferAmount} 
                                onChange={e => setTransferAmount(e.target.value)}
                                className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                                <Button variant="primary" onClick={() => handleTransfer('DEPOSIT')} className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                                    Depositar
                                </Button>
                                <Button variant="danger" onClick={() => handleTransfer('WITHDRAW')} className="flex-1 h-8 text-xs">
                                    Sacar
                                </Button>
                            </div>
                            <button onClick={() => setActiveReserveId(null)} className="text-xs text-zinc-500 w-full text-center hover:text-white mt-1">Cancelar</button>
                        </div>
                    ) : (
                        <Button variant="secondary" onClick={() => setActiveReserveId(r.id)} className="w-full border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-800">
                            <PiggyBank className="mr-2 h-4 w-4" />
                            Gerenciar Saldo
                        </Button>
                    )}
                </Card>
              );
          })}
      </div>
    </div>
  );
};