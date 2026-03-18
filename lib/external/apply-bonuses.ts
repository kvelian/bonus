import puppeteer, { type ElementHandle, type Page } from "puppeteer";

export type ExternalBonusToApply = {
  employeeId: number;
  employeeFullName: string;
  amountGross: number;
  comment: string;
  amountClass: string;
  commentClass: string;
};

export type ExternalApplyProgressEvent = {
  total: number;
  processed: number;
  applied: number;
  errorsCount: number;
  currentEmployeeId: number;
  currentEmployeeFullName: string;
};

export type ExternalApplyErrorEvent = {
  employeeId: number;
  employeeFullName: string;
  reason: string;
  total: number;
  processed: number;
  applied: number;
  errorsCount: number;
};

export type ExternalEmployeeCompletedEvent = {
  employeeId: number;
  employeeFullName: string;
  succeeded: boolean;
  employeeApplied: number;
  employeeTotal: number;
};

export type ExternalApplyConfig = {
  targetUrl: string;
  basicAuth: { username: string; password: string };
  timeoutMs?: number;
  headless?: boolean;
};

export type ExternalApplyResult = {
  applied: number;
  errors: Array<{ employeeFullName: string; reason: string }>;
};

export type ExternalApplyCallbacks = {
  onProgress?: (event: ExternalApplyProgressEvent) => void | Promise<void>;
  onError?: (event: ExternalApplyErrorEvent) => void | Promise<void>;
  onEmployeeCompleted?: (event: ExternalEmployeeCompletedEvent) => void | Promise<void>;
};

function classNameToCss(className: string): string {
  const parts = className
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) throw new Error("Empty className selector");
  // Basic: ".a.b.c"
  return `.${parts.map(escapeCssIdent).join(".")}`;
}

