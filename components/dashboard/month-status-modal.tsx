"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { handleGenerateNotification } from "./(helpers)/handleGenerateNotification";
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
import { getBonusTypeColor } from "@/lib/bonus-type-colors";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface MonthStatusModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number;
  year: number;
  month: number;
  monthStatuses: MonthStatus[];
  customIntroText: string;
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
  customIntroText,
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
              <div className="flex items-center gap-1 mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                Премии за месяц ({monthBonuses.length})
              </p>
              <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleGenerateNotification(employeeId, month, bonuses, customIntroText)}
                            title="Сгенерировать уведомление"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
              </div>
              <div className="flex flex-col gap-1">
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
                        amountMode === "gross"
                          ? bonus.amountGross
                          : grossToNet(bonus.amountGross, effectiveTaxRate)
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
                            </div>
                          ))}
                          <div className="pt-1 border-t border-border text-xs font-medium tabular-nums">
                            Итого:{" "}
                            {formatAmount(amountMode === "gross" ? totalGross : totalNet)}
                          </div>
                        </div>
                      )}
                {/* {monthBonuses.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <span
                        className={cn(
                          "shrink-0 w-2 h-2 rounded-full",
                          getBonusTypeColor(b.bonusTypeId)
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{b.bonusTypeName}</span>
                    </span>
                    <span className="tabular-nums font-medium shrink-0">
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
                </div> */}
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
