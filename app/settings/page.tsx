import {
  getEmployees,
  getBonusTypes,
  getFunds,
  getSetting,
} from "@/lib/actions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const [employees, bonusTypes, funds, defaultTaxRate, customIntroText] =
    await Promise.all([
      getEmployees(),
      getBonusTypes(),
      getFunds(),
      getSetting("defaultTaxRate"),
      getSetting("customIntroText"),
    ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-8">Настройки</h1>
      <SettingsClient
        employees={employees}
        bonusTypes={bonusTypes}
        funds={funds}
        defaultTaxRate={defaultTaxRate ?? "13"}
        customIntroText={customIntroText ?? ""}
      />
    </div>
  );
}
