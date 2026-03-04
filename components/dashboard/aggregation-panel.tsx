"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/lib/tax-utils";
import { getBonusTypeColor } from "@/lib/bonus-type-colors";
import { cn } from "@/lib/utils";

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
        name: f.name,
        total: map.get(f.id) || 0,
      }))
      .filter((r) => r.total > 0);
  }, [bonuses, funds, amountMode, monthStatuses, defaultTaxRate, year]);

  const grandTotal = useMemo(
    () => bonuses.reduce((s, b) => s + getDisplayAmount(b), 0),
    [bonuses, amountMode, monthStatuses, defaultTaxRate, year]
  );

  if (bonuses.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Общая сумма ({amountMode.toUpperCase()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {formatAmount(grandTotal)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            По типу премии
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            По фонду
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byFund.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {byFund.map((r) => (
                <div
                  key={r.name}
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
        </CardContent>
      </Card>
    </div>
  );
}
