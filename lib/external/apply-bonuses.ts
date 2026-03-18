import puppeteer, { type CookieParam, type Page } from "puppeteer";

export type ExternalBonusToApply = {
  employeeFullName: string;
  amountGross: number;
  comment: string;
  amountClass: string;
  commentClass: string;
};

export type ExternalApplyConfig = {
  targetUrl: string;
  cookies: CookieParam[];
  timeoutMs?: number;
  headless?: boolean;
};

export type ExternalApplyResult = {
  applied: number;
  errors: Array<{ employeeFullName: string; reason: string }>;
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
    const row =
      rows.find((r) => r.textContent?.includes(fio)) ??
      rows.find((r) =>
        Array.from(r.querySelectorAll('[name-cell="fio"]')).some((n) =>
          (n.textContent ?? "").trim() === fio
        )
      );
    return row ?? null;
  }, employeeFullName);
  const el = handle.asElement();
  if (!el) throw new Error(`Row not found for "${employeeFullName}"`);
  return el;
}

async function clickEditInRow(page: Page, row: puppeteer.ElementHandle<Element>, timeoutMs: number) {
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
  await waitAndClick(page, 'img.save-btn[title="Сохранить"], img[title="Сохранить"]', timeoutMs);
  // Heuristic: wait a short tick for table refresh
  await page.waitForNetworkIdle({ idleTime: 200, timeout: timeoutMs }).catch(() => {});
}

export async function applyExternalBonuses(
  config: ExternalApplyConfig,
  bonuses: ExternalBonusToApply[]
): Promise<ExternalApplyResult> {
  const timeoutMs = config.timeoutMs ?? 30_000;
  const headless = config.headless ?? true;

  const browser = await puppeteer.launch({
    headless,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);

    if (config.cookies?.length) {
      await page.setCookie(...config.cookies);
    }

    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded" });

    const result: ExternalApplyResult = { applied: 0, errors: [] };

    let lastEmployee: string | null = null;
    let employeeStarted = false;

    for (const bonus of bonuses) {
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
      } catch (e) {
        result.errors.push({
          employeeFullName: bonus.employeeFullName,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

