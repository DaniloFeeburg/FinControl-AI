import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Badge, Button, Input } from '../components/ui';
import { formatCurrency } from '../utils/projection';
import { Repeat, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Category } from '../types';

export const Categories: React.FC = () => {
  const { categories, recurringRules, addCategory, updateCategory, deleteCategory, addRecurringRule } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Category Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [color, setColor] = useState('#3b82f6');
  const [isFixed, setIsFixed] = useState(false);

  // Recurrence Fields
  const [recurrenceAmount, setRecurrenceAmount] = useState('');
  const [recurrenceDay, setRecurrenceDay] = useState('5');
  const [autoCreate, setAutoCreate] = useState(true);

  const resetForm = () => {
    setName('');
    setType('EXPENSE');
    setColor('#3b82f6');
    setIsFixed(false);
    setRecurrenceAmount('');
    setRecurrenceDay('5');
    setAutoCreate(true);
    setEditId(null);
    setIsEditing(false);
  };

  const handleEdit = (c: Category) => {
    setEditId(c.id);
    setName(c.name);
    setType(c.type);
    setColor(c.color);
    setIsFixed(c.is_fixed);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir esta categoria? Regras associadas podem quebrar.')) {
        deleteCategory(id);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
        name,
        type,
        color,
        is_fixed: isFixed,
        icon: 'Tag' // Default icon for simplicity
    };

    if (editId) {
        await updateCategory(editId, payload);
    } else {
        const newCat = await addCategory(payload);

        // If fixed and we have recurrence data, create the rule
        if (newCat && isFixed && recurrenceAmount) {
            const amountVal = parseFloat(recurrenceAmount);
            // If expense, ensure negative. If income, ensure positive.
            const finalAmount = type === 'EXPENSE' ? -Math.abs(amountVal) : Math.abs(amountVal);

            await addRecurringRule({
                category_id: newCat.id,
                description: newCat.name,
                amount: finalAmount,
                rrule: `FREQ=MONTHLY;BYMONTHDAY=${recurrenceDay}`,
                active: true,
                auto_create: autoCreate
            });
        }
    }
    resetForm();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Categorias & Regras</h1>
        <Button onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {isEditing ? 'Cancelar' : 'Nova Categoria'}
        </Button>
      </div>
        
      <div className="grid md:grid-cols-2 gap-8">
        {/* Categories List & Form */}
        <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-300">Categorias Ativas</h2>

          {isEditing && (
              <Card className="p-4 bg-zinc-900/50 border-emerald-500/30">
                  <form onSubmit={handleSubmit} className="space-y-3">
                      <Input 
                        placeholder="Nome da Categoria" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        required 
                      />
                      <div className="flex gap-2">
                        <select 
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-sm text-white flex-1"
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                        >
                            <option value="EXPENSE">Despesa</option>
                            <option value="INCOME">Receita</option>
                        </select>
                        <input 
                            type="color" 
                            className="bg-transparent h-9 w-9 rounded cursor-pointer"
                            value={color}
                            onChange={e => setColor(e.target.value)}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isFixed} 
                            onChange={e => setIsFixed(e.target.checked)} 
                            className="rounded bg-zinc-950 border-zinc-800"
                          />
                          Custo Fixo / Recorrente
                      </label>

                      {isFixed && !editId && (
                        <div className="p-3 bg-zinc-950/50 rounded space-y-3 border border-zinc-800">
                           <p className="text-xs text-zinc-500 font-medium uppercase">Configurar Recorrência</p>
                           <Input
                              type="number"
                              placeholder="Valor Estimado"
                              value={recurrenceAmount}
                              onChange={e => setRecurrenceAmount(e.target.value)}
                              required={isFixed}
                           />
                           <div className="flex gap-2 items-center">
                               <span className="text-sm text-zinc-400">Dia do mês:</span>
                               <Input
                                  type="number"
                                  min="1"
                                  max="31"
                                  value={recurrenceDay}
                                  onChange={e => setRecurrenceDay(e.target.value)}
                                  className="w-20"
                               />
                           </div>
                           <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={autoCreate}
                                onChange={e => setAutoCreate(e.target.checked)}
                                className="rounded bg-zinc-950 border-zinc-800"
                              />
                              Criar lançamentos automaticamente
                           </label>
                        </div>
                      )}

                      <Button type="submit" className="w-full">{editId ? 'Atualizar' : 'Criar Categoria'}</Button>
                  </form>
              </Card>
          )}

          <div className="grid gap-3">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 group">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-zinc-500">{c.is_fixed ? 'Custo Fixo' : 'Variável'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={c.type === 'INCOME' ? 'success' : 'neutral'}>
                    {c.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </Badge>
                    <button onClick={() => handleEdit(c)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded transition-all text-zinc-400"><Pencil size={12}/></button>
                    <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded transition-all text-red-400"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Rules Engine */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-300 flex items-center gap-2">
            <Repeat size={18} />
            Motor de Recorrência
          </h2>
          <div className="space-y-3">
            {recurringRules.map(rule => {
               const cat = categories.find(c => c.id === rule.category_id);
               return (
                <Card key={rule.id} className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-white">{rule.description}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{rule.rrule}</p>
                    </div>
                    <span className={`font-mono font-bold text-sm ${rule.amount > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {formatCurrency(Math.abs(rule.amount))}
                    </span>
                  </div>
                  {cat && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/50">
                      <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                      <span className="text-xs text-zinc-400">{cat.name}</span>
                    </div>
                  )}
                </Card>
               );
            })}
          </div>
          <div className="p-4 rounded-lg bg-blue-900/10 border border-blue-800 text-xs text-blue-200">
            Regras recorrentes são processadas automaticamente pelo motor de projeção para prever saldos futuros.
          </div>
        </div>
      </div>
    </div>
  );
};