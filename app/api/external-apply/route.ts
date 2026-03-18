import { applyExternalBonuses } from "@/lib/external/apply-bonuses";
import { getBonusesForYearMonth, getMonthStatus, getSetting, upsertMonthStatus } from "@/lib/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SseFrame =
  | { type: "progress"; total: number; processed: number; applied: number; errorsCount: number; currentEmployeeId: number; currentEmployeeFullName: string }
  | { type: "error"; employeeId: number; employeeFullName: string; reason: string }
  | { type: "employeeCompleted"; employeeId: number; employeeFullName: string; succeeded: boolean; employeeApplied: number; employeeTotal: number }
  | { type: "done"; total: number; processed: number; applied: number; errorsCount: number };

function encodeSseFrame(frame: SseFrame): Uint8Array {
  const json = JSON.stringify(frame);
  return new TextEncoder().encode(`data: ${json}\n\n`);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const monthRaw = url.searchParams.get("month");

  const year = yearRaw ? parseInt(yearRaw, 10) : NaN;
  const month = monthRaw ? parseInt(monthRaw, 10) : NaN;

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return new Response(JSON.stringify({ error: "Некорректный год" }), { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return new Response(JSON.stringify({ error: "Некорректный месяц" }), { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: SseFrame) => {
        controller.enqueue(encodeSseFrame(frame));
      };

      let total = 0;
      let processed = 0;
      let applied = 0;
      let errorsCount = 0;

      try {
        const [targetUrl, externalBasicAuthUsername, externalBasicAuthPassword] = await Promise.all([
          getSetting("externalTargetUrl"),
          getSetting("externalBasicAuthUsername"),
          getSetting("externalBasicAuthPassword"),
        ]);

        if (!targetUrl) throw new Error("Не задан externalTargetUrl в Settings");
        if (!externalBasicAuthUsername || !externalBasicAuthPassword) {
          throw new Error("Не заданы externalBasicAuthUsername/externalBasicAuthPassword в Settings");
        }

        const bonuses = await getBonusesForYearMonth(year, month);
        const toApply = bonuses
          .map((b) => {
            const amountClass = b.bonusTypeExternalAmountClass?.trim() ?? "";
            const commentClass = b.bonusTypeExternalCommentClass?.trim() ?? "";
            if (!amountClass || !commentClass) return null;
            return {
              employeeId: b.employeeId,
              employeeFullName: b.employeeFullName,
              amountGross: b.amountGross,
              comment: b.comment ?? "",
              amountClass,
              commentClass,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);

        total = toApply.length;
        processed = 0;
        applied = 0;
        errorsCount = 0;

        await applyExternalBonuses(
          {
            targetUrl,
            basicAuth: {
              username: externalBasicAuthUsername,
              password: externalBasicAuthPassword,
            },
            headless: true,
          },
          toApply,
          {
            onProgress: async (ev) => {
              processed = ev.processed;
              applied = ev.applied;
              errorsCount = ev.errorsCount;
              total = ev.total;
              send({
                type: "progress",
                total: ev.total,
                processed: ev.processed,
                applied: ev.applied,
                errorsCount: ev.errorsCount,
                currentEmployeeId: ev.currentEmployeeId,
                currentEmployeeFullName: ev.currentEmployeeFullName,
              });
            },
            onError: async (ev) => {
              send({
                type: "error",
                employeeId: ev.employeeId,
                employeeFullName: ev.employeeFullName,
                reason: ev.reason,
              });
            },
            onEmployeeCompleted: async (ev) => {
              if (ev.succeeded) {
                const existing = await getMonthStatus(ev.employeeId, year, month);
                const taxRateOrNull = existing?.taxRate ?? null;
                await upsertMonthStatus(ev.employeeId, year, month, "accrued", taxRateOrNull);
              }
              send({
                type: "employeeCompleted",
                employeeId: ev.employeeId,
                employeeFullName: ev.employeeFullName,
                succeeded: ev.succeeded,
                employeeApplied: ev.employeeApplied,
                employeeTotal: ev.employeeTotal,
              });
            },
          }
        );

        send({
          type: "done",
          total,
          processed,
          applied,
          errorsCount,
        });
        controller.close();
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        if (errorsCount === 0) {
          // Ensure UI shows an error toast even if the failure happened before any `progress` frames.
          errorsCount = 1;
        }
        send({
          type: "error",
          employeeId: -1,
          employeeFullName: "",
          reason,
        });
        send({
          type: "done",
          total,
          processed,
          applied,
          errorsCount,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

