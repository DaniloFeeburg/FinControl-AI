import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Button, Input } from '../components/ui';
import { Plus, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../utils/projection';
import { Transaction } from '../types';

export const Transactions: React.FC = () => {
  const { transactions, categories, addTransaction, updateTransaction, deleteTransaction } = useStore();
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'INCOME') return t.amount > 0;
    return t.amount < 0;
  });

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const resetForm = () => {
    setAmount('');
    setDesc('');
    setCatId('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('EXPENSE');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    const isExpense = t.amount < 0;
    setAmount((Math.abs(t.amount) / 100).toString());
    setDesc(t.description);
    setCatId(t.category_id);
    setDate(t.date);
    setType(isExpense ? 'EXPENSE' : 'INCOME');
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteTransaction(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount) * 100; // Convert to cents
    const finalAmount = type === 'EXPENSE' ? -Math.abs(val) : Math.abs(val);

    const transactionData = {
      category_id: catId || categories[0]?.id,
      amount: finalAmount,
      date: date || new Date().toISOString().split('T')[0],
      description: desc,
      status: 'PAID' as const,
    };

    if (editingId) {
      updateTransaction(editingId, transactionData);
    } else {
      addTransaction(transactionData);
    }
    
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transações</h1>
        <Button onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }}>
          {isFormOpen ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {isFormOpen ? 'Cancelar' : 'Nova Transação'}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="p-6 bg-zinc-900/50 border-emerald-500/30 animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 text-white">{editingId ? 'Editar Transação' : 'Nova Transação'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setType('EXPENSE')}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${type === 'EXPENSE' ? 'bg-red-500/20 text-red-500' : 'text-zinc-400'}`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setType('INCOME')}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${type === 'INCOME' ? 'bg-emerald-500/20 text-emerald-500' : 'text-zinc-400'}`}
                >
                  Receita
                </button>
              </div>
              <Input 
                type="number" 
                placeholder="0,00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                step="0.01"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Input 
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                />
                <select 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md h-9 px-3 text-sm text-white focus:outline-none focus:border-zinc-700"
                value={catId}
                onChange={e => setCatId(e.target.value)}
                required
                >
                <option value="" disabled>Selecione a Categoria</option>
                {categories.filter(c => c.type === type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                </select>
            </div>
            <Input 
              placeholder="Descrição (ex: Supermercado)" 
              value={desc} 
              onChange={e => setDesc(e.target.value)}
              required
            />
            
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Atualizar' : 'Salvar'}</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex gap-2 pb-2 border-b border-zinc-800">
        {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              filter === f 
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f === 'ALL' ? 'Todas' : f === 'INCOME' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
            {filteredTransactions.map(t => {
              const cat = getCategory(t.category_id);
              const isExpense = t.amount < 0;
              return (
                <tr key={t.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-4 text-sm text-zinc-400 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200">
                    {t.description}
                  </td>
                  <td className="px-4 py-4">
                    {cat && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                        {cat.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className={`flex items-center justify-end gap-1 ${isExpense ? 'text-zinc-200' : 'text-emerald-400'}`}>
                      {isExpense ? <ArrowDownLeft size={14} className="text-zinc-500" /> : <ArrowUpRight size={14} />}
                      <span className="font-mono">{formatCurrency(Math.abs(t.amount))}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(t)} className="text-zinc-500 hover:text-zinc-200"><Pencil size={14}/></button>
                          <button onClick={() => handleDelete(t.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={14}/></button>
                      </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredTransactions.length === 0 && (
          <div className="p-8 text-center text-zinc-500">
            Nenhuma transação encontrada.
          </div>
        )}
      </div>
    </div>
  );
};