"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MonthStatus, BonusWithDetails, AmountMode } from "@/lib/types";
import { upsertMonthStatus } from "@/lib/actions";
import {
  getMonthStatusForEmployee,
  grossToNet,
  getEffectiveTaxRateSync,
  MONTH_FULL_NAMES,
  formatAmount,
} from "@/lib/tax-utils";

interface MonthStatusModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number;
  year: number;
  month: number;
  monthStatuses: MonthStatus[];
  defaultTaxRate: number;
  bonuses: BonusWithDetails[];
  amountMode: AmountMode;
}

export function MonthStatusModal({
  open,
  onClose,
  employeeId,
  year,
  month,
  monthStatuses,
  defaultTaxRate,
  bonuses,
  amountMode,
}: MonthStatusModalProps) {
  const [isPending, startTransition] = useTransition();
  const existing = getMonthStatusForEmployee(
    employeeId,
    month,
    year,
    monthStatuses
  );

  const [status, setStatus] = useState(existing?.status || "none");
  const [taxRate, setTaxRate] = useState<string>(
    existing?.taxRate?.toString() || ""
  );

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      const ms = getMonthStatusForEmployee(
        employeeId,
        month,
        year,
        monthStatuses
      );
      setStatus(ms?.status || "none");
      setTaxRate(ms?.taxRate?.toString() || "");
    }
  }, [open, employeeId, month, year, monthStatuses]);

  const monthBonuses = bonuses.filter(
    (b) => b.employeeId === employeeId && b.month === month
  );

  const effectiveTaxRate = getEffectiveTaxRateSync(
    employeeId,
    year,
    month,
    monthStatuses,
    defaultTaxRate
  );

  const totalGross = monthBonuses.reduce((s, b) => s + b.amountGross, 0);
  const totalNet = grossToNet(totalGross, effectiveTaxRate);

  const handleSave = () => {
    const parsedTaxRate = taxRate.trim() === "" ? null : parseFloat(taxRate);
    if (parsedTaxRate !== null && (isNaN(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100)) {
      toast.error("Введите корректную ставку налога (0-100)");
      return;
    }

    startTransition(async () => {
      await upsertMonthStatus(employeeId, year, month, status, parsedTaxRate);
      toast.success("Статус месяца обновлён");
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {MONTH_FULL_NAMES[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Нет статуса</SelectItem>
                <SelectItem value="accrued">Начислено</SelectItem>
                <SelectItem value="notified">Уведомлено</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>
              Ставка налога (%)
              <span className="text-muted-foreground ml-1 font-normal">
                по умолчанию: {defaultTaxRate}%
              </span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder={`${defaultTaxRate} (по умолчанию)`}
            />
          </div>

          {monthBonuses.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Премии за месяц ({monthBonuses.length})
              </p>
              <div className="flex flex-col gap-1">
                {monthBonuses.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      {b.bonusTypeName}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatAmount(
                        amountMode === "gross"
                          ? b.amountGross
                          : grossToNet(b.amountGross, effectiveTaxRate)
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs border-t border-border pt-1 mt-1 font-medium">
                  <span>Итого ({amountMode.toUpperCase()})</span>
                  <span className="tabular-nums">
                    {formatAmount(amountMode === "gross" ? totalGross : totalNet)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
