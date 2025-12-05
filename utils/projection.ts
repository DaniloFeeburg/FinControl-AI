import { DailyProjection, RecurringRule, Transaction } from "../types";

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
  transactions: Transaction[],
  rules: RecurringRule[],
  daysToProject: number = 180
): DailyProjection[] => {
  const projections: DailyProjection[] = [];

  // Calculate starting balance (transactions up to today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out future transactions for the starting balance
  // We assume the Dashboard "currentBalance" was the sum of ALL transactions.
  // Here we want to start from the "Real" balance as of NOW, and then project future events.
  const startingBalance = transactions.reduce((acc, t) => {
    const tDate = new Date(t.date);
    // Include if date is today or in the past
    // Note: t.date is usually YYYY-MM-DD string, so new Date(t.date) is UTC midnight.
    // We should compare strictly.
    if (tDate <= today) {
        return acc + t.amount;
    }
    return acc;
  }, 0);

  let runningBalance = startingBalance;

  // Create a map of future transactions for quick lookup
  const futureTransactionsMap: Record<string, number> = {};
  transactions.forEach(t => {
      const tDate = new Date(t.date);
      // If strictly in future
      if (tDate > today) {
          const key = t.date; // YYYY-MM-DD
          futureTransactionsMap[key] = (futureTransactionsMap[key] || 0) + t.amount;
      }
  });

  // Start projecting from tomorrow? Or today?
  // Usually projection starts today. If we already included today's txns in startingBalance,
  // we shouldn't add them again.
  // The loop starts at i=0 (Today).

  // RE-EVALUATION:
  // If i=0 is Today.
  // startingBalance includes Today's txns.
  // loop i=0 processes Today again? No.
  // We need to be careful.

  // Let's adhere to:
  // startingBalance = sum(t where t.date <= today)
  // Loop i=0 is Today.
  //    Check for Recurring Rules that apply TODAY.
  //    But if a Recurring Rule applied Today, shouldn't it already be a Transaction?
  //    Usually, Recurring Rules generate Transactions.
  //    However, in this app, Recurring Rules seem to be "virtual" (just for projection)
  //    UNLESS the user manually added the transaction.
  //    If the user manually added the transaction for Today, it's in `startingBalance`.
  //    If we also apply the Rule for Today, we double count.

  //    Strategy:
  //    Project Future only.
  //    i=0 (Today): Just show the startingBalance.
  //    i=1 (Tomorrow): Check Rules & Future Txns.

  for (let i = 0; i <= daysToProject; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + i);
    const dayOfMonth = currentDate.getDate();
    // Helper to get YYYY-MM-DD in local time (or consistent with transaction dates)
    // transactions use YYYY-MM-DD strings.
    // toISOString() uses UTC. We need to be careful with timezone offsets.
    // Simple approach: construct string manually or use a library.
    // Since we don't have date-fns, let's use a safe format.
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;

    // Skip applying rules/future txns for Today (i=0)
    // because we assume startingBalance is accurate for "Now".
    // AND we assume future txns/rules start from tomorrow.
    // UNLESS the user wants to see "What will happen later today?".
    // Given the prompt "adjust cash flow...", simpler is safer:
    // Start applying changes from i=0?
    // If I have a rule for Today that hasn't been paid yet (no transaction), it should appear.
    // But we don't know if it was paid.
    // Assumption: If it's a projection, we usually look forward.
    // Let's apply rules/future txns starting from Tomorrow (i=1).
    // But the chart usually wants to start at x=0.

    if (i > 0) {
        // 1. Future Transactions (Variables/Fixed explicitly registered)
        if (futureTransactionsMap[isoDate]) {
            runningBalance += futureTransactionsMap[isoDate];
        }

        // 2. Recurring Rules
        rules.forEach(rule => {
            if (!rule.active) return;
            const ruleDay = getDayFromRRule(rule.rrule);

            if (ruleDay !== null && ruleDay === dayOfMonth) {
                runningBalance += rule.amount;
            }
        });
    }

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
