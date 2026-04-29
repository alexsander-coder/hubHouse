"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

type RiskLevel = "BAIXO" | "MODERADO" | "ALTO";

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

function shiftMonthRef(monthRef: string, offset: number): string {
  const [yearRaw, monthRaw] = monthRef.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatCents(amountCents: number): string {
  return (amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

export default function AssistenteFinanceiroPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [larNome, setLarNome] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("FREE");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [historySummaries, setHistorySummaries] = useState<BudgetSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthRef());
  const [isApplyingSuggestedGoals, setIsApplyingSuggestedGoals] = useState(false);
  const [suggestionFeedback, setSuggestionFeedback] = useState<string | null>(null);
  const [simCategory, setSimCategory] = useState<BudgetCategory>("SUPERMERCADO");
  const [simReductionValue, setSimReductionValue] = useState("0,00");
  const [weeklyChecklist, setWeeklyChecklist] = useState([
    { id: "check-1", label: "Revisar top 3 despesas da semana", done: false },
    { id: "check-2", label: "Registrar todos os gastos variáveis", done: false },
    { id: "check-3", label: "Comparar gasto real com metas", done: false },
  ]);
  const [commitmentTargetValue, setCommitmentTargetValue] = useState("300,00");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const token = session.accessToken;
    setAccessToken(token);

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
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o assistente.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadBase();
  }, [router]);

  useEffect(() => {
    const checklistRaw = window.localStorage.getItem("financialAssistantChecklist");
    const commitmentRaw = window.localStorage.getItem("financialAssistantCommitment");
    if (checklistRaw) {
      try {
        const parsed = JSON.parse(checklistRaw) as Array<{ id: string; label: string; done: boolean }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWeeklyChecklist(parsed);
        }
      } catch {
        // noop
      }
    }
    if (commitmentRaw) {
      setCommitmentTargetValue(commitmentRaw);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("financialAssistantChecklist", JSON.stringify(weeklyChecklist));
  }, [weeklyChecklist]);

  useEffect(() => {
    window.localStorage.setItem("financialAssistantCommitment", commitmentTargetValue);
  }, [commitmentTargetValue]);

  useEffect(() => {
    if (!accessToken || !householdId || planTier !== "PRO") return;

    async function loadSummary() {
      try {
        const historyMonths = Array.from({ length: 6 }).map((_, index) => shiftMonthRef(selectedMonth, -5 + index));
        const responses = await Promise.all(
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
        const parsed = responses.map((response) => response.dados.summary);
        setHistorySummaries(parsed);
        setSummary(parsed[parsed.length - 1] ?? null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar as recomendações.");
      }
    }

    void loadSummary();
  }, [accessToken, householdId, planTier, selectedMonth]);

  const topGrowth = useMemo(() => {
    if (!summary) return [];
    return [...summary.categories]
      .filter((item) => item.diffAmountCents > 0)
      .sort((a, b) => b.diffAmountCents - a.diffAmountCents)
      .slice(0, 3);
  }, [summary]);

  const projection = useMemo(() => {
    if (!summary) return { totalProjectedCents: 0, byCategory: new Map<BudgetCategory, number>() };

    const totals = historySummaries.map((item) => item.currentTotalCents).filter((item) => item > 0);
    const weightedTotal =
      totals.length === 0
        ? summary.currentTotalCents
        : totals.length === 1
          ? totals[0]
          : totals.length === 2
            ? Math.round(totals[0] * 0.4 + totals[1] * 0.6)
            : Math.round(totals[totals.length - 3] * 0.2 + totals[totals.length - 2] * 0.3 + totals[totals.length - 1] * 0.5);

    const byCategory = new Map<BudgetCategory, number>();
    for (const category of CATEGORIES.map((item) => item.value)) {
      const series = historySummaries.map((item) => item.categories.find((entry) => entry.category === category)?.currentAmountCents ?? 0);
      const projected =
        series.length === 0
          ? 0
          : series.length === 1
            ? series[0]
            : series.length === 2
              ? Math.round(series[0] * 0.4 + series[1] * 0.6)
              : Math.round(series[series.length - 3] * 0.2 + series[series.length - 2] * 0.3 + series[series.length - 1] * 0.5);
      byCategory.set(category, projected);
    }

    return { totalProjectedCents: weightedTotal, byCategory };
  }, [historySummaries, summary]);

  const financialScore = useMemo(() => {
    if (!summary) return 50;

    const goals = summary.goals ?? [];
    const adherencePenalty =
      goals.length === 0
        ? 15
        : Math.min(
            35,
            goals.filter((goal) => (summary.categories.find((item) => item.category === goal.category)?.currentAmountCents ?? 0) > goal.targetCents).length *
              (35 / goals.length),
          );

    const trendPenalty = summary.diffTotalCents > 0 ? Math.min(25, Math.abs(summary.diffTotalCents / Math.max(summary.previousTotalCents, 1)) * 100 * 0.25) : 0;

    const totals = historySummaries.map((item) => item.currentTotalCents);
    const avg = totals.length > 0 ? totals.reduce((sum, item) => sum + item, 0) / totals.length : 0;
    const variance = totals.length > 1 ? totals.reduce((sum, item) => sum + (item - avg) ** 2, 0) / totals.length : 0;
    const std = Math.sqrt(variance);
    const volatilityRatio = avg > 0 ? std / avg : 0;
    const volatilityPenalty = Math.min(20, volatilityRatio * 100 * 0.2);

    const totalTarget = goals.reduce((sum, goal) => sum + goal.targetCents, 0);
    const pressurePenalty = totalTarget > 0 ? Math.min(20, Math.max(0, ((projection.totalProjectedCents - totalTarget) / totalTarget) * 100 * 0.2)) : 8;

    const score = Math.round(100 - adherencePenalty - trendPenalty - volatilityPenalty - pressurePenalty);
    return Math.max(0, Math.min(100, score));
  }, [summary, historySummaries, projection.totalProjectedCents]);

  const scoreLabel = useMemo(() => {
    if (financialScore >= 75) return "Saudável";
    if (financialScore >= 50) return "Atenção";
    return "Crítico";
  }, [financialScore]);

  const analysisConfidence = useMemo(() => {
    if (!summary) return { label: "Baixa", reason: "Sem dados suficientes." };
    const goalsCount = (summary.goals ?? []).length;
    const monthsCount = historySummaries.filter((item) => item.currentTotalCents > 0).length;
    if (monthsCount >= 5 && goalsCount >= 3) {
      return { label: "Alta", reason: "Histórico e metas suficientes para projeções estáveis." };
    }
    if (monthsCount >= 3 && goalsCount >= 1) {
      return { label: "Média", reason: "Boa base de dados, mas ainda com espaço para melhorar precisão." };
    }
    return { label: "Baixa", reason: "Pouco histórico ou poucas metas definidas. As recomendações são iniciais." };
  }, [historySummaries, summary]);

  const riskByCategory = useMemo(() => {
    if (!summary) return [] as Array<{ category: BudgetCategory; projectedCents: number; targetCents: number; probability: number; risk: RiskLevel }>;
    return (summary.goals ?? []).map((goal) => {
      const projected = projection.byCategory.get(goal.category) ?? 0;
      const series = historySummaries.map((item) => item.categories.find((entry) => entry.category === goal.category)?.currentAmountCents ?? 0);
      const avg = series.length > 0 ? series.reduce((sum, item) => sum + item, 0) / series.length : 0;
      const variance = series.length > 1 ? series.reduce((sum, item) => sum + (item - avg) ** 2, 0) / series.length : 0;
      const std = Math.sqrt(variance);
      const volatilityBoost = goal.targetCents > 0 ? (std / goal.targetCents) * 0.3 : 0;
      const base = goal.targetCents > 0 ? projected / goal.targetCents : 0;
      const probability = Math.max(0, Math.min(100, Math.round((base + volatilityBoost) * 100)));
      const risk: RiskLevel = probability > 90 ? "ALTO" : probability >= 70 ? "MODERADO" : "BAIXO";
      return { category: goal.category, projectedCents: projected, targetCents: goal.targetCents, probability, risk };
    });
  }, [summary, projection.byCategory, historySummaries]);

  const actionPlan = useMemo(() => {
    if (!summary) return [] as string[];
    const prioritized = riskByCategory
      .map((item) => ({
        ...item,
        impactCents: Math.max(0, item.projectedCents - item.targetCents),
      }))
      .sort((a, b) => b.impactCents - a.impactCents)
      .slice(0, 3);

    const items = prioritized
      .filter((item) => item.impactCents > 0)
      .map((item) => {
        const label = CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category;
        return `Prioridade ${item.risk === "ALTO" ? "alta" : "média"}: ajustar ${label} para reduzir ${formatCents(item.impactCents)} no fechamento estimado.`;
      });

    if (items.length === 0) {
      items.push("Seu cenário está equilibrado. Continue registrando despesas para manter previsões precisas.");
    }
    return items;
  }, [summary, riskByCategory]);

  const simulatorProjection = useMemo(() => {
    if (!summary) {
      return {
        currentProjectedCents: 0,
        reducedProjectedCents: 0,
        impactCents: 0,
      };
    }
    const reductionReais = parseCurrencyInputToNumber(simReductionValue);
    const reductionCents = Number.isFinite(reductionReais) ? Math.max(0, Math.round(reductionReais * 100)) : 0;
    const currentProjected = projection.totalProjectedCents;
    const reducedProjected = Math.max(0, currentProjected - reductionCents);
    return {
      currentProjectedCents: currentProjected,
      reducedProjectedCents: reducedProjected,
      impactCents: currentProjected - reducedProjected,
    };
  }, [projection.totalProjectedCents, simReductionValue, summary]);

  const commitmentProgress = useMemo(() => {
    const targetReais = parseCurrencyInputToNumber(commitmentTargetValue);
    const targetCents = Number.isFinite(targetReais) ? Math.max(0, Math.round(targetReais * 100)) : 0;
    const achievedCents = Math.max(0, -(summary?.diffTotalCents ?? 0));
    const percent = targetCents > 0 ? Math.min(100, Math.round((achievedCents / targetCents) * 100)) : 0;
    return { targetCents, achievedCents, percent };
  }, [commitmentTargetValue, summary]);

  const completedChecklistCount = useMemo(
    () => weeklyChecklist.filter((item) => item.done).length,
    [weeklyChecklist],
  );

  const simulatorImpactLevel = useMemo(() => {
    const base = simulatorProjection.currentProjectedCents;
    if (base <= 0) return { label: "Sem impacto", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    const ratio = simulatorProjection.impactCents / base;
    if (ratio >= 0.12) return { label: "Impacto alto", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" };
    if (ratio >= 0.05) return { label: "Impacto médio", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" };
    return { label: "Impacto baixo", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  }, [simulatorProjection]);

  const seasonalityInsights = useMemo(() => {
    if (historySummaries.length < 4) return [] as string[];

    const messages: string[] = [];
    const monthTotals = historySummaries.map((item) => ({
      month: item.month,
      total: item.currentTotalCents,
    }));
    const average = monthTotals.reduce((sum, item) => sum + item.total, 0) / monthTotals.length;
    const highestMonth = [...monthTotals].sort((a, b) => b.total - a.total)[0];
    const lowestMonth = [...monthTotals].sort((a, b) => a.total - b.total)[0];
    if (highestMonth && average > 0 && highestMonth.total > average * 1.12) {
      messages.push(
        `Em ${highestMonth.month} você gastou ${Math.round(((highestMonth.total - average) / average) * 100)}% a mais do que sua média recente.`,
      );
    }
    if (lowestMonth && average > 0 && lowestMonth.total < average * 0.9) {
      messages.push(
        `Em ${lowestMonth.month} você gastou ${Math.round(((average - lowestMonth.total) / average) * 100)}% a menos que sua média.`,
      );
    }

    const categoryPeaks = CATEGORIES.map((category) => {
      const label = category.label;
      const series = historySummaries.map((item) => ({
        month: item.month,
        value: item.categories.find((entry) => entry.category === category.value)?.currentAmountCents ?? 0,
      }));
      const avg = series.reduce((sum, item) => sum + item.value, 0) / series.length;
      const peak = [...series].sort((a, b) => b.value - a.value)[0];
      if (!peak || avg <= 0 || peak.value <= avg * 1.25) return null;
      return `${label} costuma pesar mais em ${peak.month}, com ${Math.round(((peak.value - avg) / avg) * 100)}% acima do normal da categoria.`;
    }).filter(Boolean) as string[];

    messages.push(...categoryPeaks.slice(0, 2));
    return messages.slice(0, 4);
  }, [historySummaries]);

  const nextMonthGoalSuggestions = useMemo(() => {
    if (!summary) return [] as Array<{ category: BudgetCategory; suggestedCents: number; rationale: string; risk: RiskLevel | "N/A" }>;
    const categoryRisk = new Map(riskByCategory.map((item) => [item.category, item]));

    return CATEGORIES.map((category) => {
      const current = summary.categories.find((item) => item.category === category.value)?.currentAmountCents ?? 0;
      const projected = projection.byCategory.get(category.value) ?? current;
      const existingGoal = (summary.goals ?? []).find((goal) => goal.category === category.value)?.targetCents;
      const base = existingGoal ?? projected;
      const risk = categoryRisk.get(category.value);

      let factor = 0.98;
      if (risk?.risk === "ALTO") factor = 0.9;
      else if (risk?.risk === "MODERADO") factor = 0.94;
      else if (current <= 0) factor = 1;

      const suggested = Math.max(0, Math.round(base * factor));
      const rationale =
        risk?.risk === "ALTO"
          ? "Essa categoria costuma estourar; vale reduzir a meta para ter mais controle."
          : risk?.risk === "MODERADO"
            ? "Essa categoria oscila; ajuste leve para evitar surpresas."
            : "Categoria estável; meta pensada para manter o ritmo atual.";
      return {
        category: category.value,
        suggestedCents: suggested,
        rationale,
        risk: risk?.risk ?? "N/A",
      };
    })
      .filter((item) => item.suggestedCents > 0)
      .sort((a, b) => b.suggestedCents - a.suggestedCents)
      .slice(0, 6);
  }, [summary, projection.byCategory, riskByCategory]);

  const nextMonthRef = useMemo(() => shiftMonthRef(selectedMonth, 1), [selectedMonth]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  async function handleApplySuggestedGoals(onlyHighRisk = false) {
    const suggestionsToApply = onlyHighRisk
      ? nextMonthGoalSuggestions.filter((item) => item.risk === "ALTO")
      : nextMonthGoalSuggestions;
    if (!accessToken || !householdId || suggestionsToApply.length === 0) {
      setSuggestionFeedback(
        onlyHighRisk
          ? "Não há categorias com risco alto para aplicar neste mês."
          : "Sem sugestões disponíveis para aplicar.",
      );
      return;
    }

    try {
      setIsApplyingSuggestedGoals(true);
      setSuggestionFeedback(null);

      const existingGoalsResponse = await apiRequest<{ items: Array<{ id: string; category: BudgetCategory }> }>(
        `/budgets/households/${householdId}/goals?month=${nextMonthRef}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const existingByCategory = new Map(
        existingGoalsResponse.dados.items.map((goal) => [goal.category, goal.id]),
      );

      for (const suggestion of suggestionsToApply) {
        const existingId = existingByCategory.get(suggestion.category);
        if (existingId) {
          await apiRequest(`/budgets/households/${householdId}/goals/${existingId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: { targetCents: suggestion.suggestedCents },
          });
        } else {
          await apiRequest(`/budgets/households/${householdId}/goals`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: {
              category: suggestion.category,
              competenceMonth: nextMonthRef,
              targetCents: suggestion.suggestedCents,
            },
          });
        }
      }

      setSuggestionFeedback(
        onlyHighRisk
          ? `Metas de risco alto aplicadas com sucesso para ${nextMonthRef}.`
          : `Metas sugeridas aplicadas com sucesso para ${nextMonthRef}.`,
      );
    } catch (error) {
      setSuggestionFeedback(error instanceof Error ? error.message : "Não foi possível aplicar as metas sugeridas.");
    } finally {
      setIsApplyingSuggestedGoals(false);
    }
  }

  function toggleChecklist(id: string) {
    setWeeklyChecklist((current) =>
      current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  }

  return (
    <AppShell activeKey="despesas" larNome={larNome} userName={userName || "Usuário"} userEmail={userEmail || "..."} onLogout={handleLogout}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Assistente Financeiro</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Auxílio financeiro baseado nos seus dados</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Uma visão dedicada para orientar decisões e reduzir gastos com base no comportamento da casa.
          </p>
          <div className="mt-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white"
            />
          </div>
          <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              O que você quer melhorar hoje?
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById("card-economizar")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                Economizar
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("card-organizar")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Organizar
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("card-planejar")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                Planejar
              </button>
            </div>
          </div>
        </section>

        {isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Carregando assistente...</p> : null}
        {errorMessage ? <p className="text-sm text-red-600 dark:text-red-300">{errorMessage}</p> : null}

        {!isLoading && planTier !== "PRO" ? (
          <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 dark:border-amber-400/40 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Disponível no plano PRO</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Faça upgrade para usar o assistente financeiro com recomendações baseadas em dados.
            </p>
          </section>
        ) : null}

        {!isLoading && planTier === "PRO" && summary ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <article className="rounded-xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total do mês</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatCents(summary.currentTotalCents)}</p>
              </article>
              <article className="rounded-xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Variação mensal</p>
                <p className={`mt-2 text-2xl font-semibold ${summary.diffTotalCents > 0 ? "text-red-600 dark:text-red-300" : summary.diffTotalCents < 0 ? "text-emerald-600 dark:text-emerald-300" : "text-slate-900 dark:text-white"}`}>
                  {formatCents(summary.diffTotalCents)}
                </p>
              </article>
              <article className="rounded-xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Estimativa até o fim do mês</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatCents(projection.totalProjectedCents)}
                </p>
              </article>
              <article className="rounded-xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Saúde financeira</p>
                <p className={`mt-2 text-2xl font-semibold ${financialScore >= 75 ? "text-emerald-600 dark:text-emerald-300" : financialScore >= 50 ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-300"}`}>
                  {financialScore}/100
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{scoreLabel}</p>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Precisão das recomendações</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  analysisConfidence.label === "Alta"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : analysisConfidence.label === "Média"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}>
                  Precisão {analysisConfidence.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{analysisConfidence.reason}</p>
              {analysisConfidence.label !== "Alta" ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Dica: mantenha pelo menos 3 meses de lançamentos e metas em 3+ categorias para recomendações mais precisas.
                </p>
              ) : null}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Categorias que mais cresceram</h2>
                <div className="mt-3 space-y-2">
                  {topGrowth.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Nenhuma categoria com crescimento relevante neste mês.</p>
                  ) : (
                    topGrowth.map((item) => (
                      <div key={item.category} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category}
                        </p>
                        <p className="mt-1 text-xs text-red-600 dark:text-red-300">+ {formatCents(item.diffAmountCents)} vs mês anterior</p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article id="card-economizar" className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Próximos passos sugeridos</h2>
                <div className="mt-3 space-y-2">
                  {actionPlan.map((item) => (
                    <div key={item} className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm text-slate-700 dark:text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Simulador rápido</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Responda: <span className="font-semibold">quanto você consegue reduzir</span> nesta categoria ainda neste mês?
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Exemplo: se você digitar <span className="font-semibold">200,00</span>, o simulador calcula como ficaria seu fechamento reduzindo R$ 200 nessa categoria.
                </p>
                <div className="mt-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Como usar (3 passos)</p>
                  <ol className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <li>1. Escolha a categoria onde você acha que consegue economizar.</li>
                    <li>2. Digite o valor que pretende reduzir neste mês.</li>
                    <li>3. Compare os dois cenários e use o impacto para definir sua ação.</li>
                  </ol>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <select
                    value={simCategory}
                    onChange={(event) => setSimCategory(event.target.value as BudgetCategory)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={simReductionValue}
                    onChange={(event) => setSimReductionValue(formatCurrencyInput(event.target.value))}
                    placeholder="Quanto consegue reduzir (R$)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Esta é uma simulação. Ela <span className="font-semibold">não altera seus lançamentos</span>, só ajuda na tomada de decisão.
                </p>
                <div className="mt-3 space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sem ajuste (cenário atual)</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCents(simulatorProjection.currentProjectedCents)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Com a redução simulada em {CATEGORIES.find((item) => item.value === simCategory)?.label ?? simCategory}</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{formatCents(simulatorProjection.reducedProjectedCents)}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Economia possível: {formatCents(simulatorProjection.impactCents)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${simulatorImpactLevel.tone}`}>
                      {simulatorImpactLevel.label}
                    </span>
                  </div>
                </div>
              </article>

              <article id="card-organizar" className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Checklist semanal</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Conclusão da semana: {completedChecklistCount}/{weeklyChecklist.length}
                </p>
                <div className="mt-3 space-y-2">
                  {weeklyChecklist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklist(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                        item.done
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs font-semibold">{item.done ? "Feito" : "Pendente"}</span>
                    </button>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Compromisso do mês</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Defina uma meta prática de economia e acompanhe o progresso automaticamente.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={commitmentTargetValue}
                  onChange={(event) => setCommitmentTargetValue(formatCurrencyInput(event.target.value))}
                  placeholder="Meta de economia em R$"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827] dark:text-white"
                />
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  Progresso: {commitmentProgress.percent}%
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {formatCents(commitmentProgress.achievedCents)} de {formatCents(commitmentProgress.targetCents)} economizados no período.
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${commitmentProgress.percent}%` }} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Categorias que podem sair do controle</h2>
              <div className="mt-3 space-y-2">
                {riskByCategory.length === 0 ? (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                    <p className="text-sm text-slate-700 dark:text-slate-200">Defina metas em Despesas para ativar este acompanhamento.</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Sem metas, mostramos tendências, mas não dá para estimar chance de ultrapassar o limite de cada categoria.
                    </p>
                  </div>
                ) : (
                  riskByCategory
                    .sort((a, b) => b.probability - a.probability)
                    .map((item) => (
                      <div key={item.category} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.risk === "ALTO"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                                : item.risk === "MODERADO"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            }`}
                          >
                            {item.risk} ({item.probability}%)
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          Projeção {formatCents(item.projectedCents)} x Meta {formatCents(item.targetCents)}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Padrões dos seus gastos</h2>
                <div className="mt-3 space-y-2">
                  {seasonalityInsights.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Ainda não temos histórico suficiente para identificar padrões claros. Continue registrando os próximos meses.
                    </p>
                  ) : (
                    seasonalityInsights.map((insight) => (
                      <div key={insight} className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-sm text-slate-700 dark:text-slate-200">{insight}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article id="card-planejar" className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Metas recomendadas para o próximo mês</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Valores sugeridos com base no seu histórico e no risco de cada categoria.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApplySuggestedGoals(false)}
                    disabled={isApplyingSuggestedGoals || nextMonthGoalSuggestions.length === 0}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {isApplyingSuggestedGoals ? "Aplicando..." : `Aplicar metas em ${nextMonthRef}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApplySuggestedGoals(true)}
                    disabled={isApplyingSuggestedGoals || nextMonthGoalSuggestions.filter((item) => item.risk === "ALTO").length === 0}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    Aplicar apenas risco alto
                  </button>
                  {suggestionFeedback ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{suggestionFeedback}</p>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {nextMonthGoalSuggestions.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Sem dados suficientes para sugerir metas.</p>
                  ) : (
                    nextMonthGoalSuggestions.map((item) => (
                      <div key={item.category} className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {CATEGORIES.find((category) => category.value === item.category)?.label ?? item.category}
                          </p>
                          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{formatCents(item.suggestedCents)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.rationale}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          </>
        ) : null}

        <Link
          href="/despesas"
          className="fixed bottom-24 right-4 z-40 inline-flex items-center rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-slate-800 md:bottom-6 md:right-6 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Voltar para Despesas
        </Link>
      </div>
    </AppShell>
  );
}
