import type { Employee, BonusWithDetails, MonthStatus, AmountMode } from "@/lib/types";
import {
  grossToNet,
  getEffectiveTaxRateSync,
  MONTH_NAMES,
} from "@/lib/tax-utils";

export function exportToCsv(
  employees: Employee[],
  bonuses: BonusWithDetails[],
  monthStatuses: MonthStatus[],
  defaultTaxRate: number,
  year: number,
  amountMode: AmountMode
) {
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

  // Header
  const headers = [
    "Сотрудник",
    ...MONTH_NAMES,
    "Итого",
  ];

  const rows: string[][] = [];

  for (const emp of employees) {
    const row: string[] = [emp.fullName];
    let yearTotal = 0;

    for (let m = 1; m <= 12; m++) {
      const monthBonuses = bonuses.filter(
        (b) => b.employeeId === emp.id && b.month === m
      );
      const total = monthBonuses.reduce(
        (s, b) => s + getAmount(b.amountGross, emp.id, m),
        0
      );
      yearTotal += total;
      row.push(total.toFixed(2));
    }

    row.push(yearTotal.toFixed(2));
    rows.push(row);
  }

  const csvContent = [
    headers.join(";"),
    ...rows.map((r) => r.join(";")),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bonuses_${year}_${amountMode}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
