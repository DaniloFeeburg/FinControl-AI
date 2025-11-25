import { DailyProjection, RecurringRule } from "../types";

// Helper to format currency
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount / 100);
};

// Simplified parser for FREQ=MONTHLY;BYMONTHDAY=X
const getDayFromRRule = (rrule: string): number | null => {
  const match = rrule.match(/BYMONTHDAY=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

export const calculateProjection = (
  currentBalance: number,
  rules: RecurringRule[],
  daysToProject: number = 180
): DailyProjection[] => {
  const projections: DailyProjection[] = [];
  let runningBalance = currentBalance;
  const startDate = new Date();

  // Estimativa simples de "Gastos Variáveis" (ex: R$ 20/dia decaimento linear para comida/diversos)
  const DAILY_VARIABLE_SPEND = -2000; 

  for (let i = 0; i <= daysToProject; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dayOfMonth = currentDate.getDate();
    const isoDate = currentDate.toISOString().split('T')[0];

    // Apply variable spend
    runningBalance += DAILY_VARIABLE_SPEND;

    // Apply recurring rules
    rules.forEach(rule => {
      if (!rule.active) return;
      const ruleDay = getDayFromRRule(rule.rrule);
      
      if (ruleDay !== null && ruleDay === dayOfMonth) {
        runningBalance += rule.amount;
      }
    });

    projections.push({
      date: isoDate,
      balance: runningBalance,
      type: 'projected'
    });
  }

  return projections;
};

// Nova função para cálculo de reservas
export const calculateMonthlySavingsNeeded = (
  targetAmount: number,
  currentAmount: number,
  deadlineStr: string
): { monthlyAmount: number; monthsRemaining: number; isLate: boolean } => {
  const deadline = new Date(deadlineStr);
  const today = new Date();
  
  // Diferença em meses
  const monthsRemaining = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
  
  if (monthsRemaining <= 0) {
    return { monthlyAmount: targetAmount - currentAmount, monthsRemaining: 0, isLate: true };
  }

  const remainingToSave = targetAmount - currentAmount;
  if (remainingToSave <= 0) return { monthlyAmount: 0, monthsRemaining, isLate: false };

  // Divisão simples pelo número de meses restantes
  const monthlyAmount = Math.ceil(remainingToSave / monthsRemaining);

  return { monthlyAmount, monthsRemaining, isLate: false };
};