function escapeCssIdent(ident: string): string {
  // Minimal escape for class selectors; good enough for typical Tailwind-like / simple tokens.
  return ident.replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`);
}

async function waitAndClick(page: Page, selector: string, timeoutMs: number) {
  await page.waitForSelector(selector, { timeout: timeoutMs });
  await page.click(selector);
}

async function findEmployeeRowHandle(page: Page, employeeFullName: string, timeoutMs: number) {
  await page.waitForSelector("tbody tr", { timeout: timeoutMs });
  const handle = await page.evaluateHandle((fio) => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const normalize = (v: unknown) =>
      String(v ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const target = normalize(fio);

    // 1) Prefer exact match using dedicated FIO cell.
    const exactRow = rows.find((r) => {
      const cell = r.querySelector('[name-cell="fio"]');
      if (!cell) return false;
      return normalize(cell.textContent) === target;
    });

    // 2) Fallback: relaxed includes on whole row text.
    const row = exactRow ?? rows.find((r) => normalize(r.textContent).includes(target));

    return row ?? null;
  }, employeeFullName);
  const el = handle.asElement();
  if (!el) throw new Error(`Row not found for "${employeeFullName}"`);
  return el;
}

async function clickEditInRow(page: Page, row: ElementHandle<Node>, timeoutMs: number) {
  const edit = await row.$('img[title="Редактировать"], img[src*="edit.gif"]');
  if (!edit) throw new Error("Edit button not found in row");
  await edit.click();
  // After click, editable row appears (often with save button)
  await page.waitForSelector('img.save-btn[title="Сохранить"], img[title="Сохранить"]', {
    timeout: timeoutMs,
  });
}

async function clickAddAndPickEmployee(page: Page, employeeFullName: string, timeoutMs: number) {
  await waitAndClick(page, "#btnAdd", timeoutMs);
  await page.waitForSelector("input.employee__autocomplete.cft-autocomplete__input", {
    timeout: timeoutMs,
  });
  const inputSel = "input.employee__autocomplete.cft-autocomplete__input";
  await page.click(inputSel, { clickCount: 3 });
  await page.type(inputSel, employeeFullName, { delay: 10 });

  // Results can be multiple blocks; pick visible one, then click matching li by text.
  await page.waitForSelector(".cft-autocomplete__results", { timeout: timeoutMs });
  const picked = await page.evaluate((fio) => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".cft-autocomplete__results"));
    const visible = blocks.find((b) => b.style.display !== "none") ?? blocks[0];
    if (!visible) return false;
    const lis = Array.from(visible.querySelectorAll<HTMLLIElement>("li"));
    const li =
      lis.find((x) => (x.textContent ?? "").includes(fio)) ??
      lis.find((x) => (x.textContent ?? "").trim() === fio);
    if (!li) return false;
    (li as HTMLElement).click();
    return true;
  }, employeeFullName);
  if (!picked) throw new Error(`Employee not found in autocomplete: "${employeeFullName}"`);
}

async function fillAndSaveSingleBonus(
  page: Page,
  bonus: ExternalBonusToApply,
  timeoutMs: number
) {
  const amountSel = classNameToCss(bonus.amountClass);
  const commentSel = classNameToCss(bonus.commentClass);

  await page.waitForSelector(amountSel, { timeout: timeoutMs });
  await page.click(amountSel, { clickCount: 3 });
  await page.type(amountSel, String(bonus.amountGross), { delay: 5 });

  await page.waitForSelector(commentSel, { timeout: timeoutMs });
  await page.click(commentSel, { clickCount: 3 });
  if (bonus.comment) {
    await page.type(commentSel, bonus.comment, { delay: 2 });
  }

  // Save per bonus
  const validateAwardObjectsPromise = page.waitForResponse(
    (resp) => resp.url().includes("validateawardobjects"),
    { timeout: timeoutMs }
  );
  const savePremiumsPromise = page.waitForResponse(
    (resp) => resp.url().includes("savepremiums"),
    { timeout: timeoutMs }
  );
  const premiumApiPromise = page.waitForResponse(
    (resp) => resp.url().includes("premiumapi"),
    { timeout: timeoutMs }
  );
  await waitAndClick(page, 'img.save-btn[title="Сохранить"], img[title="Сохранить"]', timeoutMs);
  // Wait for the full save chain so the last bonus persists.
  await Promise.all([validateAwardObjectsPromise, savePremiumsPromise, premiumApiPromise]);
}

export async function applyExternalBonuses(
  config: ExternalApplyConfig,
  bonuses: ExternalBonusToApply[],
  callbacks: ExternalApplyCallbacks = {}
): Promise<ExternalApplyResult> {
  const timeoutMs = config.timeoutMs ?? 30_000;
  const headless = config.headless ?? true;

  const browser = await puppeteer.launch({
    headless,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.authenticate({
      username: config.basicAuth.username,
      password: config.basicAuth.password,
    });
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded" });

    const result: ExternalApplyResult = { applied: 0, errors: [] };

    const total = bonuses.length;
    let processed = 0;
    let lastEmployee: string | null = null;
    let employeeStarted = false;

    // Employee completion stats (per employee for the given "bonuses" slice).
    const employeeTotals = new Map<number, number>();
    const employeeProcessed = new Map<number, number>();
    const employeeApplied = new Map<number, number>();
    const employeeErrors = new Map<number, number>();
    const employeeFullNameById = new Map<number, string>();

    for (const bonus of bonuses) {
      employeeTotals.set(bonus.employeeId, (employeeTotals.get(bonus.employeeId) ?? 0) + 1);
      employeeProcessed.set(bonus.employeeId, employeeProcessed.get(bonus.employeeId) ?? 0);
      employeeApplied.set(bonus.employeeId, employeeApplied.get(bonus.employeeId) ?? 0);
      employeeErrors.set(bonus.employeeId, employeeErrors.get(bonus.employeeId) ?? 0);
      employeeFullNameById.set(bonus.employeeId, bonus.employeeFullName);
    }

    for (const bonus of bonuses) {
      const currentEmployeeId = bonus.employeeId;
      const currentEmployeeFullName = bonus.employeeFullName;
      let errorReason: string | null = null;

      try {
        if (bonus.employeeFullName !== lastEmployee) {
          lastEmployee = bonus.employeeFullName;
          employeeStarted = false;
        }

        if (!employeeStarted) {
          const row = await findEmployeeRowHandle(page, bonus.employeeFullName, timeoutMs);
          await clickEditInRow(page, row, timeoutMs);
          employeeStarted = true;
        } else {
          await clickAddAndPickEmployee(page, bonus.employeeFullName, timeoutMs);
        }

        await fillAndSaveSingleBonus(page, bonus, timeoutMs);
        result.applied += 1;

        employeeApplied.set(currentEmployeeId, (employeeApplied.get(currentEmployeeId) ?? 0) + 1);
      } catch (e) {
        errorReason = e instanceof Error ? e.message : String(e);
        result.errors.push({
          employeeFullName: bonus.employeeFullName,
          reason: errorReason,
        });

        employeeErrors.set(currentEmployeeId, (employeeErrors.get(currentEmployeeId) ?? 0) + 1);
      }

      processed += 1;
      employeeProcessed.set(
        currentEmployeeId,
        (employeeProcessed.get(currentEmployeeId) ?? 0) + 1
      );

      if (callbacks.onProgress) {
        await callbacks.onProgress({
        total,
        processed,
        applied: result.applied,
        errorsCount: result.errors.length,
        currentEmployeeId,
        currentEmployeeFullName,
        });
      }

      if (errorReason) {
        if (callbacks.onError) {
          await callbacks.onError({
          employeeId: currentEmployeeId,
          employeeFullName: currentEmployeeFullName,
          reason: errorReason,
          total,
          processed,
          applied: result.applied,
          errorsCount: result.errors.length,
          });
        }
      }

      const finishedForEmployee =
        (employeeProcessed.get(currentEmployeeId) ?? 0) === (employeeTotals.get(currentEmployeeId) ?? 0);

      if (finishedForEmployee) {
        const employeeTotal = employeeTotals.get(currentEmployeeId) ?? 0;
        const employeeAppliedCount = employeeApplied.get(currentEmployeeId) ?? 0;
        const employeeErrorsCount = employeeErrors.get(currentEmployeeId) ?? 0;

        if (callbacks.onEmployeeCompleted) {
          await callbacks.onEmployeeCompleted({
            employeeId: currentEmployeeId,
            employeeFullName:
              employeeFullNameById.get(currentEmployeeId) ?? currentEmployeeFullName,
            succeeded: employeeErrorsCount === 0,
            employeeApplied: employeeAppliedCount,
            employeeTotal,
          });
        }
      }
    }

    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

