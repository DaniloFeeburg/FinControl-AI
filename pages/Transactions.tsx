import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Button, Input } from '../components/ui';
import { Plus, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, X, CreditCard, Check } from 'lucide-react';
import { formatCurrency } from '../utils/projection';
import { Transaction } from '../types';

export const Transactions: React.FC = () => {
  const { transactions, totalTransactions, categories, creditCards, recurringRules, addTransaction, updateTransaction, deleteTransaction, addRecurringRule, fetchTransactions } = useStore();
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  
  // Pagination State
  const [limit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  // Recurring Rule State
  const [createRecurring, setCreateRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState('5');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'INCOME') return t.amount > 0;
    return t.amount < 0;
  });

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Tem certeza que deseja excluir ${count} transação${count > 1 ? 'ões' : ''}?`)) {
      selectedIds.forEach(id => deleteTransaction(id));
      setSelectedIds(new Set());
    }
  };

  const isAllSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredTransactions.length;

  const resetForm = () => {
    setAmount('');
    setDesc('');
    setCatId('');
    setCreditCardId('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('EXPENSE');
    setEditingId(null);
    setIsFormOpen(false);
    setCreateRecurring(false);
    setRecurringDay('5');
    setRecurringEndDate('');
  };

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    const isExpense = t.amount < 0;
    setAmount((Math.abs(t.amount) / 100).toString());
    setDesc(t.description);
    setCatId(t.category_id);
    setCreditCardId(t.credit_card_id || '');
    setDate(t.date);
    setType(isExpense ? 'EXPENSE' : 'INCOME');

    // Recurring Logic
    if (t.recurring_rule_id) {
        setCreateRecurring(true);
        const rule = recurringRules.find(r => r.id === t.recurring_rule_id);
        if (rule) {
            const match = rule.rrule.match(/BYMONTHDAY=(\d+)/);
            if (match) {
                setRecurringDay(match[1]);
            }
            setRecurringEndDate(rule.end_date || '');
        }
    } else {
        setCreateRecurring(false);
        setRecurringDay('5');
        setRecurringEndDate('');
    }

    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteTransaction(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount) * 100; // Convert to cents
    const finalAmount = type === 'EXPENSE' ? -Math.abs(val) : Math.abs(val);

    const transactionData = {
      category_id: catId || categories[0]?.id,
      credit_card_id: creditCardId || null,
      amount: finalAmount,
      date: date || new Date().toISOString().split('T')[0],
      description: desc,
      status: (creditCardId ? 'PENDING' : 'PAID') as any, // CC transactions are pending until paid via invoice, usually
    };

    let savedTransactionId = editingId;

    if (editingId) {
      await updateTransaction(editingId, transactionData);
    } else {
      const newTxn = await addTransaction(transactionData);
      savedTransactionId = newTxn?.id || null;
    }

    // 🔥 NOVO: Criar regra recorrente se checkbox marcado (funciona para criar e editar)
    if (createRecurring && savedTransactionId) {
      const newRule = await addRecurringRule({
        category_id: catId || categories[0]?.id,
        credit_card_id: creditCardId || null,
        amount: finalAmount,
        description: desc,
        rrule: `FREQ=MONTHLY;BYMONTHDAY=${recurringDay}`,
        active: true,
        auto_create: false,
        end_date: recurringEndDate || null
      });

      if (newRule) {
          // Link transaction to the new rule
          await updateTransaction(savedTransactionId, { recurring_rule_id: newRule.id });
      }
    }
    
    resetForm();
    setCreateRecurring(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchTransactions(transactions.length, limit, true);
    setLoadingMore(false);
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

            {type === 'EXPENSE' && (
               <div>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md h-9 px-3 text-sm text-white focus:outline-none focus:border-zinc-700"
                    value={creditCardId}
                    onChange={e => setCreditCardId(e.target.value)}
                  >
                    <option value="">Sem Cartão de Crédito</option>
                    {creditCards.filter(cc => cc.active).map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.name} - {cc.brand}</option>
                    ))}
                  </select>
               </div>
            )}

            <Input 
              placeholder="Descrição (ex: Supermercado)" 
              value={desc} 
              onChange={e => setDesc(e.target.value)}
              required
            />

            <div className="border-t border-zinc-800 pt-4 space-y-3">
              {editingId && transactions.find(t => t.id === editingId)?.recurring_rule_id && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-xs text-emerald-400 font-medium flex items-center gap-2">
                          🔄 Esta transação já é recorrente.
                      </p>
                  </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createRecurring}
                  onChange={(e) => setCreateRecurring(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-purple-500"
                />
                <span className="text-sm text-zinc-300">
                  🔄 Tornar esta transação recorrente
                </span>
              </label>

              {createRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Repetir todo dia (1-31)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={recurringDay}
                      onChange={(e) => setRecurringDay(e.target.value)}
                      placeholder="Dia do mês"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">
                      Data Limite (Opcional)
                    </label>
                    <Input
                      type="date"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            
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

      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
          <span className="text-sm text-red-400 font-medium">
            {selectedIds.size} transação{selectedIds.size > 1 ? 'ões selecionadas' : ' selecionada'}
          </span>
          <Button 
            onClick={handleBulkDelete} 
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 size={14} className="mr-2" />
            Excluir {selectedIds.size > 1 ? 'Selecionadas' : 'Selecionada'}
          </Button>
        </div>
      )}

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center w-5 h-5 rounded border transition-colors hover:border-emerald-500"
                  disabled={filteredTransactions.length === 0}
                >
                  {isAllSelected ? (
                    <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  ) : isSomeSelected ? (
                    <div className="w-5 h-5 bg-emerald-500/50 rounded flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  ) : null}
                </button>
              </th>
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
              const isSelected = selectedIds.has(t.id);
              return (
                <tr key={t.id} className={`hover:bg-zinc-900/30 transition-colors ${isSelected ? 'bg-emerald-500/10' : ''}`}>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => toggleSelection(t.id)}
                      className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                        isSelected 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-zinc-600 hover:border-emerald-500'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200">
                    <div className="flex items-center gap-2">
                        {t.credit_card_id && <CreditCard size={14} className="text-zinc-500" />}
                        {t.description}
                    </div>
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

      {transactions.length < totalTransactions && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="ghost" 
            onClick={handleLoadMore} 
            disabled={loadingMore}
            className="text-zinc-400 hover:text-white border border-zinc-800"
          >
            {loadingMore ? 'Carregando...' : 'Carregar Mais'}
          </Button>
        </div>
      )}
    </div>
  );
};
