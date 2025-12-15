import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { CreditCard, Transaction } from '../types';
import { Plus, CreditCard as CreditCardIcon, Trash2, Edit2, Calendar, TrendingUp, AlertCircle, X, Check, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function CreditCards() {
  const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard, user, categories } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showProjection, setShowProjection] = useState(false);
  const [projectionData, setProjectionData] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<CreditCard>>({
    name: '',
    brand: 'Visa',
    credit_limit: 0,
    due_day: 10,
    closing_day: 5,
    color: '#10B981',
    active: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Statement State
  const [selectedStatementMonth, setSelectedStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statementData, setStatementData] = useState<{
    period: {start: string, end: string},
    transactions: Transaction[],
    total: number,
    status: string,
    due_date: string
  } | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [paying, setPaying] = useState(false);

  // Select first card by default if none selected
  useEffect(() => {
    if (!selectedCardId && creditCards.length > 0) {
      setSelectedCardId(creditCards[0].id);
    } else if (creditCards.length === 0) {
        setSelectedCardId(null);
        setStatementData(null);
    }
  }, [creditCards, selectedCardId]);

  // Fetch statement when card or month changes
  useEffect(() => {
    if (selectedCardId && selectedStatementMonth) {
      fetchStatement(selectedCardId, selectedStatementMonth);
      if (showProjection) {
          fetchProjection(selectedCardId);
      }
    }
  }, [selectedCardId, selectedStatementMonth, showProjection]);

  const fetchProjection = async (cardId: string) => {
      try {
          const API_URL = import.meta.env.VITE_API_URL || '/api';
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/credit_cards/${cardId}/projection`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
              const data = await response.json();
              setProjectionData(data);
          }
      } catch (error) {
          console.error("Failed to fetch projection", error);
      }
  };

  const fetchStatement = async (cardId: string, month: string) => {
    setLoadingStatement(true);
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_URL}/credit_cards/${cardId}/statement?month=${month}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatementData(data);
      } else {
        console.error("Failed to fetch statement");
        setStatementData(null);
      }
    } catch (error) {
      console.error(error);
      setStatementData(null);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!selectedCardId || !statementData) return;
    if (!window.confirm('Deseja marcar todas as transações desta fatura como pagas? Isso liberará o limite do cartão.')) return;

    setPaying(true);
    try {
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/credit_cards/${selectedCardId}/pay_invoice?month=${selectedStatementMonth}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Refresh statement and cards (limit info)
            await fetchStatement(selectedCardId, selectedStatementMonth);
            // We should also refresh transactions/cards in store to update limits in UI
            // Assuming we have a way to refresh store data. `fetchAllData`?
            useStore.getState().fetchAllData();
            alert('Fatura paga com sucesso!');
        } else {
            alert('Erro ao pagar fatura.');
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao pagar fatura.');
    } finally {
        setPaying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && editId) {
      await updateCreditCard(editId, formData);
    } else {
      await addCreditCard(formData as Omit<CreditCard, 'id'>);
    }
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: 'Visa',
      credit_limit: 0,
      due_day: 10,
      closing_day: 5,
      color: '#10B981',
      active: true
    });
    setIsEditing(false);
    setEditId(null);
  };

  const handleEdit = (card: CreditCard) => {
    setFormData(card);
    setEditId(card.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cartão?')) {
      await deleteCreditCard(id);
      if (selectedCardId === id) setSelectedCardId(null);
    }
  };

  const getBrandIcon = (brand: string) => {
    return <CreditCardIcon className="w-5 h-5" />;
  };

  const getCategoryName = (catId: string) => {
      return categories.find(c => c.id === catId)?.name || 'Sem Categoria';
  };

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val / 100); // Fixed scaling here?
    // Wait, projection.ts `formatCurrency` divides by 100.
    // My previous implementation used `new Intl.NumberFormat(...).format(val)`.
    // If I use `val / 100`, I am manually doing what `projection.ts` might do.
    // Let's assume input `val` is CENTS.
    // Standard JS Intl.NumberFormat expects REAL value.
    // So if val is 3280, I should pass 32.80.
    // So yes, `val / 100` is correct.
  };

  const availableLimit = (card: CreditCard) => {
      const { transactions } = useStore.getState();

      const usedLimitCents = transactions
        .filter(t => t.credit_card_id === card.id && t.status === 'PENDING')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Limit is stored as Real (e.g., 5000). Used Limit is Cents.
      // Convert Limit to Cents for calculation, then return Cents?
      // Or return Real?
      // formatCurrency expects Cents (and divides by 100).
      // So let's return Cents.

      const limitCents = card.credit_limit * 100;
      return limitCents - usedLimitCents;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-2">
          <CreditCardIcon className="w-8 h-8 text-emerald-500" />
          Cartões de Crédito
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Cartão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of Cards */}
        <div className="space-y-4">
          {creditCards.map(card => {
             // Calculate Limit Usage for Progress Bar
             // All in Cents now
             const limitCents = card.credit_limit * 100;
             const availableCents = availableLimit(card);
             const usedCents = limitCents - availableCents;
             const progress = Math.min((usedCents / limitCents) * 100, 100);

             return (
              <div
                key={card.id}
                onClick={() => { setSelectedCardId(card.id); setShowProjection(false); }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedCardId === card.id ? 'border-emerald-500 bg-zinc-800/80' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'}`}
              >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{backgroundColor: card.color}}>
                            {card.brand.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">{card.name}</h3>
                            <p className="text-xs text-zinc-400">{card.brand}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={(e) => { e.stopPropagation(); handleEdit(card); }} className="p-1 hover:text-emerald-400 text-zinc-400"><Edit2 className="w-4 h-4"/></button>
                         <button onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }} className="p-1 hover:text-red-400 text-zinc-400"><Trash2 className="w-4 h-4"/></button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Limite Utilizado</span>
                        <span className="text-white font-medium">{formatCurrency(usedCents)}</span>
                    </div>
                    <div className="w-full bg-zinc-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all" style={{width: `${progress}%`}}></div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                        <span>Disponível: {formatCurrency(availableCents)}</span>
                        <span>Total: {formatCurrency(limitCents)}</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Vence dia {card.due_day}</span>
                    <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Fecha dia {card.closing_day}</span>
                </div>
              </div>
             );
          })}
        </div>

        {/* Right Column: Statement Detail */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Fatura</h2>
                    <input
                        type="month"
                        value={selectedStatementMonth}
                        onChange={(e) => setSelectedStatementMonth(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                    />
                </div>

                {selectedCardId && statementData ? (
                    <>
                         <div className="flex justify-end mb-4">
                            <button
                                onClick={() => setShowProjection(!showProjection)}
                                className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                                <BarChart3 className="w-4 h-4" />
                                {showProjection ? 'Ver Fatura Atual' : 'Ver Projeção Futura'}
                            </button>
                        </div>

                        {showProjection ? (
                            <div className="bg-zinc-900/50 p-6 rounded-lg mb-6">
                                <h3 className="text-lg font-bold text-white mb-4">Projeção de Faturas (Próximos 12 Meses)</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={projectionData}>
                                            <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                                            <YAxis stroke="#71717a" fontSize={12} tickFormatter={(val) => `R$ ${val/100}`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
                                                formatter={(val: number) => [`R$ ${(val/100).toFixed(2)}`, 'Total']}
                                            />
                                            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                                {projectionData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.total < 0 ? '#ef4444' : '#10b981'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                             <div className="bg-zinc-900/50 p-4 rounded-lg">
                                 <span className="text-sm text-zinc-400 block mb-1">Total da Fatura</span>
                                 <span className="text-2xl font-bold text-white">{formatCurrency(statementData.total)}</span>
                                 <div className="flex gap-2 text-xs mt-2">
                                     <span className="text-red-400">Compras: {formatCurrency(statementData.transactions.filter(t => t.amount < 0).reduce((a,b) => a+b.amount, 0))}</span>
                                     <span className="text-emerald-400">Pagamentos: {formatCurrency(statementData.transactions.filter(t => t.amount > 0).reduce((a,b) => a+b.amount, 0))}</span>
                                 </div>
                             </div>
                             <div className="bg-zinc-900/50 p-4 rounded-lg">
                                 <span className="text-sm text-zinc-400 block mb-1">Vencimento</span>
                                 <span className="text-xl font-medium text-white">{format(new Date(statementData.due_date), 'dd/MM/yyyy')}</span>
                             </div>
                             <div className="bg-zinc-900/50 p-4 rounded-lg flex flex-col justify-between">
                                 <div>
                                    <span className="text-sm text-zinc-400 block mb-1">Status</span>
                                    <span className={`text-xl font-medium ${
                                        statementData.status === 'OVERDUE' ? 'text-red-500' :
                                        statementData.status === 'CLOSED' ? 'text-blue-500' : 'text-emerald-500'
                                    }`}>
                                        {statementData.status === 'OVERDUE' ? 'Vencida' :
                                        statementData.status === 'CLOSED' ? 'Fechada' : 'Aberta'}
                                    </span>
                                 </div>
                                 {(statementData.status === 'CLOSED' || statementData.status === 'OVERDUE' || statementData.status === 'OPEN') && statementData.total < 0 && (
                                     <button
                                        onClick={handlePayInvoice}
                                        disabled={paying}
                                        className="mt-2 w-full py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 text-sm rounded transition-colors"
                                     >
                                         {paying ? 'Processando...' : 'Pagar Fatura'}
                                     </button>
                                 )}
                             </div>
                        </div>
                        )}

                        {!showProjection && (
                        <div className="space-y-2">
                             {statementData.transactions.length === 0 ? (
                                 <p className="text-center text-zinc-500 py-8">Nenhuma transação nesta fatura.</p>
                             ) : (
                                 statementData.transactions.map((t, idx) => (
                                     <div key={t.id || idx} className="flex justify-between items-center p-3 bg-zinc-900/30 rounded-lg hover:bg-zinc-900/50 transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                                                  <TrendingUp className="w-4 h-4" />
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                      <p className="font-medium text-white">{t.description}</p>
                                                      {t.id.startsWith('virtual') && (
                                                          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700">Projeção</span>
                                                      )}
                                                  </div>
                                                  <p className="text-xs text-zinc-400">{format(new Date(t.date), 'dd/MM')} • {getCategoryName(t.category_id)}</p>
                                              </div>
                                          </div>
                                          <span className={`font-medium ${t.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                              {formatCurrency(t.amount)}
                                          </span>
                                     </div>
                                 ))
                             )}
                        </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-zinc-500">
                        {creditCards.length === 0 ? "Cadastre um cartão para ver a fatura." : "Selecione um cartão para ver a fatura."}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-800 p-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6">
              {isEditing ? 'Editar Cartão' : 'Novo Cartão'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Nome do Cartão</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                    placeholder="Ex: Nubank, Inter..."
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Bandeira</label>
                  <select
                    value={formData.brand}
                    onChange={e => setFormData({...formData, brand: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  >
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Elo">Elo</option>
                      <option value="Amex">Amex</option>
                      <option value="Outros">Outros</option>
                  </select>
               </div>

               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Limite (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.credit_limit}
                    onChange={e => setFormData({...formData, credit_limit: parseFloat(e.target.value)})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Dia Fechamento</label>
                      <input
                        type="number"
                        min="1" max="31"
                        required
                        value={formData.closing_day}
                        onChange={e => setFormData({...formData, closing_day: parseInt(e.target.value)})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1" max="31"
                        required
                        value={formData.due_day}
                        onChange={e => setFormData({...formData, due_day: parseInt(e.target.value)})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                      />
                   </div>
               </div>

               <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Cor</label>
                  <div className="flex gap-2">
                     {['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map(color => (
                         <div
                           key={color}
                           onClick={() => setFormData({...formData, color})}
                           className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center border-2 ${formData.color === color ? 'border-white' : 'border-transparent'}`}
                           style={{backgroundColor: color}}
                         >
                            {formData.color === color && <Check className="w-4 h-4 text-white"/>}
                         </div>
                     ))}
                  </div>
               </div>

               <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg text-white font-semibold transition-colors mt-4">
                   {isEditing ? 'Salvar Alterações' : 'Criar Cartão'}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
