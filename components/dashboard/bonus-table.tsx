"use client";

import { useState, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Employee,
  BonusType,
  Fund,
  BonusWithDetails,
  MonthStatus,
  AmountMode,
} from "@/lib/types";
import {
  grossToNet,
  getEffectiveTaxRateSync,
  getMonthStatusForEmployee,
  MONTH_NAMES,
  QUARTER_LABELS,
  QUARTER_MONTHS,
  formatAmount,
} from "@/lib/tax-utils";
import { getBonusTypeColor } from "@/lib/bonus-type-colors";
import { deleteBonus } from "@/lib/actions";
import { handleGenerateNotification } from "./(helpers)/handleGenerateNotification";

interface BonusTableProps {
  year: number;
  employees: Employee[];
  bonuses: BonusWithDetails[];
  bonusTypes: BonusType[];
  funds: Fund[];
  monthStatuses: MonthStatus[];
  defaultTaxRate: number;
  amountMode: AmountMode;
  customIntroText: string;
  onAddBonus: (employeeId: number, month: number) => void;
  onEditBonus: (
    employeeId: number,
    month: number,
    bonus: BonusWithDetails
  ) => void;
  onOpenStatusModal: (employeeId: number, month: number) => void;
}

const QUARTER_BG = [
  "bg-blue-50/50 dark:bg-blue-950/20",
  "bg-emerald-50/50 dark:bg-emerald-950/20",
  "bg-amber-50/50 dark:bg-amber-950/20",
  "bg-rose-50/50 dark:bg-rose-950/20",
];

