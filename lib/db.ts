import { createClient, type Client } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "http://localhost:8080";

let client: Client | null = null;
let initPromise: Promise<Client> | null = null;

export async function getDb(): Promise<Client> {
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    client = createClient({ url });
    await ensureSchema(client);
    return client;
  })();

  return initPromise;
}

/** No-op: серверная БД сохраняет сама. Оставлено для совместимости с actions. */
export function persist(_db: Client): void {}

async function ensureSchema(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bonus_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      externalAmountClass TEXT,
      externalCommentClass TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS month_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
      status TEXT NOT NULL DEFAULT 'none' CHECK(status IN ('none', 'accrued', 'notified')),
      taxRate REAL,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employeeId, year, month)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
      bonusTypeId INTEGER NOT NULL,
      fundId INTEGER NOT NULL,
      amountGross REAL NOT NULL,
      comment TEXT DEFAULT '',
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (bonusTypeId) REFERENCES bonus_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (fundId) REFERENCES funds(id) ON DELETE RESTRICT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaultRate = await db.execute({
    sql: "SELECT key FROM settings WHERE key = 'defaultTaxRate'",
    args: {}
  });
  if (!defaultRate.rows.length) {
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?)",
      args: ["defaultTaxRate", "13"],
    });
  }

  const customIntro = await db.execute({
    sql: "SELECT key FROM settings WHERE key = 'customIntroText'",
    args: {}
  });
  if (!customIntro.rows.length) {
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?)",
      args: ["customIntroText", "Уведомляем вас о начислении премии:"],
    });
  }

  await ensureBonusTypeColumns(db);
  await ensureSettingKey(db, "externalTargetUrl", "");
  await ensureSettingKey(db, "externalAuthCookiesJson", "[]");
}

async function ensureSettingKey(db: Client, key: string, defaultValue: string): Promise<void> {
  const res = await db.execute({
    sql: "SELECT key FROM settings WHERE key = ?",
    args: [key],
  });
  if (!res.rows.length) {
    await db.execute({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?)",
      args: [key, defaultValue],
    });
  }
}

async function ensureBonusTypeColumns(db: Client): Promise<void> {
  const pragma = await db.execute({
    sql: "PRAGMA table_info(bonus_types)",
    args: {},
  });
  const cols = new Set(
    (pragma.rows ?? []).map((r) => {
      if (typeof r === "object" && r && "name" in (r as Record<string, unknown>)) {
        return String((r as Record<string, unknown>).name);
      }
      if (Array.isArray(r)) return String(r[1]);
      return "";
    })
  );

  if (!cols.has("externalAmountClass")) {
    await db.execute("ALTER TABLE bonus_types ADD COLUMN externalAmountClass TEXT");
  }
  if (!cols.has("externalCommentClass")) {
    await db.execute("ALTER TABLE bonus_types ADD COLUMN externalCommentClass TEXT");
  }
}

function rowsToObjects<T>(columns: string[], rows: unknown[]): T[] {
  if (!rows.length) return [];
  return rows.map((row) => {
    if (Array.isArray(row)) {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = (row as unknown[])[i];
      });
      return obj as T;
    }
    return row as T;
  });
}

export async function queryAll<T>(
  database: Client,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await database.execute({
    sql,
    args: params as (string | number | bigint | Uint8Array | null)[],
  });
  const columns = result.columns ?? [];
  const rows = result.rows ?? [];
  return rowsToObjects<T>(columns, rows);
}

export async function queryOne<T>(
  database: Client,
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const all = await queryAll<T>(database, sql, params);
  return all[0];
}

export async function runSql(
  database: Client,
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertRowid: number }> {
  const result = await database.execute({
    sql,
    args: params as (string | number | bigint | Uint8Array | null)[],
  });
  const id = result.lastInsertRowid;
  return {
    lastInsertRowid: id != null ? Number(id) : 0,
  };
}
