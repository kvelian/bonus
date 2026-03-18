"use client";

import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import type {
  Employee,
  BonusType,
  Fund,
  BonusWithDetails,
  MonthStatus,
  AmountMode,
} from "@/lib/types";
import { BonusTable } from "./bonus-table";
import { AggregationPanel } from "./aggregation-panel";
import { BonusModal } from "./bonus-modal";
import { MonthStatusModal } from "./month-status-modal";
import { exportToCsv } from "@/lib/csv-export";
import {
  grossToNet,
  getEffectiveTaxRateSync,
} from "@/lib/tax-utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface DashboardClientProps {
  year: number;
  employees: Employee[];
  bonusTypes: BonusType[];
  funds: Fund[];
  bonuses: BonusWithDetails[];
  monthStatuses: MonthStatus[];
  defaultTaxRate: number;
  customIntroText: string;
  defaultBonusTypeId: number | null;
  defaultFundId: number | null;
}

export function DashboardClient({
  year,
  employees,
  bonusTypes,
  funds,
  bonuses,
  monthStatuses,
  defaultTaxRate,
  customIntroText,
  defaultBonusTypeId,
  defaultFundId,
}: DashboardClientProps) {
  const router = useRouter();
  const [isApplyPending, setIsApplyPending] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{
    total: number;
    processed: number;
    applied: number;
    errorsCount: number;
    currentEmployeeFullName: string;
  }>({
    total: 0,
    processed: 0,
    applied: 0,
    errorsCount: 0,
    currentEmployeeFullName: "",
  });

  const [errorsByEmployee, setErrorsByEmployee] = useState<
    Record<number, { employeeFullName: string; reasons: string[] }>
  >({});

  const eventSourceRef = useRef<EventSource | null>(null);

  const [applyMonth, setApplyMonth] = useState<string>(() => {
    const m = new Date().getMonth() + 1;
    return String(m);
  });
  const [amountMode, setAmountMode] = useState<AmountMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("bonus-amount-mode") as AmountMode) || "gross";
    }
    return "gross";
  });

  // Bonus modal state
  const [bonusModal, setBonusModal] = useState<{
    open: boolean;
    employeeId: number;
    month: number;
    editBonus?: BonusWithDetails;
  }>({ open: false, employeeId: 0, month: 0 });

  // Month status modal state
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    employeeId: number;
    month: number;
  }>({ open: false, employeeId: 0, month: 0 });

  const toggleAmountMode = () => {
    const newMode = amountMode === "gross" ? "net" : "gross";
    setAmountMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("bonus-amount-mode", newMode);
    }
  };

  const navigateYear = (delta: number) => {
    router.push(`/?year=${year + delta}`);
  };

  const handleExportCsv = useCallback(() => {
    exportToCsv(employees, bonuses, monthStatuses, defaultTaxRate, year, amountMode);
  }, [employees, bonuses, monthStatuses, defaultTaxRate, year, amountMode]);

  const handleApplyExternal = useCallback(() => {
    const month = parseInt(applyMonth, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      toast.error("Некорректный месяц");
      return;
    }

    // Reset UI state.
    setIsApplyPending(true);
    setApplyProgress({
      total: 0,
      processed: 0,
      applied: 0,
      errorsCount: 0,
      currentEmployeeFullName: "",
    });
    setErrorsByEmployee({});

    // Close previous stream if any.
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const source = new EventSource(`/api/external-apply?year=${year}&month=${month}`);
    eventSourceRef.current = source;

    source.onmessage = (evt) => {
      try {
        const frame = JSON.parse(evt.data) as
          | { type: "progress"; total: number; processed: number; applied: number; errorsCount: number; currentEmployeeId: number; currentEmployeeFullName: string }
          | { type: "error"; employeeId: number; employeeFullName: string; reason: string }
          | { type: "employeeCompleted"; employeeId: number; employeeFullName: string; succeeded: boolean; employeeApplied: number; employeeTotal: number }
          | { type: "done"; total: number; processed: number; applied: number; errorsCount: number };

        if (frame.type === "progress") {
          setApplyProgress({
            total: frame.total,
            processed: frame.processed,
            applied: frame.applied,
            errorsCount: frame.errorsCount,
            currentEmployeeFullName: frame.currentEmployeeFullName,
          });
          return;
        }

        if (frame.type === "error") {
          if (frame.employeeId < 0) return; // route-level error: handled ondone/dismiss
          setErrorsByEmployee((prev) => {
            const existing = prev[frame.employeeId];
            const next = { ...prev };
            next[frame.employeeId] = existing
              ? {
                  employeeFullName: frame.employeeFullName,
                  reasons: [...existing.reasons, frame.reason],
                }
              : {
                  employeeFullName: frame.employeeFullName,
                  reasons: [frame.reason],
                };
            return next;
          });
          return;
        }

        if (frame.type === "done") {
          source.close();
          eventSourceRef.current = null;
          setIsApplyPending(false);
          setApplyProgress((p) => ({
            ...p,
            total: frame.total,
            processed: frame.processed,
            applied: frame.applied,
            errorsCount: frame.errorsCount,
          }));
          if (frame.errorsCount > 0) {
            toast.error(
              `Готово с ошибками. Применено: ${frame.applied}. Ошибок: ${frame.errorsCount}`
            );
          } else {
            toast.success(`Готово. Применено премий: ${frame.applied}`);
          }
          router.refresh();
          return;
        }

        // employeeCompleted frame doesn't need special UI right now.
      } catch {
        // Ignore malformed frame.
      }
    };

    source.onerror = () => {
      // Usually happens on connection errors; route itself should always send `done`.
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsApplyPending(false);
      toast.error("Ошибка подключения к SSE");
    };
  }, [applyMonth, router, year]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const openBonusModal = useCallback(
    (employeeId: number, month: number, editBonus?: BonusWithDetails) => {
      setBonusModal({ open: true, employeeId, month, editBonus });
    },
    []
  );

  const openStatusModal = useCallback(
    (employeeId: number, month: number) => {
      setStatusModal({ open: true, employeeId, month });
    },
    []
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateYear(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold tabular-nums min-w-[4rem] text-center">
            {year}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateYear(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Label
            htmlFor="amount-mode"
            className="text-sm text-muted-foreground"
          >
            GROSS
          </Label>
          <Switch
            id="amount-mode"
            checked={amountMode === "net"}
            onCheckedChange={toggleAmountMode}
          />
          <Label
            htmlFor="amount-mode"
            className="text-sm text-muted-foreground"
          >
            NET
          </Label>
        </div>

        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>

        <div className="flex items-center gap-2">
          <Select value={applyMonth} onValueChange={setApplyMonth}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Месяц" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={isApplyPending}
            onClick={handleApplyExternal}
          >
            Применить
          </Button>
        </div>
      </div>

      {applyProgress.total > 0 && (
        <div className="mb-6">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  Прогресс:{" "}
                  <span className="tabular-nums">
                    {applyProgress.processed} из {applyProgress.total}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  сейчас:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {applyProgress.currentEmployeeFullName || "-"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  применено:{" "}
                  <span className="tabular-nums text-foreground font-medium">
                    {applyProgress.applied}
                  </span>{" "}
                  • ошибок:{" "}
                  <span className="tabular-nums text-foreground font-medium">
                    {applyProgress.errorsCount}
                  </span>
                </p>
              </div>

              <div className="min-w-[160px] max-w-[260px] w-full">
                <Progress
                  value={
                    applyProgress.total === 0
                      ? 0
                      : Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round((applyProgress.processed / applyProgress.total) * 100)
                          )
                        )
                  }
                />
              </div>
            </div>

            {Object.keys(errorsByEmployee).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Ошибки</p>
                <div className="flex flex-col gap-3">
                  {Object.entries(errorsByEmployee)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([employeeIdStr, agg]) => {
                      const reasonCounts = new Map<string, number>();
                      for (const r of agg.reasons) {
                        reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
                      }

                      return (
                        <div key={employeeIdStr} className="flex flex-col gap-1">
                          <p className="text-xs text-muted-foreground">
                            {agg.employeeFullName}{" "}
                            <span className="tabular-nums font-medium text-foreground">
                              ({agg.reasons.length})
                            </span>
                          </p>
                          <div className="text-xs text-muted-foreground">
                            {Array.from(reasonCounts.entries())
                              .map(([reason, count]) => (
                                <p key={reason} className="leading-snug">
                                  {reason}{" "}
                                  <span className="text-muted-foreground">
                                    (x{count})
                                  </span>
                                </p>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bonus Table */}
      <BonusTable
        year={year}
        employees={employees}
        bonuses={bonuses}
        bonusTypes={bonusTypes}
        funds={funds}
        monthStatuses={monthStatuses}
        defaultTaxRate={defaultTaxRate}
        amountMode={amountMode}
        customIntroText={customIntroText}
        onAddBonus={openBonusModal}
        onEditBonus={openBonusModal}
        onOpenStatusModal={openStatusModal}
      />

      {/* Aggregation Panel */}
      <AggregationPanel
        bonuses={bonuses}
        bonusTypes={bonusTypes}
        funds={funds}
        monthStatuses={monthStatuses}
        defaultTaxRate={defaultTaxRate}
        amountMode={amountMode}
        year={year}
      />

      {/* Modals */}
      <BonusModal
        open={bonusModal.open}
        onClose={() => setBonusModal({ open: false, employeeId: 0, month: 0 })}
        employeeId={bonusModal.employeeId}
        employeeFullName={employees.find((e) => e.id === bonusModal.employeeId)?.fullName}
        year={year}
        month={bonusModal.month}
        bonusTypes={bonusTypes}
        funds={funds}
        defaultTaxRate={defaultTaxRate}
        monthStatuses={monthStatuses}
        editBonus={bonusModal.editBonus}
        amountMode={amountMode}
        defaultBonusTypeId={defaultBonusTypeId}
        defaultFundId={defaultFundId}
      />

      <MonthStatusModal
        open={statusModal.open}
        onClose={() =>
          setStatusModal({ open: false, employeeId: 0, month: 0 })
        }
        employeeId={statusModal.employeeId}
        year={year}
        month={statusModal.month}
        monthStatuses={monthStatuses}
        customIntroText={customIntroText}
        defaultTaxRate={defaultTaxRate}
        bonuses={bonuses}
        amountMode={amountMode}
      />
    </div>
  );
}
