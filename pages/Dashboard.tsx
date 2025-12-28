import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { calculateProjection, formatCurrency } from '../utils/projection';
import { Card, Button } from '../components/ui';
import { TrendingUp, Wallet, Lock, Activity, Sparkles, PieChart as PieChartIcon, ArrowUpRight, ArrowDownLeft, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

export const Dashboard: React.FC = () => {
  const { recurringRules, transactions, categories, reserves } = useStore();

  // Date State for Filter
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Input month gives YYYY-MM
    const [year, month] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, 1);
    setSelectedDate(newDate);
  };

  const selectedMonthStr = selectedDate.toISOString().slice(0, 7); // YYYY-MM

  // Calculate Monthly Values based on Selected Date
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      // Use local parts to avoid timezone issues when comparing with selected Date which is local
      return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate]);

  const monthlyIncome = useMemo(() => {
      return currentMonthTransactions.reduce((acc, t) => t.amount > 0 ? acc + t.amount : acc, 0);
  }, [currentMonthTransactions]);

  const monthlyExpenses = useMemo(() => {
      return currentMonthTransactions.reduce((acc, t) => t.amount < 0 ? acc + Math.abs(t.amount) : acc, 0);
  }, [currentMonthTransactions]);

  const monthlyBalance = monthlyIncome - monthlyExpenses;

  const totalReserves = reserves.reduce((acc, r) => acc + r.current_amount, 0);

  // --- METRICS CALCULATION ---

  // 1. Economia do Mês (Diferença mês atual vs anterior)
  // Calculate previous month balance
  const previousMonthDate = useMemo(() => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [selectedDate]);

  const previousMonthBalance = useMemo(() => {
    const prevMonthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === previousMonthDate.getMonth() && d.getFullYear() === previousMonthDate.getFullYear();
    });
    const income = prevMonthTransactions.reduce((acc, t) => t.amount > 0 ? acc + t.amount : acc, 0);
    const expense = prevMonthTransactions.reduce((acc, t) => t.amount < 0 ? acc + Math.abs(t.amount) : acc, 0);
    return income - expense;
  }, [transactions, previousMonthDate]);

  const monthSavingsDiff = monthlyBalance - previousMonthBalance;

  // 2. Burn Rate (Gasto médio diário no mês atual)
  // If current month is strictly in the past, use days in month. If it's *now*, use days elapsed so far?
  // Standard Burn Rate is often monthly, but request says "por dia".
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  // If selected month is current month, maybe divide by current day?
  // Let's stick to simple "Total Expenses / Days in Month" to project average daily burn for the WHOLE month context,
  // OR "Total Expenses / Days passed" if it's current month.
  // Let's use days passed if it's current month, otherwise days in month.
  const isCurrentMonthReal = new Date().getMonth() === selectedDate.getMonth() && new Date().getFullYear() === selectedDate.getFullYear();
  const daysElapsed = isCurrentMonthReal ? new Date().getDate() : daysInMonth;

  const burnRateDaily = daysElapsed > 0 ? monthlyExpenses / daysElapsed : 0;

  // 3. Dias até Zero
  // Projection: Current Total Balance (Sum of ALL transactions ever? Or just monthly balance?)
  // Usually "Runway" is based on Total Cash / Burn Rate.
  // Let's calculate Total Wallet Balance first.
  const totalWalletBalance = useMemo(() => {
      return transactions.reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const daysToZero = burnRateDaily > 0 ? totalWalletBalance / burnRateDaily : 999;
  // If balance is negative, it's 0.

  // 4. Taxa de Poupança (% da receita que sobra)
  const savingsRate = monthlyIncome > 0 ? (monthlyBalance / monthlyIncome) * 100 : 0;

  const projectionData = calculateProjection(transactions, recurringRules, 180);

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- DATA PROCESSING FOR CHARTS ---

  // 1. Expenses by Category (Pie Chart) - Filtered by Selected Month
  const expensesByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    currentMonthTransactions.filter(t => t.amount < 0).forEach(t => {
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
  }, [currentMonthTransactions, categories]);

  // 2. Income vs Expenses by Month (Bar Chart) - Ending at Selected Month
  const monthlyComparison = useMemo(() => {
    const data: Record<string, { income: number, expense: number, date: string }> = {};
    
    // 6 months ending at selectedDate
    for(let i=5; i>=0; i--) {
        const d = new Date(selectedDate);
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
  }, [transactions, selectedDate]);


  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setAiAnalysis("Sessão expirada. Faça login novamente.");
        setIsAnalyzing(false);
        return;
      }

      const financialContext = `
        Mês Analisado: ${selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        Receita do Mês: ${formatCurrency(monthlyIncome)}
        Despesas do Mês: ${formatCurrency(monthlyExpenses)}
        Saldo do Mês: ${formatCurrency(monthlyBalance)}
        Gasto Mensal Médio (6 meses): ${formatCurrency(monthlyComparison.reduce((acc, m) => acc + m.expense, 0) / 6)}
        Maiores Gastos (Categorias): ${expensesByCategory.slice(0,3).map(c => c.name).join(', ')}
        Metas de Reserva: ${reserves.length} ativas, Total: ${formatCurrency(totalReserves)}
      `;

      const response = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          balance: totalWalletBalance,
          monthly_income: monthlyIncome,
          monthly_expenses: monthlyExpenses,
          reserves_total: totalReserves,
          context: financialContext
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao gerar análise');
      }

      const data = await response.json();
      setAiAnalysis(data.analysis);
    } catch (error: any) {
      console.error(error);
      setAiAnalysis(error.message || "Não foi possível gerar insights. Tente novamente.");
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
        <div className="flex items-center gap-4">
            <div className="relative">
                <input
                    type="month"
                    value={selectedMonthStr}
                    onChange={handleDateChange}
                    className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5 [color-scheme:dark]"
                />
            </div>
            <Button variant="secondary" onClick={handleAiAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? <Activity className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-400" />}
                {isAnalyzing ? 'Processando...' : 'Análise Inteligente'}
            </Button>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Economia do Mês */}
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Wallet size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Economia do Mês</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(monthSavingsDiff)}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className={`${monthSavingsDiff >= 0 ? 'text-emerald-500' : 'text-red-500'} flex items-center`}>
                {monthSavingsDiff >= 0 ? <ArrowUpRight size={12} className="mr-1"/> : <ArrowDownLeft size={12} className="mr-1"/>}
                vs mês anterior
             </span>
          </div>
        </Card>

        {/* Card 2: Burn Rate */}
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Activity size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Burn Rate (Dia)</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(burnRateDaily)}
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-zinc-500">Média diária de gastos</span>
          </div>
        </Card>

        {/* Card 3: Dias até Zero */}
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <TrendingUp size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Dias até Zero</span>
          </div>
          <div className={`text-2xl font-bold mb-1 ${daysToZero < 30 ? 'text-red-400' : 'text-emerald-400'}`}>
            {daysToZero >= 999 ? '∞' : Math.floor(daysToZero)} dias
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-zinc-500">Com base no saldo atual</span>
          </div>
        </Card>

        {/* Card 4: Taxa de Poupança */}
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-5">
              <Target size={100} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-zinc-400">Taxa de Poupança</span>
          </div>
          <div className={`text-2xl font-bold mb-1 ${savingsRate < 20 ? 'text-yellow-400' : 'text-blue-400'}`}>
            {savingsRate.toFixed(1)}%
          </div>
          <div className="flex items-center gap-2 text-xs">
             <span className="text-zinc-500">% da receita economizada</span>
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
                          Sem dados de despesa para este mês
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
                A partir de hoje
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
