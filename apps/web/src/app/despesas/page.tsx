"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/layout/app-shell";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth-session";

type PlanTier = "FREE" | "PRO";
type BudgetCategory =
  | "AGUA"
  | "LUZ"
  | "INTERNET"
  | "CONDOMINIO" 
  | "ALUGUEL"
  | "GAS"
  | "SUPERMERCADO"
  | "OUTROS";

type MeResponse = {
  user: { id: string; name: string; email: string };
  plan: { tier: PlanTier };
  larEmDestaque: { id: string; name: string } | null;
};

type BudgetEntry = {
  id: string;
  category: BudgetCategory;
  competenceMonth: string;
  amountCents: number;
  notes: string | null;
};

type SummaryCategory = {
  category: BudgetCategory;
  currentAmountCents: number;
  previousAmountCents: number;
  diffAmountCents: number;
  trend: "UP" | "DOWN" | "STABLE";
};

type BudgetSummary = {
  month: string;
  previousMonth: string;
  currentTotalCents: number;
  previousTotalCents: number;
  diffTotalCents: number;
  trend: "UP" | "DOWN" | "STABLE";
  categories: SummaryCategory[];
  goals?: Array<{
    id: string;
    category: BudgetCategory;
    targetCents: number;
    competenceMonth: string;
  }>;
};

type BudgetGoal = {
  id: string;
  category: BudgetCategory;
  targetCents: number;
  competenceMonth: string;
};

type SmartAlert = {
  id: string;
  text: string;
  severity: "info" | "warning" | "critical";
};

const CATEGORIES: Array<{ value: BudgetCategory; label: string }> = [
  { value: "AGUA", label: "Água" },
  { value: "LUZ", label: "Luz" },
  { value: "INTERNET", label: "Internet" },
  { value: "CONDOMINIO", label: "Condomínio" },
  { value: "ALUGUEL", label: "Aluguel" },
  { value: "GAS", label: "Gás" },
  { value: "SUPERMERCADO", label: "Supermercado" },
  { value: "OUTROS", label: "Outros" },
];

