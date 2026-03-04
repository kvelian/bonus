import { toast } from "sonner";
import { formatAmount } from "@/lib/tax-utils";
import type { BonusWithDetails } from "@/lib/types";

export const handleGenerateNotification = (employeeId: number, month: number, bonuses: BonusWithDetails[], customIntroText: string) => {
    const key = `${employeeId}-${month}`;
    if (bonuses.length === 0) {
      toast.error("Нет премий для генерации уведомления");
      return;
    }
  
    const lines = bonuses.map(
      (b) =>
        `- ${formatAmount(b.amountGross)}\u0420 за ${b.comment || b.bonusTypeName}`
    );
    const text = `${customIntroText}\n\n${lines.join("\n")}`;
  
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Уведомление скопировано в буфер обмена");
    });
  };