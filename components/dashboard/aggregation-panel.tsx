"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BonusType,
  Fund,
  BonusWithDetails,
  MonthStatus,
  AmountMode,
} from "@/lib/types";
import {
  grossToNet,
  getEffectiveTaxRateSync,
  formatAmount,
  MONTH_NAMES,
  QUARTER_LABELS,
} from "@/lib/tax-utils";
import { getBonusTypeColor } from "@/lib/bonus-type-colors";
import { cn } from "@/lib/utils";

type AggregationView = "year" | "month" | "quarter";

interface AggregationPanelProps {
  bonuses: BonusWithDetails[];
  bonusTypes: BonusType[];
  funds: Fund[];
  monthStatuses: MonthStatus[];
  defaultTaxRate: number;
  amountMode: AmountMode;
  year: number;
}

export function AggregationPanel({
  bonuses,
  bonusTypes,
  funds,
  monthStatuses,
  defaultTaxRate,
  amountMode,
  year,
}: AggregationPanelProps) {
  const getDisplayAmount = (bonus: BonusWithDetails) => {
    if (amountMode === "gross") return bonus.amountGross;
    const taxRate = getEffectiveTaxRateSync(
      bonus.employeeId,
      year,
      bonus.month,
      monthStatuses,
      defaultTaxRate
    );
    return grossToNet(bonus.amountGross, taxRate);
  };

  const byBonusType = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of bonuses) {
      const current = map.get(b.bonusTypeId) || 0;
      map.set(b.bonusTypeId, current + getDisplayAmount(b));
    }
    return bonusTypes
      .map((bt) => ({
        id: bt.id,
        name: bt.name,
        total: map.get(bt.id) || 0,
      }))
      .filter((r) => r.total > 0);
  }, [bonuses, bonusTypes, amountMode, monthStatuses, defaultTaxRate, year]);

  const byFund = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of bonuses) {
      const current = map.get(b.fundId) || 0;
      map.set(b.fundId, current + getDisplayAmount(b));
    }
    return funds
      .map((f) => ({
        id: f.id,
        name: f.name,
        total: map.get(f.id) || 0,
      }))
      .filter((r) => r.total > 0);
  }, [bonuses, funds, amountMode, monthStatuses, defaultTaxRate, year]);

  const grandTotal = useMemo(
    () => bonuses.reduce((s, b) => s + getDisplayAmount(b), 0),
    [bonuses, amountMode, monthStatuses, defaultTaxRate, year]
  );

  // По месяцам: 12 значений
  const byMonth = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const b of bonuses) {
      arr[b.month - 1] += getDisplayAmount(b);
    }
    return arr;
  }, [bonuses, amountMode, monthStatuses, defaultTaxRate, year]);

  // По кварталам: 4 значения
  const byQuarter = useMemo(() => {
    const arr = [0, 0, 0, 0];
    for (const b of bonuses) {
      const qi = Math.floor((b.month - 1) / 3);
      arr[qi] += getDisplayAmount(b);
    }
    return arr;
  }, [bonuses, amountMode, monthStatuses, defaultTaxRate, year]);

  // По типу премии по месяцам
  const byBonusTypeByMonth = useMemo(() => {
    const map = new Map<number, number[]>();
    bonusTypes.forEach((bt) => map.set(bt.id, Array(12).fill(0)));
    for (const b of bonuses) {
      const amt = getDisplayAmount(b);
      const arr = map.get(b.bonusTypeId)!;
      arr[b.month - 1] += amt;
    }
    return bonusTypes
      .map((bt) => ({ id: bt.id, name: bt.name, months: map.get(bt.id) || Array(12).fill(0) }))
      .filter((r) => r.months.some((v) => v > 0));
  }, [bonuses, bonusTypes, amountMode, monthStatuses, defaultTaxRate, year]);

  // По фонду по месяцам
  const byFundByMonth = useMemo(() => {
    const map = new Map<number, number[]>();
    funds.forEach((f) => map.set(f.id, Array(12).fill(0)));
    for (const b of bonuses) {
      const amt = getDisplayAmount(b);
      const arr = map.get(b.fundId)!;
      arr[b.month - 1] += amt;
    }
    return funds
      .map((f) => ({ id: f.id, name: f.name, months: map.get(f.id) || Array(12).fill(0) }))
      .filter((r) => r.months.some((v) => v > 0));
  }, [bonuses, funds, amountMode, monthStatuses, defaultTaxRate, year]);

  const monthsToQuarters = (months: number[]) =>
    [0, 1, 2, 3].map((qi) => months.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0));

  const [view, setView] = useState<AggregationView>("year");

  if (bonuses.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as AggregationView)}>
        <TabsList className="grid w-full max-w-xs grid-cols-3">
          <TabsTrigger value="year">За год</TabsTrigger>
          <TabsTrigger value="month">По месяцам</TabsTrigger>
          <TabsTrigger value="quarter">По кварталам</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Общая сумма ({amountMode.toUpperCase()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view === "year" && (
              <p className="text-2xl font-bold tabular-nums">
                {formatAmount(grandTotal)}
              </p>
            )}
            {view === "month" && (
              <div className="space-y-1.5 text-sm overflow-x-auto">
                <div className="grid grid-cols-3 gap-x-2 gap-y-1 min-w-[280px]">
                  {MONTH_NAMES.map((m, i) => (
                    <div key={m} className="flex justify-between gap-2">
                      <span className="text-muted-foreground truncate">{m}</span>
                      <span className="tabular-nums font-medium shrink-0">
                        {byMonth[i] > 0 ? formatAmount(byMonth[i]) : "\u2014"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="pt-2 border-t text-base font-bold tabular-nums">
                  Итого: {formatAmount(grandTotal)}
                </p>
              </div>
            )}
            {view === "quarter" && (
              <div className="space-y-1.5 text-sm">
                {QUARTER_LABELS.map((q, i) => (
                  <div key={q} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{q}</span>
                    <span className="tabular-nums font-medium">
                      {byQuarter[i] > 0 ? formatAmount(byQuarter[i]) : "\u2014"}
                    </span>
                  </div>
                ))}
                <p className="pt-2 border-t text-base font-bold tabular-nums">
                  Итого: {formatAmount(grandTotal)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              По типу премии
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view === "year" && (
              <>
                {byBonusType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {byBonusType.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-sm gap-2"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <span
                            className={cn(
                              "shrink-0 w-2 h-2 rounded-full",
                              getBonusTypeColor(r.id)
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{r.name}</span>
                        </span>
                        <span className="font-medium tabular-nums shrink-0">
                          {formatAmount(r.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {view === "month" && (
              <div className="space-y-3 text-xs overflow-x-auto max-h-[320px] overflow-y-auto">
                {byBonusTypeByMonth.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных</p>
                ) : (
                  byBonusTypeByMonth.map((r) => (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span
                          className={cn(
                            "shrink-0 w-2 h-2 rounded-full",
                            getBonusTypeColor(r.id)
                          )}
                          aria-hidden
                        />
                        {r.name}
                      </div>
                      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 pl-3.5 text-muted-foreground">
                        {MONTH_NAMES.map((m, i) => (
                          <div key={m} className="flex justify-between gap-1">
                            <span>{m}</span>
                            <span className="tabular-nums">
                              {r.months[i] > 0 ? formatAmount(r.months[i]) : "\u2014"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="pl-3.5 text-right font-medium tabular-nums border-t pt-1">
                        {formatAmount(r.months.reduce((a, b) => a + b, 0))}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
            {view === "quarter" && (
              <div className="space-y-3 text-xs">
                {byBonusTypeByMonth.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных</p>
                ) : (
                  byBonusTypeByMonth.map((r) => {
                    const qq = monthsToQuarters(r.months);
                    return (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span
                            className={cn(
                              "shrink-0 w-2 h-2 rounded-full",
                              getBonusTypeColor(r.id)
                            )}
                            aria-hidden
                          />
                          {r.name}
                        </div>
                        <div className="pl-3.5 space-y-0.5">
                          {QUARTER_LABELS.map((q, i) => (
                            <div key={q} className="flex justify-between gap-2 text-muted-foreground">
                              <span>{q}</span>
                              <span className="tabular-nums">
                                {qq[i] > 0 ? formatAmount(qq[i]) : "\u2014"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="pl-3.5 text-right font-medium tabular-nums border-t pt-1">
                          {formatAmount(r.months.reduce((a, b) => a + b, 0))}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              По фонду
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view === "year" && (
              <>
                {byFund.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {byFund.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{r.name}</span>
                        <span className="font-medium tabular-nums">
                          {formatAmount(r.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {view === "month" && (
              <div className="space-y-3 text-xs overflow-x-auto max-h-[320px] overflow-y-auto">
                {byFundByMonth.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных</p>
                ) : (
                  byFundByMonth.map((r) => (
                    <div key={r.id} className="space-y-1">
                      <div className="font-medium">{r.name}</div>
                      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 pl-3.5 text-muted-foreground">
                        {MONTH_NAMES.map((m, i) => (
                          <div key={m} className="flex justify-between gap-1">
                            <span>{m}</span>
                            <span className="tabular-nums">
                              {r.months[i] > 0 ? formatAmount(r.months[i]) : "\u2014"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="pl-3.5 text-right font-medium tabular-nums border-t pt-1">
                        {formatAmount(r.months.reduce((a, b) => a + b, 0))}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
            {view === "quarter" && (
              <div className="space-y-3 text-xs">
                {byFundByMonth.length === 0 ? (
                  <p className="text-muted-foreground">Нет данных</p>
                ) : (
                  byFundByMonth.map((r) => {
                    const qq = monthsToQuarters(r.months);
                    return (
                      <div key={r.id} className="space-y-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="pl-3.5 space-y-0.5">
                          {QUARTER_LABELS.map((q, i) => (
                            <div key={q} className="flex justify-between gap-2 text-muted-foreground">
                              <span>{q}</span>
                              <span className="tabular-nums">
                                {qq[i] > 0 ? formatAmount(qq[i]) : "\u2014"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="pl-3.5 text-right font-medium tabular-nums border-t pt-1">
                          {formatAmount(r.months.reduce((a, b) => a + b, 0))}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
