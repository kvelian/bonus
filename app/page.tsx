import {
  getEmployees,
  getBonusTypes,
  getFunds,
  getBonusesForYear,
  getMonthStatusesForYear,
  getDefaultTaxRate,
  getSetting,
} from "@/lib/actions";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();

  const [employees, bonusTypes, funds, bonuses, monthStatuses, defaultTaxRate, customIntroText] =
    await Promise.all([
      getEmployees(),
      getBonusTypes(),
      getFunds(),
      getBonusesForYear(year),
      getMonthStatusesForYear(year),
      getDefaultTaxRate(),
      getSetting("customIntroText"),
    ]);

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
    />
  );
}
