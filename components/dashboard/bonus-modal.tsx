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
import type { BonusType, Fund, BonusWithDetails, MonthStatus, AmountMode } from "@/lib/types";
import { createBonus, updateBonus } from "@/lib/actions";
import {
  netToGross,
  getEffectiveTaxRateSync,
  MONTH_FULL_NAMES,
} from "@/lib/tax-utils";

interface BonusModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number;
  year: number;
  month: number;
  bonusTypes: BonusType[];
  funds: Fund[];
  defaultTaxRate: number;
  monthStatuses: MonthStatus[];
  editBonus?: BonusWithDetails;
  amountMode: AmountMode;
}

export function BonusModal({
  open,
  onClose,
  employeeId,
  year,
  month,
  bonusTypes,
  funds,
  defaultTaxRate,
  monthStatuses,
  editBonus,
  amountMode,
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

  // Reset fields when editBonus changes
  useEffect(() => {
    if (open) {
      setBonusTypeId(editBonus?.bonusTypeId?.toString() || (bonusTypes[0]?.id?.toString() ?? ""));
      setFundId(editBonus?.fundId?.toString() || (funds[0]?.id?.toString() ?? ""));
      setAmount(editBonus?.amountGross?.toString() || "");
      setComment(editBonus?.comment || "");
      setInputAsNet(false);
    }
  }, [open, editBonus, bonusTypes, funds]);

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
                    {bt.name}
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
