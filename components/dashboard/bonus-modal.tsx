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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { BonusType, Fund, BonusWithDetails, MonthStatus, AmountMode } from "@/lib/types";
import { createBonus, updateBonus } from "@/lib/actions";
import {
  netToGross,
  getEffectiveTaxRateSync,
  MONTH_FULL_NAMES,
  grossToNet,
} from "@/lib/tax-utils";
import { getBonusTypeColor } from "@/lib/bonus-type-colors";

interface BonusModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number;
  employeeFullName?: string;
  year: number;
  month: number;
  bonusTypes: BonusType[];
  funds: Fund[];
  defaultTaxRate: number;
  monthStatuses: MonthStatus[];
  editBonus?: BonusWithDetails;
  amountMode: AmountMode;
  defaultBonusTypeId?: number | null;
  defaultFundId?: number | null;
}

export function BonusModal({
  open,
  onClose,
  employeeId,
  employeeFullName,
  year,
  month,
  bonusTypes,
  funds,
  defaultTaxRate,
  monthStatuses,
  editBonus,
  amountMode,
  defaultBonusTypeId,
  defaultFundId,
}: BonusModalProps) {
  const [isPending, startTransition] = useTransition();
  const [bonusTypeId, setBonusTypeId] = useState<string>(
    editBonus?.bonusTypeId?.toString() || ""
  );
  const [fundId, setFundId] = useState<string>(
    editBonus?.fundId?.toString() || ""
  );
  const [amount, setAmount] = useState<string>(
    editBonus?.amountGross?.toString() || ""
  );
  const [comment, setComment] = useState<string>(editBonus?.comment || "");
  const [inputAsNet, setInputAsNet] = useState(false);

  // Reset form when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  // Resolve default bonus type: from editBonus, then from settings (if valid), then first item
  const resolvedDefaultBonusTypeId = (() => {
    if (editBonus?.bonusTypeId != null) return editBonus.bonusTypeId.toString();
    if (defaultBonusTypeId != null && bonusTypes.some((bt) => bt.id === defaultBonusTypeId)) {
      return defaultBonusTypeId.toString();
    }
    return bonusTypes[0]?.id?.toString() ?? "";
  })();

  // Resolve default fund: from editBonus, then from settings (if valid), then first item
  const resolvedDefaultFundId = (() => {
    if (editBonus?.fundId != null) return editBonus.fundId.toString();
    if (defaultFundId != null && funds.some((f) => f.id === defaultFundId)) {
      return defaultFundId.toString();
    }
    return funds[0]?.id?.toString() ?? "";
  })();

  // Reset fields when modal opens or editBonus / lists change
  useEffect(() => {
    if (open) {
      setBonusTypeId(resolvedDefaultBonusTypeId);
      setFundId(resolvedDefaultFundId);
      setAmount(editBonus?.amountGross?.toString() || "");
      setComment(editBonus?.comment || "");
      setInputAsNet(false);
    }
  }, [open, editBonus, resolvedDefaultBonusTypeId, resolvedDefaultFundId]);

  const taxRate = getEffectiveTaxRateSync(
    employeeId,
    year,
    month,
    monthStatuses,
    defaultTaxRate
  );

  const handleSubmit = () => {
    if (!bonusTypeId || !fundId || !amount) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    const amountGross = inputAsNet
      ? netToGross(parsedAmount, taxRate)
      : parsedAmount;

    startTransition(async () => {
      if (editBonus) {
        await updateBonus(editBonus.id, {
          bonusTypeId: parseInt(bonusTypeId),
          fundId: parseInt(fundId),
          amountGross,
          comment,
        });
        toast.success("Премия обновлена");
      } else {
        await createBonus({
          employeeId,
          year,
          month,
          bonusTypeId: parseInt(bonusTypeId),
          fundId: parseInt(fundId),
          amountGross,
          comment,
        });
        toast.success("Премия добавлена");
      }
      onClose();
    });
  };

  if (bonusTypes.length === 0 || funds.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Невозможно создать премию</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Сначала добавьте типы премий и фонды в настройках.
          </p>
          <DialogFooter>
            <Button onClick={onClose} variant="outline">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editBonus ? "Редактировать премию" : "Новая премия"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {employeeFullName && (
              <>
                <span className="font-medium text-foreground">{employeeFullName}</span>
                {" · "}
              </>
            )}
            {MONTH_FULL_NAMES[month - 1]} {year} | Налог: {taxRate}%
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Тип премии</Label>
            <Select value={bonusTypeId} onValueChange={setBonusTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {bonusTypes.map((bt) => (
                  <SelectItem key={bt.id} value={bt.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 w-2 h-2 rounded-full",
                          getBonusTypeColor(bt.id)
                        )}
                        aria-hidden
                      />
                      {bt.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Фонд</Label>
            <Select value={fundId} onValueChange={setFundId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите фонд" />
              </SelectTrigger>
              <SelectContent>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Сумма</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">GROSS</span>
                <Switch
                  checked={inputAsNet}
                  onCheckedChange={setInputAsNet}
                />
                <span className="text-xs text-muted-foreground">NET</span>
              </div>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={inputAsNet ? "Сумма NET" : "Сумма GROSS"}
            />
            {inputAsNet && amount && !isNaN(parseFloat(amount)) && (
              <p className="text-xs text-muted-foreground">
                GROSS: {netToGross(parseFloat(amount), taxRate).toFixed(2)}
              </p>
            )}
            {!inputAsNet && amount && !isNaN(parseFloat(amount)) && (
              <p className="text-xs text-muted-foreground">
                NET: {grossToNet(parseFloat(amount), taxRate).toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Необязательный комментарий..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {editBonus ? "Сохранить" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
