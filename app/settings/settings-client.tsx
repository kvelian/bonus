"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Sun,
  Moon,
} from "lucide-react";
import type { Employee, BonusType, Fund } from "@/lib/types";
import { getBonusTypeColor } from "@/lib/bonus-type-colors";
import { cn } from "@/lib/utils";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  createBonusType,
  updateBonusType,
  deleteBonusType,
  updateBonusTypeExternalSelectors,
  createFund,
  updateFund,
  deleteFund,
  updateSetting,
} from "@/lib/actions";

interface SettingsClientProps {
  employees: Employee[];
  bonusTypes: BonusType[];
  funds: Fund[];
  defaultTaxRate: string;
  customIntroText: string;
  defaultBonusTypeId: string;
  defaultFundId: string;
  externalTargetUrl: string;
  externalBasicAuthUsername: string;
  externalBasicAuthPassword: string;
}

export function SettingsClient({
  employees: initialEmployees,
  bonusTypes: initialBonusTypes,
  funds: initialFunds,
  defaultTaxRate: initialTaxRate,
  customIntroText: initialIntroText,
  defaultBonusTypeId: initialDefaultBonusTypeId,
  defaultFundId: initialDefaultFundId,
  externalTargetUrl: initialExternalTargetUrl,
  externalBasicAuthUsername: initialExternalBasicAuthUsername,
  externalBasicAuthPassword: initialExternalBasicAuthPassword,
}: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [externalTargetUrl, setExternalTargetUrl] = useState(initialExternalTargetUrl);
  const [externalBasicAuthUsername, setExternalBasicAuthUsername] = useState(
    initialExternalBasicAuthUsername
  );
  const [externalBasicAuthPassword, setExternalBasicAuthPassword] = useState(
    initialExternalBasicAuthPassword
  );
  const [bonusTypeSelectors, setBonusTypeSelectors] = useState(() => {
    const map = new Map<number, { amount: string; comment: string }>();
    initialBonusTypes.forEach((bt) => {
      map.set(bt.id, {
        amount: (bt.externalAmountClass ?? "") as string,
        comment: (bt.externalCommentClass ?? "") as string,
      });
    });
    return map;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Тема</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground ml-2">
              {theme === "dark" ? "Тёмная тема" : "Светлая тема"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Default Tax Rate */}
      <TaxRateSection initialRate={initialTaxRate} />

      {/* Custom Intro Text */}
      <IntroTextSection initialText={initialIntroText} />

      {/* External page integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Внешняя страница (Puppeteer)</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            URL и Basic Auth для доступа к внешней странице.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>URL</Label>
              <Input
                value={externalTargetUrl}
                onChange={(e) => setExternalTargetUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Basic Auth Username</Label>
                  <Input
                    value={externalBasicAuthUsername}
                    onChange={(e) => setExternalBasicAuthUsername(e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Basic Auth Password</Label>
                  <Input
                    type="password"
                    value={externalBasicAuthPassword}
                    onChange={(e) => setExternalBasicAuthPassword(e.target.value)}
                    placeholder="password"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                startTransition(async () => {
                  await updateSetting("externalTargetUrl", externalTargetUrl.trim());
                  await updateSetting("externalBasicAuthUsername", externalBasicAuthUsername.trim());
                  await updateSetting("externalBasicAuthPassword", externalBasicAuthPassword.trim());
                  toast.success("Настройки внешней страницы сохранены");
                });
              }}
              disabled={isPending}
              size="sm"
              className="self-start"
            >
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default values for new bonus */}
      <DefaultBonusSection
        bonusTypes={initialBonusTypes}
        funds={initialFunds}
        defaultBonusTypeId={initialDefaultBonusTypeId}
        defaultFundId={initialDefaultFundId}
      />

      <Separator />

      {/* Employees */}
      <CrudSection
        title="Сотрудники"
        items={initialEmployees}
        onAdd={async (name) => {
          await createEmployee(name);
        }}
        onUpdate={async (id, name) => {
          await updateEmployee(id, name);
        }}
        onDelete={async (id) => {
          await deleteEmployee(id);
        }}
        getItemLabel={(item) => item.fullName}
        placeholder="Имя сотрудника"
      />

      {/* Bonus Types */}
      <CrudSection<BonusType>
        title="Типы премий"
        items={initialBonusTypes}
        onAdd={async (name) => {
          await createBonusType(name);
        }}
        onUpdate={async (id, name) => {
          await updateBonusType(id, name);
        }}
        onDelete={async (id) => {
          await deleteBonusType(id);
        }}
        getItemLabel={(item) => item.name}
        placeholder="Название типа"
        itemPrefix={(item) => (
          <span
            className={cn(
              "shrink-0 w-2 h-2 rounded-full mr-2",
              getBonusTypeColor(item.id)
            )}
            aria-hidden
          />
        )}
      />

      {/* Bonus type -> external selectors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Селекторы полей для типов премий</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Укажите className (как на внешней странице) для суммы GROSS и комментария.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {initialBonusTypes.map((bt) => {
              const current = bonusTypeSelectors.get(bt.id) ?? { amount: "", comment: "" };
              return (
                <div
                  key={bt.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "shrink-0 w-2 h-2 rounded-full",
                          getBonusTypeColor(bt.id)
                        )}
                        aria-hidden
                      />
                      <span className="text-sm font-medium truncate">{bt.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const v = bonusTypeSelectors.get(bt.id) ?? { amount: "", comment: "" };
                          await updateBonusTypeExternalSelectors(bt.id, {
                            externalAmountClass: v.amount.trim(),
                            externalCommentClass: v.comment.trim(),
                          });
                          toast.success("Сохранено");
                        });
                      }}
                    >
                      Сохранить
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label>ClassName суммы (GROSS)</Label>
                      <Input
                        value={current.amount}
                        onChange={(e) => {
                          const next = new Map(bonusTypeSelectors);
                          next.set(bt.id, { ...current, amount: e.target.value });
                          setBonusTypeSelectors(next);
                        }}
                        placeholder="premiumMonth amount"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>ClassName комментария</Label>
                      <Input
                        value={current.comment}
                        onChange={(e) => {
                          const next = new Map(bonusTypeSelectors);
                          next.set(bt.id, { ...current, comment: e.target.value });
                          setBonusTypeSelectors(next);
                        }}
                        placeholder="premiumMonthDescription"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Funds */}
      <CrudSection
        title="Фонды"
        items={initialFunds}
        onAdd={async (name) => {
          await createFund(name);
        }}
        onUpdate={async (id, name) => {
          await updateFund(id, name);
        }}
        onDelete={async (id) => {
          await deleteFund(id);
        }}
        getItemLabel={(item) => item.name}
        placeholder="Название фонда"
      />
    </div>
  );
}

// ── Tax Rate Section ──

function TaxRateSection({ initialRate }: { initialRate: string }) {
  const [rate, setRate] = useState(initialRate);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateSetting("defaultTaxRate", rate);
      toast.success("Ставка налога обновлена");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Ставка налога по умолчанию (%)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button onClick={handleSave} disabled={isPending} size="sm">
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Default bonus type & fund (for new bonus modal) ──

interface DefaultBonusSectionProps {
  bonusTypes: BonusType[];
  funds: Fund[];
  defaultBonusTypeId: string;
  defaultFundId: string;
}

function DefaultBonusSection({
  bonusTypes,
  funds,
  defaultBonusTypeId: initialBonusTypeId,
  defaultFundId: initialFundId,
}: DefaultBonusSectionProps) {
  const [bonusTypeId, setBonusTypeId] = useState(initialBonusTypeId);
  const [fundId, setFundId] = useState(initialFundId);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateSetting("defaultBonusTypeId", bonusTypeId);
      await updateSetting("defaultFundId", fundId);
      toast.success("Значения по умолчанию сохранены");
    });
  };

  const hasChanges =
    bonusTypeId !== initialBonusTypeId || fundId !== initialFundId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Значения по умолчанию для новой премии
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Будут подставляться в форме добавления премии на главной странице.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Тип премии по умолчанию</Label>
            <Select
              value={bonusTypeId || "__none__"}
              onValueChange={(v) => setBonusTypeId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Не выбрано" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не выбрано</SelectItem>
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
            <Label>Фонд по умолчанию</Label>
            <Select
              value={fundId || "__none__"}
              onValueChange={(v) => setFundId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Не выбрано" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не выбрано</SelectItem>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            size="sm"
          >
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Intro Text Section ──

function IntroTextSection({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateSetting("customIntroText", text);
      toast.success("Текст уведомления обновлён");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Текст для уведомлений
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Введите текст для уведомлений..."
          />
          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
            className="self-start"
          >
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Generic CRUD Section ──

interface CrudSectionProps<T extends { id: number }> {
  title: string;
  items: T[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  getItemLabel: (item: T) => string;
  placeholder: string;
  /** Опциональный префикс перед названием (например, цветовой индикатор) */
  itemPrefix?: (item: T) => React.ReactNode;
}

function CrudSection<T extends { id: number }>({
  title,
  items,
  onAdd,
  onUpdate,
  onDelete,
  getItemLabel,
  placeholder,
  itemPrefix,
}: CrudSectionProps<T>) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      await onAdd(newName.trim());
      setNewName("");
      toast.success("Добавлено");
    });
  };

  const handleUpdate = (id: number) => {
    if (!editValue.trim()) return;
    startTransition(async () => {
      await onUpdate(id, editValue.trim());
      setEditingId(null);
      toast.success("Обновлено");
    });
  };

  const handleDelete = (id: number) => {
    startTransition(async () => {
      try {
        await onDelete(id);
        toast.success("Удалено");
      } catch {
        toast.error("Невозможно удалить: есть связанные записи");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Add new */}
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={isPending || !newName.trim()}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List */}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Нет записей
            </p>
          )}
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
              >
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(item.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 h-8"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleUpdate(item.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    {itemPrefix?.(item)}
                    <span className="flex-1 text-sm min-w-0">
                      {getItemLabel(item)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditValue(getItemLabel(item));
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
