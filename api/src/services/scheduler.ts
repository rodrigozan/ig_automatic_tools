import cron from "node-cron";
import { recoverOnStartup, runPublisherTick } from "./publisher";
import { refreshPublishLimits, refreshTokens } from "./tokens";
import { runDailyCleanup } from "./cleanup";
import { resumePendingMedia } from "./mediaProcessing";

export const minuteTasks: ((now: Date) => Promise<void>)[] = [];

function safe(name: string, fn: () => Promise<void>) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`falha na tarefa ${name}`, err instanceof Error ? err.stack : err);
    }
  };
}

export async function startScheduler() {
  await safe("retomar mídias", resumePendingMedia)();
  await safe("recuperar atrasadas", () => recoverOnStartup(new Date()))();

  cron.schedule(
    "* * * * *",
    safe("minuto", async () => {
      const now = new Date();
      await runPublisherTick(now);
      for (const task of minuteTasks) await task(now);
    }),
    { noOverlap: true }
  );

  cron.schedule(
    "17 3 * * *",
    safe("diária", async () => {
      const now = new Date();
      await refreshTokens(now);
      await refreshPublishLimits();
      await runDailyCleanup(now);
    }),
    { timezone: "America/Sao_Paulo" }
  );
}
