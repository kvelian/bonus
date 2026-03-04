import type { MonthStatus } from "@/lib/types";

export function getEffectiveTaxRateSync(
  employeeId: number,
  year: number,
  month: number,
  monthStatuses: MonthStatus[],
  defaultTaxRate: number
): number {
  const ms = monthStatuses.find(
    (s) => s.employeeId === employeeId && s.year === year && s.month === month
  );
  if (ms?.taxRate != null) return ms.taxRate;
  return defaultTaxRate;
}

export function grossToNet(gross: number, taxRate: number): number {
  return gross * (1 - taxRate / 100);
}

export function netToGross(net: number, taxRate: number): number {
  if (taxRate >= 100) return net;
  return net / (1 - taxRate / 100);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getMonthStatusForEmployee(
  employeeId: number,
  month: number,
  year: number,
  monthStatuses: MonthStatus[]
): MonthStatus | undefined {
  return monthStatuses.find(
    (s) => s.employeeId === employeeId && s.year === year && s.month === month
  );
}

export const MONTH_NAMES = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

export const MONTH_FULL_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];
export const QUARTER_MONTHS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
];
