import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { calculateProjection, formatCurrency } from '../utils/projection';
import { Card, Button } from '../components/ui';
import { TrendingUp, Wallet, Lock, Activity, Sparkles, PieChart as PieChartIcon, ArrowUpRight, ArrowDownLeft, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { GoogleGenAI } from '@google/genai';

export const Dashboard: React.FC = () => {
  const { getBalance, getAvailableBalance, recurringRules, transactions, categories, reserves } = useStore();
  const currentBalance = getBalance();
  const availableBalance = getAvailableBalance();
  const projectionData = calculateProjection(currentBalance, recurringRules, 180);
  
  // Projected balance in 30 days
  const projected30Days = projectionData[29]?.balance || 0;
  const isGrowing = projected30Days > currentBalance;

  // Gemini State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- DATA PROCESSING FOR CHARTS ---

  // 1. Expenses by Category (Pie Chart)
  const expensesByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.filter(t => t.amount < 0).forEach(t => {
      if (data[t.category_id]) {
        data[t.category_id] += Math.abs(t.amount);
      } else {
        data[t.category_id] = Math.abs(t.amount);
      }
    });

    return Object.keys(data).map(catId => {
      const cat = categories.find(c => c.id === catId);
      return {
        name: cat?.name || 'Outros',
        value: data[catId],
        color: cat?.color || '#71717a'
      };
    }).sort((a, b) => b.value - a.value); // Sort desc
  }, [transactions, categories]);

  // 2. Income vs Expenses by Month (Bar Chart)
  const monthlyComparison = useMemo(() => {
    const data: Record<string, { income: number, expense: number, date: string }> = {};
    
    // Last 6 months
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });
        data[key] = { income: 0, expense: 0, date: monthName };
    }

    transactions.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if(data[key]) {
            if(t.amount > 0) data[key].income += t.amount;
            else data[key].expense += Math.abs(t.amount);
        }
    });

    return Object.values(data);
  }, [transactions]);


  const handleAiAnalysis = async () => {
    if (!process.env.API_KEY) {
      setAiAnalysis("Chave de API não encontrada.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const financialContext = `
        Saldo Total: ${formatCurrency(currentBalance)}
        Disponível (Líquido): ${formatCurrency(availableBalance)}
        Gasto Mensal Médio: ${formatCurrency(monthlyComparison.reduce((acc, m) => acc + m.expense, 0) / 6)}
        Maiores Gastos (Categorias): ${expensesByCategory.slice(0,3).map(c => c.name).join(', ')}
        Metas de Reserva: ${reserves.length} ativas
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analise as finanças: ${financialContext}. Dê 2 dicas práticas e curtas sobre como otimizar o orçamento atual e atingir as reservas mais rápido. Responda em PT-BR.`,
      });

      setAiAnalysis(response.text);
    } catch (error) {
      console.error(error);
      setAiAnalysis("Não foi possível gerar insights. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl z-50">
          <p className="text-zinc-400 text-xs mb-1">{label || new Date(payload[0].payload.date).toLocaleDateString('pt-BR')}</p>
          {payload.map((p: any, idx: number) => (
             <p key={idx} className="font-mono text-sm" style={{ color: p.color || p.fill }}>
               {p.name}: {formatCurrency(p.value)}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Financeiro</h1>
          <p className="text-zinc-400">Visão completa do seu patrimônio e fluxo de caixa.</p>
        </div>
        <Button variant="secondary" onClick={handleAiAnalysis} disabled={isAnalyzing}>
             {isAnalyzing ? <Activity className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-400" />}
             {isAnalyzing ? 'Processando...' : 'Análise Inteligente'}
        </Button>
      </div>

      {/* AI Box */}
      {aiAnalysis && (
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/30 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-1 shrink-0" />
                <div>
                    <h3 className="text-sm font-semibold text-purple-200 mb-1">Insights do Consultor</h3>
                    <div className="text-sm text-zinc-300 prose prose-invert max-w-none leading-relaxed">
                        {aiAnalysis}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Wallet size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Patrimônio Total</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {formatCurrency(currentBalance)}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
                <ArrowUpRight size={12} className="mr-1"/> Atual
             </span>
             <span className="text-zinc-500">Todos os saldos somados</span>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Lock size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Disponível para Gastar</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mb-1">
            {formatCurrency(availableBalance)}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-zinc-500">Livre de Reservas</span>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Target size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Total em Reservas</span>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-1">
            {formatCurrency(currentBalance - availableBalance)}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-zinc-500">{reserves.length} metas ativas</span>
          </div>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
          {/* Pie Chart - Expenses */}
          <Card className="p-6 lg:col-span-1 flex flex-col">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <PieChartIcon size={18} className="text-zinc-400" />
                  Despesas por Categoria
              </h3>
              <div className="flex-1 min-h-[250px] relative">
                  {expensesByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={expensesByCategory}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {expensesByCategory.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                  ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
                          Sem dados de despesa
                      </div>
                  )}
              </div>
              <div className="mt-4 space-y-2 max-h-[150px] overflow-y-auto pr-2">
                  {expensesByCategory.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-zinc-300 truncate max-w-[120px]">{item.name}</span>
                          </div>
                          <span className="font-mono text-zinc-400">{formatCurrency(item.value)}</span>
                      </div>
                  ))}
              </div>
          </Card>

          {/* Bar Chart - Income vs Expense */}
          <Card className="p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-6">Receitas vs. Despesas (6 Meses)</h3>
              <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyComparison} barSize={20}>
                          <XAxis 
                            dataKey="date" 
                            stroke="#52525b" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <YAxis hide />
                          <Tooltip content={<CustomTooltip />} cursor={{fill: '#27272a'}} />
                          <Legend iconType="circle" />
                          <Bar name="Receitas" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar name="Despesas" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </Card>
      </div>

      {/* Projection Area Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp size={18} className="text-zinc-400"/>
                Fluxo de Caixa Projetado
             </h3>
             <div className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                Próximos 6 meses
             </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#71717a' }} 
                tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                minTickGap={40}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorBalance)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent Transactions & Reserves Summary Grid */}
      <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Últimas Transações</h3>
              <div className="space-y-3">
                  {transactions.slice(0, 5).map(t => {
                      const isExpense = t.amount < 0;
                      return (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isExpense ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    {isExpense ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-zinc-200">{t.description}</p>
                                    <p className="text-xs text-zinc-500">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <span className={`font-mono font-medium ${isExpense ? 'text-zinc-400' : 'text-emerald-400'}`}>
                                {formatCurrency(Math.abs(t.amount))}
                            </span>
                        </div>
                      )
                  })}
              </div>
          </Card>

          <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Progresso das Metas</h3>
              <div className="space-y-4">
                  {reserves.slice(0, 4).map(r => {
                      const pct = Math.min(100, Math.round((r.current_amount / r.target_amount) * 100));
                      return (
                        <div key={r.id}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-300">{r.name}</span>
                                <span className="text-emerald-500 font-mono text-xs">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 text-right">
                                {formatCurrency(r.current_amount)} de {formatCurrency(r.target_amount)}
                            </div>
                        </div>
                      )
                  })}
                  {reserves.length === 0 && <p className="text-zinc-500 text-sm">Nenhuma meta ativa.</p>}
              </div>
          </Card>
      </div>
    </div>
  );
};