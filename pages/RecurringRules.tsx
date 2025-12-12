import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, Button, Input } from '../components/ui';
import { formatCurrency } from '../utils/projection';
import { CalendarClock, Plus, X, Trash2, Pencil, Power, PowerOff, Save, Activity } from 'lucide-react';
import { RecurringRule } from '../types';

export const RecurringRules: React.FC = () => {
  const { recurringRules, categories, addRecurringRule, deleteRecurringRule, updateRecurringRule } = useStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    description: '',
    day: '5',
    active: true,
    auto_create: false
  });

  const getCategoryDetails = (catId: string) => {
    return categories.find(c => c.id === catId);
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      amount: '',
      description: '',
      day: '5',
      active: true,
      auto_create: false
    });
    setEditingRule(null);
    setIsFormOpen(false);
  };

  const handleEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    const day = rule.rrule.match(/BYMONTHDAY=(\d+)/)?.[1] || '5';

    setFormData({
      category_id: rule.category_id,
      amount: (Math.abs(rule.amount) / 100).toString(),
      description: rule.description,
      day: day,
      active: rule.active,
      auto_create: rule.auto_create || false
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const category = getCategoryDetails(formData.category_id);
    if (!category) return;

    const amountValue = parseFloat(formData.amount) * 100;
    const finalAmount = category.type === 'EXPENSE' ? -Math.abs(amountValue) : Math.abs(amountValue);

    const ruleData = {
      category_id: formData.category_id,
      amount: finalAmount,
      description: formData.description,
      rrule: `FREQ=MONTHLY;BYMONTHDAY=${formData.day}`,
      active: formData.active,
      auto_create: formData.auto_create
    };

    if (editingRule) {
      updateRecurringRule(editingRule.id, ruleData);
    } else {
      addRecurringRule(ruleData);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir esta regra recorrente? Esta ação não pode ser desfeita.')) {
      deleteRecurringRule(id);
    }
  };

  const toggleActive = (id: string) => {
    const rule = recurringRules.find(r => r.id === id);
    if (rule) {
      updateRecurringRule(id, { ...rule, active: !rule.active });
    }
  };

  const RuleCard = ({ rule }: { rule: RecurringRule }) => {
    const category = getCategoryDetails(rule.category_id);
    if (!category) return null;

    const isExpense = rule.amount < 0;
    const day = rule.rrule.match(/BYMONTHDAY=(\d+)/)?.[1] || '?';

    return (
      <div className={`p-4 rounded-lg border-2 transition-all ${
        rule.active
          ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
          : 'bg-zinc-950/30 border-zinc-900 opacity-60'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{rule.description}</h3>
              {rule.auto_create && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
                  Auto
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span
                className="px-2 py-0.5 rounded border"
                style={{
                  borderColor: `${category.color}40`,
                  color: category.color,
                  backgroundColor: `${category.color}10`
                }}
              >
                {category.name}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock size={12} />
                Todo dia {day}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleActive(rule.id)}
              className={`p-2 rounded-lg transition-colors ${
                rule.active
                  ? 'text-emerald-500 hover:bg-emerald-500/10'
                  : 'text-zinc-600 hover:bg-zinc-800'
              }`}
              title={rule.active ? 'Desativar' : 'Ativar'}
            >
              {rule.active ? <Power size={16} /> : <PowerOff size={16} />}
            </button>
            <button
              onClick={() => handleEdit(rule)}
              className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(rule.id)}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">Valor mensal</span>
          <span className={`text-xl font-bold font-mono ${
            isExpense ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {formatCurrency(rule.amount)}
          </span>
        </div>
      </div>
    );
  };

  const activeRules = recurringRules.filter(r => r.active);
  const inactiveRules = recurringRules.filter(r => !r.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-purple-500" />
            Regras Recorrentes
          </h1>
          <p className="text-zinc-400">Gerencie receitas e despesas que se repetem mensalmente</p>
        </div>
        <Button onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }}>
          {isFormOpen ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {isFormOpen ? 'Cancelar' : 'Nova Regra'}
        </Button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <Card className="p-6 bg-zinc-900/50 border-emerald-500/30 animate-in slide-in-from-top-4">
          <h2 className="text-lg font-bold mb-4">{editingRule ? 'Editar Regra' : 'Nova Regra Recorrente'}</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Categoria</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type === 'INCOME' ? 'Receita' : 'Despesa'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Valor (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Descrição</label>
                <Input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Salário, Aluguel..."
                  required
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Dia do Mês (1-31)</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex gap-6 pt-2 border-t border-zinc-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                />
                <span className="text-sm text-zinc-300">Regra ativa</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.auto_create}
                  onChange={(e) => setFormData({ ...formData, auto_create: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-900 text-purple-500"
                />
                <span className="text-sm text-zinc-300">Criar transações automaticamente</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={resetForm} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {editingRule ? 'Atualizar' : 'Criar Regra'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lists */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Power className="text-emerald-500" size={20} />
            Regras Ativas ({activeRules.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeRules.length > 0 ? (
              activeRules.map(rule => <RuleCard key={rule.id} rule={rule} />)
            ) : (
              <p className="text-zinc-500 col-span-2 text-center py-8">
                Nenhuma regra ativa. Clique em "Nova Regra" para começar.
              </p>
            )}
          </div>
        </div>

        {inactiveRules.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-500">
              <PowerOff size={20} />
              Regras Inativas ({inactiveRules.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {inactiveRules.map(rule => <RuleCard key={rule.id} rule={rule} />)}
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-sm text-blue-200">
        <p className="font-medium mb-2">💡 Como funcionam as regras recorrentes?</p>
        <ul className="space-y-1 text-xs text-blue-300 ml-4 list-disc">
          <li>Regras ativas são usadas para projetar seu fluxo de caixa futuro no Dashboard</li>
          <li>Com "Auto" ativado, transações pendentes serão criadas automaticamente no dia especificado</li>
          <li>Você pode pausar regras temporariamente sem excluí-las</li>
          <li>Regras inativas não aparecem nas projeções</li>
        </ul>
      </div>
    </div>
  );
};