export function BonusTable({
  year,
  employees,
  bonuses,
  bonusTypes,
  funds,
  monthStatuses,
  defaultTaxRate,
  amountMode,
  customIntroText,
  onAddBonus,
  onEditBonus,
  onOpenStatusModal,
}: BonusTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (employeeId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  // Group bonuses by employeeId and month
  const bonusesByEmployeeMonth = useMemo(() => {
    const map = new Map<string, BonusWithDetails[]>();
    for (const b of bonuses) {
      const key = `${b.employeeId}-${b.month}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [bonuses]);

  const getAmount = (gross: number, employeeId: number, month: number) => {
    if (amountMode === "gross") return gross;
    const taxRate = getEffectiveTaxRateSync(
      employeeId,
      year,
      month,
      monthStatuses,
      defaultTaxRate
    );
    return grossToNet(gross, taxRate);
  };

  const getMonthTotal = (employeeId: number, month: number) => {
    const key = `${employeeId}-${month}`;
    const monthBonuses = bonusesByEmployeeMonth.get(key) || [];
    return monthBonuses.reduce(
      (sum, b) => sum + getAmount(b.amountGross, employeeId, month),
      0
    );
  };

  const getEmployeeYearTotal = (employeeId: number) => {
    return Array.from({ length: 12 }, (_, i) => i + 1).reduce(
      (sum, m) => sum + getMonthTotal(employeeId, m),
      0
    );
  };

  const getEmployeeQuarterTotal = (employeeId: number, quarter: number) => {
    return QUARTER_MONTHS[quarter].reduce(
      (sum, m) => sum + getMonthTotal(employeeId, m),
      0
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "accrued":
        return "bg-blue-500";
      case "notified":
        return "bg-emerald-500";
      default:
        return "bg-muted-foreground/30";
    }
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Нет сотрудников</p>
        <p className="text-sm mt-1">
          Добавьте сотрудников в настройках
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {/* Quarter header row */}
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-card text-card-foreground px-3 py-2 text-left font-medium min-w-[180px]">
              &nbsp;
            </th>
            {QUARTER_LABELS.map((q, qi) => (
              <th
                key={q}
                colSpan={3}
                className={cn(
                  "px-2 py-1.5 text-center font-medium text-xs text-muted-foreground border-l border-border",
                  QUARTER_BG[qi]
                )}
              >
                {q}
              </th>
            ))}
            <th className="px-3 py-1.5 text-right font-medium text-xs text-muted-foreground border-l border-border bg-card">
              Итого
            </th>
          </tr>
          {/* Month header row */}
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-card text-card-foreground px-3 py-2 text-left font-medium">
              Сотрудник
            </th>
            {MONTH_NAMES.map((m, mi) => {
              const qi = Math.floor(mi / 3);
              return (
                <th
                  key={m}
                  className={cn(
                    "px-2 py-1.5 text-center font-medium text-xs min-w-[80px] border-l border-border",
                    QUARTER_BG[qi]
                  )}
                >
                  {m}
                </th>
              );
            })}
            <th className="px-3 py-1.5 text-right font-medium text-xs min-w-[100px] border-l border-border bg-card">
              &nbsp;
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              expanded={expandedRows.has(employee.id)}
              onToggle={() => toggleRow(employee.id)}
              bonusesByMonth={bonusesByEmployeeMonth}
              monthStatuses={monthStatuses}
              defaultTaxRate={defaultTaxRate}
              amountMode={amountMode}
              year={year}
              customIntroText={customIntroText}
              getAmount={getAmount}
              getMonthTotal={getMonthTotal}
              getEmployeeYearTotal={getEmployeeYearTotal}
              getEmployeeQuarterTotal={getEmployeeQuarterTotal}
              statusColor={statusColor}
              onAddBonus={onAddBonus}
              onEditBonus={onEditBonus}
              onOpenStatusModal={onOpenStatusModal}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Employee Row ──

interface EmployeeRowProps {
  employee: Employee;
  expanded: boolean;
  onToggle: () => void;
  bonusesByMonth: Map<string, BonusWithDetails[]>;
  monthStatuses: MonthStatus[];
  defaultTaxRate: number;
  amountMode: AmountMode;
  year: number;
  customIntroText: string;
  getAmount: (gross: number, employeeId: number, month: number) => number;
  getMonthTotal: (employeeId: number, month: number) => number;
  getEmployeeYearTotal: (employeeId: number) => number;
  getEmployeeQuarterTotal: (employeeId: number, quarter: number) => number;
  statusColor: (status: string) => string;
  onAddBonus: (employeeId: number, month: number) => void;
  onEditBonus: (
    employeeId: number,
    month: number,
    bonus: BonusWithDetails
  ) => void;
  onOpenStatusModal: (employeeId: number, month: number) => void;
}

function EmployeeRow({
  employee,
  expanded,
  onToggle,
  bonusesByMonth,
  monthStatuses,
  defaultTaxRate,
  amountMode,
  year,
  customIntroText,
  getAmount,
  getMonthTotal,
  getEmployeeYearTotal,
  getEmployeeQuarterTotal,
  statusColor,
  onAddBonus,
  onEditBonus,
  onOpenStatusModal,
}: EmployeeRowProps) {
  const [isPending, startTransition] = useTransition();

  // const handleGenerateNotification = (month: number) => {
  //   const key = `${employee.id}-${month}`;
  //   const monthBonuses = bonusesByMonth.get(key) || [];
  //   if (monthBonuses.length === 0) {
  //     toast.error("Нет премий для генерации уведомления");
  //     return;
  //   }

  //   const lines = monthBonuses.map(
  //     (b) =>
  //       `- ${formatAmount(b.amountGross)}\u0420 за ${b.comment || b.bonusTypeName}`
  //   );
  //   const text = `${customIntroText}\n\n${lines.join("\n")}`;

  //   navigator.clipboard.writeText(text).then(() => {
  //     toast.success("Уведомление скопировано в буфер обмена");
  //   });
  // };

  const handleDeleteBonus = (bonusId: number) => {
    startTransition(async () => {
      await deleteBonus(bonusId);
      toast.success("Премия удалена");
    });
  };

  return (
    <>
      {/* Main row */}
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="sticky left-0 z-10 bg-card text-card-foreground px-3 py-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-left w-full group"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="font-medium truncate">{employee.fullName}</span>
          </button>
        </td>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const qi = Math.floor((month - 1) / 3);
          const total = getMonthTotal(employee.id, month);
          const ms = getMonthStatusForEmployee(
            employee.id,
            month,
            year,
            monthStatuses
          );
          const status = ms?.status || "none";

          return (
            <td
              key={month}
              className={cn(
                "px-2 py-2 text-center border-l border-border",
                QUARTER_BG[qi]
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    total > 0
                      ? "font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {total > 0 ? formatAmount(total) : "\u2014"}
                </span>
                <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 cursor-pointer"
                            onClick={() => onAddBonus(employee.id, month)}
                            title="Добавить премию"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          </div>
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full cursor-pointer",
                    statusColor(status)
                  )}
                  onClick={() => onOpenStatusModal(employee.id, month)}
                />
              </div>
            </td>
          );
        })}
        <td className="px-3 py-2 text-right font-medium tabular-nums border-l border-border bg-card text-card-foreground">
          {formatAmount(getEmployeeYearTotal(employee.id))}
        </td>
      </tr>

      {/* Expanded detail rows */}
      {expanded && (
        <tr className="border-b border-border">
          <td colSpan={14} className="p-0">
            <div className="bg-muted/20 px-4 py-3">
              {/* Quarter totals */}
              <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                {QUARTER_LABELS.map((q, qi) => (
                  <span key={q}>
                    {q}: {formatAmount(getEmployeeQuarterTotal(employee.id, qi))}
                  </span>
                ))}
              </div>

              {/* Month-by-month bonuses */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const key = `${employee.id}-${month}`;
                  const monthBonuses = bonusesByMonth.get(key) || [];
                  if (monthBonuses.length === 0 && !expanded) return null;

                  return (
                    <div
                      key={month}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">
                          {MONTH_NAMES[month - 1]}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleGenerateNotification(employee.id, month, bonusesByMonth.get(`${employee.id}-${month}`) || [], customIntroText)}
                            title="Сгенерировать уведомление"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              onOpenStatusModal(employee.id, month)
                            }
                            title="Статус месяца"
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => onAddBonus(employee.id, month)}
                            title="Добавить премию"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {monthBonuses.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Нет премий
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {monthBonuses.map((bonus) => (
                            <div
                              key={bonus.id}
                              className="flex items-start justify-between gap-2 text-xs group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "shrink-0 w-2 h-2 rounded-full",
                                      getBonusTypeColor(bonus.bonusTypeId)
                                    )}
                                    aria-hidden
                                  />
                                  <span className="font-medium tabular-nums">
                                    {formatAmount(
                                      getAmount(
                                        bonus.amountGross,
                                        employee.id,
                                        month
                                      )
                                    )}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {bonus.bonusTypeName}
                                  </span>
                                </div>
                                <div className="text-muted-foreground truncate">
                                  {bonus.fundName}
                                  {bonus.comment && ` \u2022 ${bonus.comment}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() =>
                                    onEditBonus(employee.id, month, bonus)
                                  }
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-destructive"
                                  onClick={() =>
                                    handleDeleteBonus(bonus.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="pt-1 border-t border-border text-xs font-medium tabular-nums">
                            Итого:{" "}
                            {formatAmount(getMonthTotal(employee.id, month))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
