import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Button, Input } from '../components/ui';
import { formatCurrency } from '../utils/projection';
import { PiggyBank, Plus, TrendingUp, Target, X, Trash2 } from 'lucide-react';

export const Reserves: React.FC = () => {
  const { reserves, addReserve, updateReserve, deleteReserve, getAvailableBalance } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  
  // Deposit/Withdraw logic
  const [activeReserveId, setActiveReserveId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addReserve({
        name,
        target_amount: parseFloat(target) * 100,
        current_amount: 0,
        deadline
    });
    setName('');
    setTarget('');
    setDeadline('');
    setIsAdding(false);
  };

  const handleTransfer = (type: 'DEPOSIT' | 'WITHDRAW') => {
      if(!activeReserveId) return;
      const reserve = reserves.find(r => r.id === activeReserveId);
      if(!reserve) return;

      const val = parseFloat(transferAmount) * 100;
      if(isNaN(val) || val <= 0) return;

      let newAmount = reserve.current_amount;
      if(type === 'DEPOSIT') {
          newAmount += val;
      } else {
          if(val > reserve.current_amount) {
              alert("Saldo insuficiente na reserva.");
              return;
          }
          newAmount -= val;
      }

      updateReserve(activeReserveId, { current_amount: newAmount });
      setTransferAmount('');
      setActiveReserveId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservas & Metas</h1>
          <p className="text-zinc-400 text-sm">Separe dinheiro para objetivos específicos. O saldo disponível no Dashboard será ajustado.</p>
        </div>
        <div className="text-right bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
             <span className="text-xs text-zinc-500 uppercase block mb-1">Disponível para Gastar</span>
             <span className="text-xl font-bold text-emerald-500 font-mono">{formatCurrency(getAvailableBalance())}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {isAdding ? 'Cancelar' : 'Nova Meta'}
        </Button>
      </div>

      {isAdding && (
          <Card className="p-6 bg-zinc-900/50 border-emerald-500/30 animate-in slide-in-from-top-4 max-w-lg mx-auto w-full">
            <h3 className="text-lg font-bold mb-4">Criar Nova Reserva</h3>
            <form onSubmit={handleAdd} className="space-y-4">
                <Input placeholder="Nome da Meta (ex: Viagem)" value={name} onChange={e => setName(e.target.value)} required />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Valor Alvo</label>
                        <Input type="number" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Prazo</label>
                        <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required />
                    </div>
                </div>
                <Button type="submit" className="w-full">Criar Reserva</Button>
            </form>
          </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reserves.map(r => {
              const progress = Math.min(100, Math.round((r.current_amount / r.target_amount) * 100));
              const isInteracting = activeReserveId === r.id;

              return (
                <Card key={r.id} className="p-6 relative group overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold">{r.name}</h3>
                                <p className="text-xs text-zinc-500">Meta: {formatCurrency(r.target_amount)}</p>
                            </div>
                        </div>
                        <button onClick={() => deleteReserve(r.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="mb-2 flex justify-between items-end">
                        <span className="text-2xl font-bold font-mono">{formatCurrency(r.current_amount)}</span>
                        <span className="text-sm font-medium text-emerald-500">{progress}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-6">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>

                    {isInteracting ? (
                        <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-700 space-y-2 animate-in fade-in">
                            <Input 
                                type="number" 
                                autoFocus
                                placeholder="Valor" 
                                value={transferAmount} 
                                onChange={e => setTransferAmount(e.target.value)}
                                className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                                <Button variant="primary" onClick={() => handleTransfer('DEPOSIT')} className="flex-1 h-8 text-xs">Depositar</Button>
                                <Button variant="secondary" onClick={() => handleTransfer('WITHDRAW')} className="flex-1 h-8 text-xs">Sacar</Button>
                            </div>
                            <button onClick={() => setActiveReserveId(null)} className="text-xs text-zinc-500 w-full text-center hover:text-white">Cancelar</button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setActiveReserveId(r.id)} className="w-full">
                                <PiggyBank className="mr-2 h-4 w-4" />
                                Gerenciar Saldo
                            </Button>
                        </div>
                    )}
                </Card>
              );
          })}
      </div>
    </div>
  );
};