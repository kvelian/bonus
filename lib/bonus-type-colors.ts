/**
 * Нейтральная палитра цветов для индикации типов премий.
 * Цвет определяется по id типа — один и тот же тип всегда одного цвета во всей системе.
 */

const BONUS_TYPE_PALETTE = [
  "bg-cyan-400 dark:bg-cyan-500",
  "bg-orange-400 dark:bg-orange-500",
  "bg-emerald-400 dark:bg-emerald-500",
  "bg-yellow-400 dark:bg-yellow-500",
  "bg-red-500 dark:bg-red-500",
  "bg-blue-500 dark:bg-blue-500",
  "bg-green-500 dark:bg-green-500",
  "bg-purple-500 dark:bg-purple-500",
  "bg-pink-500 dark:bg-pink-500",
  "bg-gray-500 dark:bg-gray-500",
  "bg-brown-500 dark:bg-brown-500",
  "bg-neutral-600 dark:bg-neutral-300",
] as const;

export function getBonusTypeColor(bonusTypeId: number): string {
  const index = Math.abs(bonusTypeId) % BONUS_TYPE_PALETTE.length;
  return BONUS_TYPE_PALETTE[index];
}
