"use client";

import { useState, useCallback, useMemo } from "react";
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
      </div>

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
