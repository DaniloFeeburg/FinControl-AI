import React, { useState } from 'react';
import { useStore } from '../store';
import { calculateProjection, formatCurrency } from '../utils/projection';
import { Card, Button } from '../components/ui';
import { TrendingUp, Wallet, Lock, Activity, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { GoogleGenAI } from '@google/genai';

export const Dashboard: React.FC = () => {
  const { getBalance, getAvailableBalance, recurringRules, transactions } = useStore();
  const currentBalance = getBalance();
  const availableBalance = getAvailableBalance();
  const projectionData = calculateProjection(currentBalance, recurringRules, 180);
  
  // Projected balance in 30 days
  const projected30Days = projectionData[29]?.balance || 0;
  const isGrowing = projected30Days > currentBalance;

  // Gemini State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAiAnalysis = async () => {
    if (!process.env.API_KEY) {
      setAiAnalysis("Chave de API não encontrada.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Prepare context for Gemini
      const financialContext = `
        Saldo Atual: ${formatCurrency(currentBalance)}
        Disponível para Gastar (Livre de Reservas): ${formatCurrency(availableBalance)}
        Projeção (30 Dias): ${formatCurrency(projected30Days)}
        Transações Recentes: ${transactions.slice(0, 5).map(t => `${t.description}: ${formatCurrency(t.amount)}`).join(', ')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Aja como um consultor financeiro pessoal estrito, mas útil. Analise estes dados: ${financialContext}. 
        Forneça 3 pontos de conselho específicos. Mantenha em menos de 100 palavras. Foque em fluxo de caixa e economia. Responda em Português do Brasil.`,
      });

      setAiAnalysis(response.text);
    } catch (error) {
      console.error(error);
      setAiAnalysis("Não foi possível gerar insights. Verifique sua conexão ou configuração da API.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl">
          <p className="text-zinc-400 text-xs mb-1">{new Date(label).toLocaleDateString('pt-BR')}</p>
          <p className={`font-mono font-bold ${payload[0].value < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
          <p className="text-zinc-400">Bem-vindo de volta ao seu painel financeiro.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="secondary" onClick={handleAiAnalysis} disabled={isAnalyzing}>
             {isAnalyzing ? <Activity className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-400" />}
             {isAnalyzing ? 'Analisando...' : 'Insight IA'}
           </Button>
        </div>
      </div>

      {/* AI Insight Box */}
      {aiAnalysis && (
        <div className="bg-purple-900/10 border border-purple-500/20 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                    <h3 className="text-sm font-semibold text-purple-200 mb-1">Consultor Gemini</h3>
                    <div className="text-sm text-zinc-300 prose prose-invert max-w-none">
                        {aiAnalysis.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Saldo Total</span>
            <Wallet size={16} className="text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(currentBalance)}
          </div>
          <div className="text-xs text-zinc-500">
            Ativos líquidos atuais
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Disponível para Gastar</span>
            <Lock size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatCurrency(availableBalance)}
          </div>
          <div className="text-xs text-zinc-500">
            Livre de reservas e metas
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Projeção (30 dias)</span>
            <TrendingUp size={16} className={isGrowing ? "text-emerald-500" : "text-red-500"} />
          </div>
          <div className={`text-2xl font-bold ${isGrowing ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(projected30Days)}
          </div>
          <div className="text-xs text-zinc-500">
            Baseado em regras recorrentes
          </div>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Fluxo de Caixa Projetado (6 Meses)</h3>
        <div className="h-[300px] w-full">
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
                minTickGap={30}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                hide 
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
    </div>
  );
};