function currentMonthRef(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCents(amountCents: number): string {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function shiftMonthRef(monthRef: string, offset: number): string {
  const [yearRaw, monthRaw] = monthRef.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrencyInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInputToNumber(maskedValue: string): number {
  if (!maskedValue.trim()) return Number.NaN;
  const normalized = maskedValue.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function useCountUp(targetValue: number, durationMs = 550): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousTargetRef = useRef(targetValue);

  useEffect(() => {
    const from = previousTargetRef.current;
    const to = targetValue;
    if (from === to) return;

    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = from + (to - from) * eased;
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        previousTargetRef.current = to;
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [targetValue, durationMs]);

  return displayValue;
}

export default function DespesasPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [larNome, setLarNome] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("FREE");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthRef());
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [history, setHistory] = useState<Array<{ month: string; totalCents: number }>>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [goalCategory, setGoalCategory] = useState<BudgetCategory>("AGUA");
  const [goalAmount, setGoalAmount] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalAmount, setEditingGoalAmount] = useState("");
  const [historyRange, setHistoryRange] = useState<3 | 6 | 12>(6);

  const [newCategory, setNewCategory] = useState<BudgetCategory>("AGUA");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedChartMonth, setHighlightedChartMonth] = useState<string | null>(null);
  const launchFormRef = useRef<HTMLElement | null>(null);
  const [pendingScrollToLaunchForm, setPendingScrollToLaunchForm] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const historyMonths = useMemo(
    () => Array.from({ length: historyRange }).map((_, index) => shiftMonthRef(selectedMonth, -(historyRange - 1) + index)),
    [historyRange, selectedMonth],
  );

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const token = session.accessToken;
    setAccessToken(token);
    setUserName(session.user.name ?? "Usuário");
    setUserEmail(session.user.email ?? "...");

    async function loadBase() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const meResponse = await apiRequest<MeResponse>("/users/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserName(meResponse.dados.user.name);
        setUserEmail(meResponse.dados.user.email);
        setPlanTier(meResponse.dados.plan.tier);
        setLarNome(meResponse.dados.larEmDestaque?.name ?? null);
        setHouseholdId(meResponse.dados.larEmDestaque?.id ?? null);
      } catch (error) {
        clearSession();
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar despesas.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadBase();
  }, [router]);

  useEffect(() => {
    if (!accessToken || !householdId || planTier !== "PRO") return;
    async function loadBudgetData() {
      try {
        const [entriesResponse, summaryResponse, goalsResponse] = await Promise.all([
          apiRequest<{ items: BudgetEntry[] }>(`/budgets/households/${householdId}?month=${selectedMonth}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          apiRequest<{ summary: BudgetSummary }>(
            `/budgets/households/${householdId}/summary?month=${selectedMonth}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          ),
          apiRequest<{ items: BudgetGoal[] }>(`/budgets/households/${householdId}/goals?month=${selectedMonth}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);
        setEntries(entriesResponse.dados.items);
        setSummary(summaryResponse.dados.summary);
        setGoals(goalsResponse.dados.items);
        const historyResponses = await Promise.all(
          historyMonths.map((monthRef) =>
            apiRequest<{ summary: BudgetSummary }>(
              `/budgets/households/${householdId}/summary?month=${monthRef}`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            ),
          ),
        );
        setHistory(
          historyResponses.map((response, index) => ({
            month: historyMonths[index],
            totalCents: response.dados.summary.currentTotalCents,
          })),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os dados de despesas.");
      }
    }

    void loadBudgetData();
  }, [accessToken, householdId, selectedMonth, planTier, historyMonths]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!pendingScrollToLaunchForm) return;
    let attempts = 0;
    const maxAttempts = 12;
    const stickyOffset = 16;

    const tryScroll = () => {
      const element = launchFormRef.current ?? document.getElementById("novo-lancamento-form");
      if (element) {
        const targetTop = element.getBoundingClientRect().top + window.scrollY - stickyOffset;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        });
        setPendingScrollToLaunchForm(false);
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 120);
      } else {
        setPendingScrollToLaunchForm(false);
      }
    };

    tryScroll();
  }, [pendingScrollToLaunchForm]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  async function reloadData() {
    if (!accessToken || !householdId || planTier !== "PRO") return;
    const [entriesResponse, summaryResponse, goalsResponse] = await Promise.all([
      apiRequest<{ items: BudgetEntry[] }>(`/budgets/households/${householdId}?month=${selectedMonth}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      apiRequest<{ summary: BudgetSummary }>(`/budgets/households/${householdId}/summary?month=${selectedMonth}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      apiRequest<{ items: BudgetGoal[] }>(`/budgets/households/${householdId}/goals?month=${selectedMonth}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    setEntries(entriesResponse.dados.items);
    setSummary(summaryResponse.dados.summary);
    setGoals(goalsResponse.dados.items);
    const historyResponses = await Promise.all(
      historyMonths.map((monthRef) =>
        apiRequest<{ summary: BudgetSummary }>(`/budgets/households/${householdId}/summary?month=${monthRef}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );
    setHistory(
      historyResponses.map((response, index) => ({
        month: historyMonths[index],
        totalCents: response.dados.summary.currentTotalCents,
      })),
    );
  }

  async function handleSave() {
    if (!accessToken || !householdId || !newAmount) return;
    const normalized = parseCurrencyInputToNumber(newAmount);
    if (!Number.isFinite(normalized) || normalized < 0) {
      setFeedback("Informe um valor válido.");
      return;
    }

    try {
      setIsSaving(true);
      setFeedback(null);
      const payload = {
        category: newCategory,
        competenceMonth: selectedMonth,
        amountCents: Math.round(normalized * 100),
        notes: newNotes.trim() || undefined,
      };
      if (editingId) {
        await apiRequest(`/budgets/households/${householdId}/${editingId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: payload,
        });
        setFeedback("Lançamento atualizado com sucesso.");
      } else {
        await apiRequest(`/budgets/households/${householdId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: payload,
        });
        setFeedback("Lançamento criado com sucesso.");
      }
      setEditingId(null);
      setNewAmount("");
      setNewNotes("");
      await reloadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar lançamento.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(entryId: string) {
    if (!accessToken || !householdId) return;
    try {
      await apiRequest(`/budgets/households/${householdId}/${entryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setFeedback("Lançamento removido com sucesso.");
      await reloadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível remover lançamento.");
    }
  }

  async function handleSaveGoal() {
    if (!accessToken || !householdId || !goalAmount) return;
    const normalized = parseCurrencyInputToNumber(goalAmount);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setFeedback("Informe uma meta válida.");
      return;
    }
    try {
      setIsSavingGoal(true);
      setFeedback(null);
      const targetCents = Math.round(normalized * 100);
      const existingGoal = goals.find((goal) => goal.category === goalCategory && goal.competenceMonth === selectedMonth);

      if (existingGoal) {
        await apiRequest(`/budgets/households/${householdId}/goals/${existingGoal.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            targetCents,
          },
        });
        setFeedback("Meta atualizada para a categoria selecionada.");
      } else {
        await apiRequest(`/budgets/households/${householdId}/goals`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            category: goalCategory,
            competenceMonth: selectedMonth,
            targetCents,
          },
        });
        setFeedback("Meta salva com sucesso.");
      }
      setGoalAmount("");
      await reloadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar meta.");
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!accessToken || !householdId) return;
    try {
      await apiRequest(`/budgets/households/${householdId}/goals/${goalId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setFeedback("Meta removida com sucesso.");
      await reloadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível remover meta.");
    }
  }

  async function handleUpdateGoal(goalId: string) {
    if (!accessToken || !householdId || !editingGoalAmount) return;
    const normalized = parseCurrencyInputToNumber(editingGoalAmount);
    if (!Number.isFinite(normalized) || normalized < 0) {
      setFeedback("Informe uma meta válida.");
      return;
    }
    try {
      await apiRequest(`/budgets/households/${householdId}/goals/${goalId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { targetCents: Math.round(normalized * 100) },
      });
      setEditingGoalId(null);
      setEditingGoalAmount("");
      setFeedback("Meta atualizada com sucesso.");
      await reloadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar meta.");
    }
  }

  function handleExportCsv() {
    const lines = [
      ["categoria", "mes", "valor_reais", "observacoes"].join(","),
      ...entries.map((entry) =>
        [
          entry.category,
          entry.competenceMonth,
          (entry.amountCents / 100).toFixed(2).replace(".", ","),
          `"${(entry.notes ?? "").replaceAll('"', '""')}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `despesas-${selectedMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    window.print();
  }

  const topInsights = useMemo(() => {
    if (!summary) return [];
    return summary.categories
      .filter((item) => item.currentAmountCents > 0 || item.previousAmountCents > 0)
      .sort((a, b) => Math.abs(b.diffAmountCents) - Math.abs(a.diffAmountCents))
      .slice(0, 3);
  }, [summary]);

  const goalProgress = useMemo(() => {
    if (!summary) return [];
    const byCategory = new Map(summary.categories.map((item) => [item.category, item.currentAmountCents]));
    return goals.map((goal) => {
      const spent = byCategory.get(goal.category) ?? 0;
      const progress = goal.targetCents > 0 ? Math.round((spent / goal.targetCents) * 100) : 0;
      return {
        ...goal,
        spentCents: spent,
        progress,
        exceeded: spent > goal.targetCents,
      };
    });
  }, [goals, summary]);

  const pieSegments = useMemo(() => {
    const total = summary?.currentTotalCents ?? 0;
    if (total <= 0 || !summary) return [];
    let cursor = 0;
    const colors = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea", "#14b8a6", "#64748b"];
    return summary.categories
      .filter((cat) => cat.currentAmountCents > 0)
      .map((cat, index) => {
        const fraction = cat.currentAmountCents / total;
        const start = cursor;
        const end = cursor + fraction * 360;
        cursor = end;
        return { category: cat.category, start, end, color: colors[index % colors.length], amount: cat.currentAmountCents };
      });
  }, [summary]);

  const financialScore = useMemo(() => {
    if (!summary || history.length === 0) return 50;
    const current = summary.currentTotalCents;
    const previous = summary.previousTotalCents;
    const average = history.reduce((sum, item) => sum + item.totalCents, 0) / history.length;
    const variationPenalty = previous > 0 ? Math.min(30, Math.abs(summary.diffTotalCents / previous) * 100 * 0.5) : 0;
    const aboveAveragePenalty = average > 0 && current > average ? Math.min(20, ((current - average) / average) * 100 * 0.4) : 0;
    const bonus = summary.diffTotalCents < 0 ? 12 : 0;
    return Math.max(0, Math.min(100, Math.round(75 - variationPenalty - aboveAveragePenalty + bonus)));
  }, [summary, history]);

  const forecastTotal = useMemo(() => {
    if (history.length === 0) return summary?.currentTotalCents ?? 0;
    const lastThree = history.slice(-3).map((item) => item.totalCents);
    if (lastThree.length === 0) return summary?.currentTotalCents ?? 0;
    const weighted =
      lastThree.length === 1
        ? lastThree[0]
        : lastThree.length === 2
          ? Math.round(lastThree[0] * 0.4 + lastThree[1] * 0.6)
          : Math.round(lastThree[0] * 0.2 + lastThree[1] * 0.3 + lastThree[2] * 0.5);
    return weighted;
  }, [history, summary]);

  const smartAlerts = useMemo(() => {
    if (!summary) return [] as SmartAlert[];
    const alerts: SmartAlert[] = [];
    if (summary.diffTotalCents > 0) {
      alerts.push({
        id: "month-rise",
        text: `Seu custo total subiu ${formatCents(summary.diffTotalCents)} em relação ao mês anterior.`,
        severity: "warning",
      });
    } else if (summary.diffTotalCents < 0) {
      alerts.push({
        id: "month-fall",
        text: `Parabéns: houve economia de ${formatCents(Math.abs(summary.diffTotalCents))} neste mês.`,
        severity: "info",
      });
    }

    const biggestIncrease = summary.categories
      .filter((item) => item.diffAmountCents > 0)
      .sort((a, b) => b.diffAmountCents - a.diffAmountCents)[0];
    if (biggestIncrease) {
      const label = CATEGORIES.find((item) => item.value === biggestIncrease.category)?.label ?? biggestIncrease.category;
      alerts.push({
        id: `cat-${biggestIncrease.category}`,
        text: `${label} foi a categoria que mais cresceu (+${formatCents(biggestIncrease.diffAmountCents)}).`,
        severity: "warning",
      });
    }

    if (forecastTotal > (summary.currentTotalCents || 0) && summary.currentTotalCents > 0) {
      alerts.push({
        id: "forecast",
        text: `A previsão de fechamento está em ${formatCents(forecastTotal)}; revise contas variáveis para evitar estouro.`,
        severity: "warning",
      });
    }

    const criticalGoal = goalProgress.find((goal) => goal.progress >= 100);
    if (criticalGoal) {
      const label = CATEGORIES.find((item) => item.value === criticalGoal.category)?.label ?? criticalGoal.category;
      alerts.unshift({
        id: `goal-critical-${criticalGoal.id}`,
        text: `Meta crítica: ${label} já está em ${criticalGoal.progress}% da meta mensal.`,
        severity: "critical",
      });
    } else {
      const warningGoal = goalProgress.find((goal) => goal.progress >= 90);
      if (warningGoal) {
        const label = CATEGORIES.find((item) => item.value === warningGoal.category)?.label ?? warningGoal.category;
        alerts.unshift({
          id: `goal-warning-${warningGoal.id}`,
          text: `Atenção: ${label} atingiu ${warningGoal.progress}% da meta mensal.`,
          severity: "warning",
        });
      }
    }
    return alerts.slice(0, 3);
  }, [summary, forecastTotal, goalProgress]);

  const chartMax = useMemo(() => {
    const maxValue = Math.max(...history.map((item) => item.totalCents), 1);
    return maxValue;
  }, [history]);

  const chartPoints = useMemo(() => {
    if (history.length === 0) return "";
    const width = 100;
    const height = 100;
    const stepX = history.length > 1 ? width / (history.length - 1) : width;
    return history
      .map((item, index) => {
        const x = index * stepX;
        const y = height - Math.max(4, (item.totalCents / chartMax) * height);
        return `${x},${y}`;
      })
      .join(" ");
  }, [history, chartMax]);

  const trendLineMeta = useMemo(() => {
    if (history.length < 2) {
      return {
        color: "rgb(100 116 139 / 0.85)",
        label: "Sem tendência definida",
      };
    }
    const first = history[0].totalCents;
    const last = history[history.length - 1].totalCents;
    const delta = last - first;
    if (delta > 0) {
      return {
        color: "rgb(239 68 68 / 0.88)",
        label: "Tendência de alta nos custos",
      };
    }
    if (delta < 0) {
      return {
        color: "rgb(34 197 94 / 0.9)",
        label: "Tendência de economia",
      };
    }
    return {
      color: "rgb(100 116 139 / 0.85)",
      label: "Tendência estável",
    };
  }, [history]);

  const healthStatus = useMemo(() => {
    if (!summary) return { label: "Neutro", tone: "text-slate-600 dark:text-slate-300", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    if (summary.diffTotalCents < 0 && financialScore >= 70) {
      return { label: "Saudável", tone: "text-emerald-600 dark:text-emerald-300", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" };
    }
    if (summary.diffTotalCents > 0 || financialScore < 55) {
      return { label: "Crítico", tone: "text-red-600 dark:text-red-300", chip: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" };
    }
    return { label: "Atenção", tone: "text-amber-600 dark:text-amber-300", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" };
  }, [summary, financialScore]);

  const diffPercent = useMemo(() => {
    const previous = summary?.previousTotalCents ?? 0;
    const current = summary?.currentTotalCents ?? 0;
    if (previous <= 0) return 0;
    return ((current - previous) / previous) * 100;
  }, [summary]);

  const diffDirectionMeta = useMemo(() => {
    if ((summary?.diffTotalCents ?? 0) > 0) {
      return {
        label: "Alta de custos",
        icon: "↗",
        tone: "text-red-600 dark:text-red-300",
        pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
        border: "border-red-200/90 dark:border-red-400/30",
      };
    }
    if ((summary?.diffTotalCents ?? 0) < 0) {
      return {
        label: "Economia no período",
        icon: "↘",
        tone: "text-emerald-600 dark:text-emerald-300",
        pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
        border: "border-emerald-200/90 dark:border-emerald-400/30",
      };
    }
    return {
      label: "Sem mudança relevante",
      icon: "→",
      tone: "text-slate-600 dark:text-slate-300",
      pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
      border: "border-slate-200/90 dark:border-white/10",
    };
  }, [summary]);

  const monthlyGoalOverview = useMemo(() => {
    const totalTargetCents = goals.reduce((sum, goal) => sum + goal.targetCents, 0);
    const totalSpentCents = summary?.currentTotalCents ?? 0;
    const progressPercent = totalTargetCents > 0 ? Math.round((totalSpentCents / totalTargetCents) * 100) : 0;
    const clamped = Math.max(0, Math.min(100, progressPercent));
    const status =
      totalTargetCents === 0 ? "Sem meta definida" : progressPercent >= 100 ? "Crítico" : progressPercent >= 90 ? "Atenção" : "Saudável";
    return {
      totalTargetCents,
      totalSpentCents,
      progressPercent,
      clamped,
      status,
    };
  }, [goals, summary]);

  const monthlyGuidance = useMemo(() => {
    if (goalProgress.length === 0) return "Defina metas por categoria para receber direcionamento inteligente de economia.";
    const highest = [...goalProgress].sort((a, b) => b.progress - a.progress)[0];
    const label = CATEGORIES.find((item) => item.value === highest.category)?.label ?? highest.category;
    if (highest.progress >= 100) return `Ação imediata: ${label} já ultrapassou a meta mensal.`;
    if (highest.progress >= 90) return `Atenção: ${label} está perto do limite. Revise essa categoria primeiro.`;
    return `Bom controle: ${label} é a categoria mais sensível no momento (${highest.progress}%).`;
  }, [goalProgress]);

  const cardBaseClass =
    "rounded-2xl border border-slate-200/90 bg-white/90 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-300/30 dark:border-white/10 dark:bg-white/5 dark:hover:shadow-black/30";

  const animatedCurrentTotal = useCountUp(summary?.currentTotalCents ?? 0);
  const animatedPreviousTotal = useCountUp(summary?.previousTotalCents ?? 0);
  const animatedDiffTotal = useCountUp(summary?.diffTotalCents ?? 0);
  const animatedForecastTotal = useCountUp(forecastTotal);
  const animatedScore = useCountUp(financialScore, 500);

  return (
    <AppShell activeKey="despesas" larNome={larNome} userName={userName} userEmail={userEmail} onLogout={handleLogout}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Despesas da casa</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Custos fixos e consumo inteligente</h1>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${healthStatus.chip}`}>
              Status: {healthStatus.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Acompanhe água, luz, internet e outros custos com comparativo mensal e alertas de crescimento.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingScrollToLaunchForm(true);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              Adicionar despesa
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">{monthlyGuidance}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Mês</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedMonth}</p>
            </div>
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 dark:border-indigo-400/30 dark:bg-indigo-950/20">
              <p className="text-[11px] uppercase tracking-[0.1em] text-indigo-700 dark:text-indigo-300">Total atual</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatCents(Math.round(animatedCurrentTotal))}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Variação</p>
              <p className={`mt-1 text-sm font-semibold ${healthStatus.tone}`}>{formatCents(Math.round(animatedDiffTotal))}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Objetivo do mês</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                monthlyGoalOverview.status === "Crítico"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                  : monthlyGoalOverview.status === "Atenção"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                    : monthlyGoalOverview.status === "Saudável"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}>
                {monthlyGoalOverview.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              {formatCents(monthlyGoalOverview.totalSpentCents)} de {formatCents(monthlyGoalOverview.totalTargetCents)}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full transition-all ${
                  monthlyGoalOverview.progressPercent >= 100
                    ? "bg-red-500"
                    : monthlyGoalOverview.progressPercent >= 90
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${monthlyGoalOverview.clamped}%` }}
              />
            </div>
          </div>
        </section>

        <section className="sticky top-2 z-10 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0b1220]/80">
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-white/15 dark:bg-[#111827] dark:text-white" />
            <button type="button" onClick={handleExportCsv} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">Exportar CSV</button>
            <button type="button" onClick={handleExportPdf} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">Exportar PDF</button>
            <button type="button" onClick={() => setHistoryRange(3)} className={`rounded-lg px-2.5 py-1.5 text-xs ${historyRange === 3 ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>3m</button>
            <button type="button" onClick={() => setHistoryRange(6)} className={`rounded-lg px-2.5 py-1.5 text-xs ${historyRange === 6 ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>6m</button>
            <button type="button" onClick={() => setHistoryRange(12)} className={`rounded-lg px-2.5 py-1.5 text-xs ${historyRange === 12 ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>12m</button>
          </div>
        </section>

        {isLoading ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={`despesas-skeleton-${index}`}
                className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </section>
        ) : null}
        {errorMessage ? <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p> : null}

        {!isLoading && planTier !== "PRO" ? (
          <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 dark:border-amber-400/40 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Recurso exclusivo do plano PRO</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Faça upgrade para lançar custos fixos e receber insights de economia/crescimento mensal.
            </p>
          </section>
        ) : null}

        {!isLoading && planTier === "PRO" ? (
          <>
            <section className="grid gap-3 lg:grid-cols-[1.15fr_1fr_1.15fr]">
              <article className={`${cardBaseClass} border-2 border-indigo-300 bg-gradient-to-br from-indigo-100 via-indigo-50 to-white dark:border-indigo-500/40 dark:from-indigo-900/35 dark:via-indigo-950/25 dark:to-transparent`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">Total do mês</p>
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">Atual</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-indigo-950 dark:text-indigo-100">{formatCents(Math.round(animatedCurrentTotal))}</p>
                <p className="mt-1 text-xs font-medium text-indigo-700/80 dark:text-indigo-200/80">Competência {selectedMonth}</p>
              </article>
              <article className={`${cardBaseClass} border-2 border-slate-300 bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:border-slate-600/50 dark:from-slate-900/45 dark:via-slate-900/20 dark:to-transparent`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Mês anterior</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Base</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatCents(Math.round(animatedPreviousTotal))}</p>
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Referência para comparação</p>
              </article>
              <article className={`${cardBaseClass} ${diffDirectionMeta.border} ${
                (summary?.diffTotalCents ?? 0) > 0
                  ? "bg-gradient-to-br from-red-50/90 to-white dark:from-red-950/25 dark:to-transparent"
                  : (summary?.diffTotalCents ?? 0) < 0
                    ? "bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/25 dark:to-transparent"
                    : "bg-gradient-to-br from-slate-50/90 to-white dark:from-slate-900/30 dark:to-transparent"
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Variação</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffDirectionMeta.pill}`}>
                    {diffDirectionMeta.icon} {diffDirectionMeta.label}
                  </span>
                </div>
                <p className={`mt-2 text-3xl font-bold ${diffDirectionMeta.tone}`}>
                  {formatCents(Math.round(animatedDiffTotal))}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">vs mês anterior</p>
                  <p className={`rounded-full px-2 py-0.5 text-xs font-semibold ${diffDirectionMeta.pill}`}>
                    {diffPercent > 0 ? "+" : ""}{diffPercent.toFixed(1)}%
                  </p>
                </div>
              </article>
            </section>

            <section className="grid gap-3 lg:grid-cols-3">
              <article className={cardBaseClass}>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Score financeiro</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{Math.round(animatedScore)}/100</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {financialScore >= 75 ? "Saudável" : financialScore >= 50 ? "Atenção" : "Crítico"}
                </p>
              </article>
              <article className={cardBaseClass}>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Previsão de fechamento</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatCents(Math.round(animatedForecastTotal))}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Baseado no histórico recente da casa</p>
              </article>
              <article className={cardBaseClass}>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Alertas inteligentes</p>
                <div className="mt-2 space-y-1">
                  {smartAlerts.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sem alertas relevantes no momento.</p>
                  ) : (
                    smartAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-2 rounded-lg border border-slate-200/70 bg-slate-50/70 p-2 transition-colors dark:border-white/10 dark:bg-white/5">
                        <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          alert.severity === "critical"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                            : alert.severity === "warning"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}>
                          {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Info"}
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-200">{alert.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className={cardBaseClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Comparativo {historyRange} meses</h2>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{trendLineMeta.label}</span>
              </div>
              <div className="relative mt-3 h-40">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
                >
                  <polyline
                    fill="none"
                    stroke={trendLineMeta.color}
                    strokeWidth="1.5"
                    points={chartPoints}
                    style={{ transition: "all 450ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-end gap-2">
                {history.map((item) => {
                  const height = Math.max(8, Math.round((item.totalCents / chartMax) * 100));
                  const isCurrent = item.month === selectedMonth;
                  return (
                    <div key={item.month} className="group relative flex flex-1 flex-col items-center gap-1">
                      <button
                        type="button"
                        className={`w-full rounded-t-md bg-indigo-500/80 transition-all ${highlightedChartMonth === item.month ? "ring-2 ring-indigo-300/80" : ""}`}
                        style={{ height: `${height}%`, transition: "height 450ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                        onMouseEnter={() => setHighlightedChartMonth(item.month)}
                        onMouseLeave={() => setHighlightedChartMonth((current) => (current === item.month ? null : current))}
                        onClick={() => setHighlightedChartMonth((current) => (current === item.month ? null : item.month))}
                        aria-label={`Ver total de ${item.month}`}
                      />
                      {highlightedChartMonth === item.month ? (
                        <div className="absolute -top-10 z-10 rounded-md border border-slate-200/90 bg-white/95 px-2 py-1 text-[11px] shadow-md dark:border-white/15 dark:bg-[#0c1220]/95">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{item.month}</p>
                          <p className="text-slate-600 dark:text-slate-300">{formatCents(item.totalCents)}</p>
                        </div>
                      ) : null}
                      <p className={`text-[11px] ${isCurrent ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}>
                        {item.month.slice(5)}
                      </p>
                    </div>
                  );
                })}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <article
                id="novo-lancamento-form"
                ref={(node) => {
                  launchFormRef.current = node;
                }}
                className={cardBaseClass}
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Novo lançamento</h2>
                <div className="mt-3 space-y-2">
                  <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as BudgetCategory)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white">
                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                  <input type="text" inputMode="decimal" value={newAmount} onChange={(event) => setNewAmount(formatCurrencyInput(event.target.value))} placeholder="Valor em R$ (ex: 250,90)" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                  <textarea value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Observações (opcional)" className="h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleSave} disabled={isSaving || !newAmount} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar custo"}
                    </button>
                    {editingId ? (
                      <button type="button" onClick={() => { setEditingId(null); setNewAmount(""); setNewNotes(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                  {feedback ? <p className="text-xs text-slate-600 dark:text-slate-300">{feedback}</p> : null}
                </div>
              </article>

              <article className={cardBaseClass}>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Insights do mês</h2>
                <div className="mt-3 space-y-2">
                  {topInsights.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ainda não há histórico suficiente neste mês.</p>
                  ) : (
                    topInsights.map((insight) => (
                      <div key={insight.category} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {CATEGORIES.find((item) => item.value === insight.category)?.label ?? insight.category}
                        </p>
                        <p className={`mt-1 text-xs ${
                          insight.diffAmountCents > 0 ? "text-red-600 dark:text-red-300" :
                          insight.diffAmountCents < 0 ? "text-emerald-600 dark:text-emerald-300" :
                          "text-slate-500 dark:text-slate-400"
                        }`}>
                          {insight.diffAmountCents > 0 ? "Crescimento de consumo" : insight.diffAmountCents < 0 ? "Economia no período" : "Sem variação relevante"}: {formatCents(insight.diffAmountCents)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className={cardBaseClass}>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Metas por categoria</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  A meta sempre é salva para o mês selecionado em filtro. Se já existir, ela é atualizada automaticamente.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select value={goalCategory} onChange={(event) => setGoalCategory(event.target.value as BudgetCategory)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white">
                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                  <input type="text" inputMode="decimal" value={goalAmount} onChange={(event) => setGoalAmount(formatCurrencyInput(event.target.value))} placeholder="Meta R$" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white" />
                  <button type="button" onClick={() => void handleSaveGoal()} disabled={isSavingGoal || !goalAmount} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    {isSavingGoal ? "Salvando..." : "Salvar meta"}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {goalProgress.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma meta definida para este mês.</p> : goalProgress.map((goal) => (
                    <div
                      key={goal.id}
                      className={`rounded-xl border p-3 transition-all ${
                        goal.progress >= 100
                          ? "border-red-300/80 bg-gradient-to-r from-red-50 to-white dark:border-red-400/40 dark:from-red-950/30 dark:to-transparent"
                          : goal.progress >= 90
                            ? "border-amber-300/80 bg-gradient-to-r from-amber-50 to-white dark:border-amber-400/40 dark:from-amber-950/30 dark:to-transparent"
                            : "border-slate-200/80 dark:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{CATEGORIES.find((item) => item.value === goal.category)?.label ?? goal.category}</p>
                        <div className="flex items-center gap-2">
                          {editingGoalId === goal.id ? (
                            <>
                              <button type="button" onClick={() => void handleUpdateGoal(goal.id)} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Salvar</button>
                              <button type="button" onClick={() => { setEditingGoalId(null); setEditingGoalAmount(""); }} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Cancelar</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => { setEditingGoalId(goal.id); setEditingGoalAmount((goal.targetCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Editar</button>
                          )}
                          <button type="button" onClick={() => void handleDeleteGoal(goal.id)} className="text-[11px] font-semibold text-red-600 dark:text-red-300">Remover</button>
                        </div>
                      </div>
                      {editingGoalId === goal.id ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingGoalAmount}
                            onChange={(event) => setEditingGoalAmount(formatCurrencyInput(event.target.value))}
                            placeholder="Nova meta R$"
                            className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-[#111827] dark:text-white"
                          />
                        </div>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatCents(goal.spentCents)} de {formatCents(goal.targetCents)} ({goal.progress}%)
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className={`h-full ${goal.exceeded ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, goal.progress)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Distribuição por categoria</h2>
                {pieSegments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Adicione lançamentos para visualizar a distribuição.</p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                    <svg viewBox="0 0 42 42" className="h-44 w-44">
                      {pieSegments.map((segment) => {
                        const circumference = 2 * Math.PI * 15.9155;
                        const size = ((segment.end - segment.start) / 360) * circumference;
                        const offset = (segment.start / 360) * circumference;
                        return (
                          <circle
                            key={segment.category}
                            cx="21"
                            cy="21"
                            r="15.9155"
                            fill="transparent"
                            stroke={segment.color}
                            strokeWidth="6"
                            strokeDasharray={`${size} ${circumference - size}`}
                            strokeDashoffset={-offset}
                          />
                        );
                      })}
                    </svg>
                    <div className="space-y-2">
                      {pieSegments.map((segment) => (
                        <div key={segment.category} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/70 px-2.5 py-1.5 text-xs transition-colors dark:border-white/10 dark:bg-white/5">
                          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                            {CATEGORIES.find((item) => item.value === segment.category)?.label ?? segment.category}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCents(segment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </section>

            <section className={cardBaseClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Lançamentos de {selectedMonth}</h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {entries.length} item(ns)
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {entries.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum lançamento neste mês.</p>
                ) : (
                  <>
                    <div className="hidden rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 md:grid md:grid-cols-[1.2fr_2fr_0.8fr_0.8fr]">
                      <p>Categoria</p>
                      <p>Observação</p>
                      <p className="text-right">Valor</p>
                      <p className="text-right">Ações</p>
                    </div>
                    {entries.map((entry) => (
                      <article key={entry.id} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10 md:grid md:grid-cols-[1.2fr_2fr_0.8fr_0.8fr] md:items-center md:gap-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {CATEGORIES.find((item) => item.value === entry.category)?.label ?? entry.category}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:mt-0">{entry.notes || "Sem observações."}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white md:mt-0 md:text-right">{formatCents(entry.amountCents)}</p>
                        <div className="mt-2 flex items-center gap-2 md:mt-0 md:justify-end">
                          <button type="button" onClick={() => { setEditingId(entry.id); setNewCategory(entry.category); setNewAmount((entry.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); setNewNotes(entry.notes ?? ""); }} className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200">
                            Editar
                          </button>
                          <button type="button" onClick={() => void handleDelete(entry.id)} className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 dark:border-red-400/30 dark:text-red-300">
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </>
                )}
              </div>
            </section>
          </>
        ) : null}

      </div>
      {isClient && !isLoading && planTier === "PRO"
        ? createPortal(
            <Link
              href="/assistente-financeiro"
              className="fixed bottom-16 right-4 z-[999] inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/35 transition hover:bg-indigo-500 md:bottom-3 md:right-6"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">AI</span>
              Assistente financeiro
            </Link>,
            document.body,
          )
        : null}
    </AppShell>
  );
}
