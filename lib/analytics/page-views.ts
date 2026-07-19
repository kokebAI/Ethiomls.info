import { prisma } from "@/lib/db/prisma";

/** UTC calendar day at midnight for SiteDailyMetric.day. */
export function utcDayKey(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function recordPageView(): Promise<void> {
  const day = utcDayKey();
  await prisma.siteDailyMetric.upsert({
    where: { day },
    create: { day, pageViews: 1 },
    update: { pageViews: { increment: 1 } },
  });
}

export async function fetchPageViewTotals(): Promise<{
  today: number;
  last7Days: number;
}> {
  const today = utcDayKey();
  const weekAgo = utcDayKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [todayRow, weekRows] = await Promise.all([
    prisma.siteDailyMetric.findUnique({
      where: { day: today },
      select: { pageViews: true },
    }),
    prisma.siteDailyMetric.findMany({
      where: { day: { gte: weekAgo } },
      select: { pageViews: true },
    }),
  ]);

  return {
    today: todayRow?.pageViews ?? 0,
    last7Days: weekRows.reduce((sum, row) => sum + row.pageViews, 0),
  };
}
