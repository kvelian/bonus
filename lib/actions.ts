"use server";

import { getDb, queryAll, queryOne, runSql, persist } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type {
  Employee,
  BonusType,
  Fund,
  MonthStatus,
  BonusWithDetails,
} from "@/lib/types";
import { applyExternalBonuses } from "@/lib/external/apply-bonuses";

// ── Employees ──────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const db = await getDb();
  return await queryAll<Employee>(db, "SELECT * FROM employees ORDER BY fullName");
}

export async function createEmployee(fullName: string): Promise<Employee> {
  const db = await getDb();
  const result = await runSql(db, "INSERT INTO employees (fullName) VALUES (?)", [fullName]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
  return { id: Number(result.lastInsertRowid), fullName };
}

export async function updateEmployee(id: number, fullName: string): Promise<void> {
  const db = await getDb();
  await runSql(db, "UPDATE employees SET fullName = ? WHERE id = ?", [fullName, id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function deleteEmployee(id: number): Promise<void> {
  const db = await getDb();
  await runSql(db, "DELETE FROM employees WHERE id = ?", [id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

// ── Bonus Types ────────────────────────────────────────

export async function getBonusTypes(): Promise<BonusType[]> {
  const db = await getDb();
  return await queryAll<BonusType>(db, "SELECT * FROM bonus_types ORDER BY name");
}

export async function createBonusType(name: string): Promise<BonusType> {
  const db = await getDb();
  const result = await runSql(db, "INSERT INTO bonus_types (name) VALUES (?)", [name]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
  return { id: Number(result.lastInsertRowid), name, externalAmountClass: null, externalCommentClass: null };
}

export async function updateBonusType(id: number, name: string): Promise<void> {
  const db = await getDb();
  await runSql(db, "UPDATE bonus_types SET name = ? WHERE id = ?", [name, id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateBonusTypeExternalSelectors(
  id: number,
  data: { externalAmountClass: string; externalCommentClass: string }
): Promise<void> {
  const db = await getDb();
  await runSql(
    db,
    "UPDATE bonus_types SET externalAmountClass = ?, externalCommentClass = ? WHERE id = ?",
    [data.externalAmountClass, data.externalCommentClass, id]
  );
  persist(db);
  revalidatePath("/settings");
}

export async function deleteBonusType(id: number): Promise<void> {
  const db = await getDb();
  await runSql(db, "DELETE FROM bonus_types WHERE id = ?", [id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

// ── Funds ──────────────────────────────────────────────

export async function getFunds(): Promise<Fund[]> {
  const db = await getDb();
  return await queryAll<Fund>(db, "SELECT * FROM funds ORDER BY name");
}

export async function createFund(name: string): Promise<Fund> {
  const db = await getDb();
  const result = await runSql(db, "INSERT INTO funds (name) VALUES (?)", [name]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
  return { id: Number(result.lastInsertRowid), name };
}

export async function updateFund(id: number, name: string): Promise<void> {
  const db = await getDb();
  await runSql(db, "UPDATE funds SET name = ? WHERE id = ?", [name, id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function deleteFund(id: number): Promise<void> {
  const db = await getDb();
  await runSql(db, "DELETE FROM funds WHERE id = ?", [id]);
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

// ── Settings ───────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await queryOne<{ value: string }>(
    db,
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await runSql(
    db,
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
  persist(db);
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function getBonusesForYearMonth(year: number, month: number): Promise<
  Array<
    BonusWithDetails & {
      employeeFullName: string;
      bonusTypeExternalAmountClass: string | null;
      bonusTypeExternalCommentClass: string | null;
    }
  >
> {
  const db = await getDb();
  return await queryAll(db, `
    SELECT
      b.*,
      bt.name as bonusTypeName,
      f.name as fundName,
      e.fullName as employeeFullName,
      bt.externalAmountClass as bonusTypeExternalAmountClass,
      bt.externalCommentClass as bonusTypeExternalCommentClass
    FROM bonuses b
    JOIN employees e ON b.employeeId = e.id
    JOIN bonus_types bt ON b.bonusTypeId = bt.id
    JOIN funds f ON b.fundId = f.id
    WHERE b.year = ? AND b.month = ?
    ORDER BY e.fullName, b.id
  `, [year, month]);
}

export async function applyBonusesToExternalPage(params: {
  year: number;
  month: number;
}): Promise<{ applied: number; errors: Array<{ employeeFullName: string; reason: string }> }> {
  const { year, month } = params;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error("Некорректный год");
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Некорректный месяц");
  }

  const [targetUrl, externalBasicAuthUsername, externalBasicAuthPassword] = await Promise.all([
    getSetting("externalTargetUrl"),
    getSetting("externalBasicAuthUsername"),
    getSetting("externalBasicAuthPassword"),
  ]);

  if (!targetUrl) throw new Error("Не задан externalTargetUrl в Settings");

  if (!externalBasicAuthUsername || !externalBasicAuthPassword) {
    throw new Error(
      "Не заданы externalBasicAuthUsername/externalBasicAuthPassword в Settings"
    );
  }

  const bonuses = await getBonusesForYearMonth(year, month);
  const toApply = bonuses
    .map((b) => {
      const amountClass = b.bonusTypeExternalAmountClass?.trim() ?? "";
      const commentClass = b.bonusTypeExternalCommentClass?.trim() ?? "";
      if (!amountClass || !commentClass) return null;
      return {
        employeeFullName: b.employeeFullName,
        amountGross: b.amountGross,
        comment: b.comment ?? "",
        amountClass,
        commentClass,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return await applyExternalBonuses(
    {
      targetUrl,
      basicAuth: {
        username: externalBasicAuthUsername,
        password: externalBasicAuthPassword,
      },
      headless: true,
    },
    toApply
  );
}

// ── Month Statuses ─────────────────────────────────────

export async function getMonthStatus(
  employeeId: number,
  year: number,
  month: number
): Promise<MonthStatus | null> {
  const db = await getDb();
  const row = await queryOne<MonthStatus>(
    db,
    "SELECT * FROM month_statuses WHERE employeeId = ? AND year = ? AND month = ?",
    [employeeId, year, month]
  );
  return row ?? null;
}

export async function getMonthStatusesForYear(year: number): Promise<MonthStatus[]> {
  const db = await getDb();
  return await queryAll<MonthStatus>(
    db,
    "SELECT * FROM month_statuses WHERE year = ?",
    [year]
  );
}

export async function upsertMonthStatus(
  employeeId: number,
  year: number,
  month: number,
  status: string,
  taxRate: number | null
): Promise<void> {
  const db = await getDb();
  await runSql(
    db,
    `INSERT INTO month_statuses (employeeId, year, month, status, taxRate)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(employeeId, year, month)
     DO UPDATE SET status = excluded.status, taxRate = excluded.taxRate`,
    [employeeId, year, month, status, taxRate]
  );
  persist(db);
  revalidatePath("/");
}

// ── Bonuses ────────────────────────────────────────────

export async function getBonusesForYear(year: number): Promise<BonusWithDetails[]> {
  const db = await getDb();
  return await queryAll<BonusWithDetails>(
    db,
    `SELECT b.*, bt.name as bonusTypeName, f.name as fundName
     FROM bonuses b
     JOIN bonus_types bt ON b.bonusTypeId = bt.id
     JOIN funds f ON b.fundId = f.id
     WHERE b.year = ?
     ORDER BY b.month, b.employeeId`,
    [year]
  );
}

export async function getBonusesForEmployeeMonth(
  employeeId: number,
  year: number,
  month: number
): Promise<BonusWithDetails[]> {
  const db = await getDb();
  return await queryAll<BonusWithDetails>(
    db,
    `SELECT b.*, bt.name as bonusTypeName, f.name as fundName
     FROM bonuses b
     JOIN bonus_types bt ON b.bonusTypeId = bt.id
     JOIN funds f ON b.fundId = f.id
     WHERE b.employeeId = ? AND b.year = ? AND b.month = ?
     ORDER BY b.id`,
    [employeeId, year, month]
  );
}

export async function createBonus(data: {
  employeeId: number;
  year: number;
  month: number;
  bonusTypeId: number;
  fundId: number;
  amountGross: number;
  comment: string;
}): Promise<void> {
  const db = await getDb();
  await runSql(
    db,
    `INSERT INTO bonuses (employeeId, year, month, bonusTypeId, fundId, amountGross, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.employeeId,
      data.year,
      data.month,
      data.bonusTypeId,
      data.fundId,
      data.amountGross,
      data.comment,
    ]
  );
  persist(db);
  revalidatePath("/");
}

export async function updateBonus(
  id: number,
  data: {
    bonusTypeId: number;
    fundId: number;
    amountGross: number;
    comment: string;
  }
): Promise<void> {
  const db = await getDb();
  await runSql(
    db,
    `UPDATE bonuses SET bonusTypeId = ?, fundId = ?, amountGross = ?, comment = ? WHERE id = ?`,
    [data.bonusTypeId, data.fundId, data.amountGross, data.comment, id]
  );
  persist(db);
  revalidatePath("/");
}

export async function deleteBonus(id: number): Promise<void> {
  const db = await getDb();
  await runSql(db, "DELETE FROM bonuses WHERE id = ?", [id]);
  persist(db);
  revalidatePath("/");
}

// ── Tax helpers ────────────────────────────────────────

export async function getEffectiveTaxRate(
  employeeId: number,
  year: number,
  month: number
): Promise<number> {
  const ms = await getMonthStatus(employeeId, year, month);
  if (ms?.taxRate != null) return ms.taxRate;
  const defaultRate = await getSetting("defaultTaxRate");
  return defaultRate ? parseFloat(defaultRate) : 13;
}

export async function getDefaultTaxRate(): Promise<number> {
  const rate = await getSetting("defaultTaxRate");
  return rate ? parseFloat(rate) : 13;
}