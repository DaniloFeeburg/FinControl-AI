import React from 'react';
import { useStore } from '../store';
import { Card, Badge } from '../components/ui';
import { formatCurrency } from '../utils/projection';
import { CalendarClock, ArrowUpRight, ArrowDownLeft, Activity } from 'lucide-react';

export const RecurringRules: React.FC = () => {
  const { recurringRules, categories } = useStore();

  const getCategoryDetails = (catId: string) => {
    return categories.find(c => c.id === catId) || { name: 'Desconhecida', color: '#71717a', icon: '?' };
  };

  const activeRules = recurringRules.filter(r => r.active);
  const inactiveRules = recurringRules.filter(r => !r.active);

  const RuleItem = ({ rule }: { rule: any }) => {
    const category = getCategoryDetails(rule.category_id);
    const isExpense = rule.amount < 0;

    return (
      <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-3">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            {isExpense ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
          </div>
          <div>
            <h4 className="font-medium text-zinc-200">{rule.description}</h4>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <span
                className="px-1.5 py-0.5 rounded border"
                style={{ borderColor: `${category.color}40`, color: category.color }}
              >
                {category.name}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock size={12} />
                {rule.rrule}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatCurrency(Math.abs(rule.amount))}
          </p>
          <Badge variant={rule.active ? 'success' : 'neutral'}>
            {rule.active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-purple-500" />
            Receitas e Despesas Recorrentes
          </h1>
          <p className="text-zinc-400">Visualize todas as suas regras de recorrência cadastradas.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-zinc-200">Regras Ativas ({activeRules.length})</h3>
          {activeRules.length > 0 ? (
            activeRules.map(rule => <RuleItem key={rule.id} rule={rule} />)
          ) : (
            <p className="text-zinc-500 text-sm italic">Nenhuma regra ativa encontrada.</p>
          )}
        </Card>

        {inactiveRules.length > 0 && (
          <Card className="p-6 opacity-75">
            <h3 className="text-lg font-semibold mb-4 text-zinc-400">Inativas ({inactiveRules.length})</h3>
            {inactiveRules.map(rule => <RuleItem key={rule.id} rule={rule} />)}
          </Card>
        )}
      </div>
    </div>
  );
};
