import {
  getEmployees,
  getBonusTypes,
  getFunds,
  getBonusesForYear,
  getMonthStatusesForYear,
  getDefaultTaxRate,
  getSetting,
} from "@/lib/actions";

function parseIdOrNull(s: string | null): number | null {
  if (s == null || s === "") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
import { DashboardClient } from "@/components/dashboard/dashboard-client";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();

  const [
    employees,
    bonusTypes,
    funds,
    bonuses,
    monthStatuses,
    defaultTaxRate,
    customIntroText,
    defaultBonusTypeIdRaw,
    defaultFundIdRaw,
  ] = await Promise.all([
    getEmployees(),
    getBonusTypes(),
    getFunds(),
    getBonusesForYear(year),
    getMonthStatusesForYear(year),
    getDefaultTaxRate(),
    getSetting("customIntroText"),
    getSetting("defaultBonusTypeId"),
    getSetting("defaultFundId"),
  ]);

  const defaultBonusTypeId = parseIdOrNull(defaultBonusTypeIdRaw);
  const defaultFundId = parseIdOrNull(defaultFundIdRaw);

  return (
    <DashboardClient
      year={year}
      employees={employees}
      bonusTypes={bonusTypes}
      funds={funds}
      bonuses={bonuses}
      monthStatuses={monthStatuses}
      defaultTaxRate={defaultTaxRate}
      customIntroText={customIntroText ?? ""}
      defaultBonusTypeId={defaultBonusTypeId}
      defaultFundId={defaultFundId}
    />
  );
}
