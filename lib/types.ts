export interface Employee {
  id: number;
  fullName: string;
}

export interface BonusType {
  id: number;
  name: string;
}

export interface Fund {
  id: number;
  name: string;
}

export interface MonthStatus {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  status: "none" | "accrued" | "notified";
  taxRate: number | null;
}

export interface Bonus {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  bonusTypeId: number;
  fundId: number;
  amountGross: number;
  comment: string;
}

export interface BonusWithDetails extends Bonus {
  bonusTypeName: string;
  fundName: string;
}

export type ViewMode = "year" | "quarter" | "month";
export type AmountMode = "gross" | "net";
