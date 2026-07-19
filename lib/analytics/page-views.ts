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
  series: Array<{ day: string; pageViews: number }>;
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
      select: { day: true, pageViews: true },
      orderBy: { day: "asc" },
    }),
  ]);

  const byDay = new Map(
    weekRows.map((row) => [row.day.toISOString().slice(0, 10), row.pageViews]),
  );
  const series: Array<{ day: string; pageViews: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = utcDayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    const key = date.toISOString().slice(0, 10);
    series.push({ day: key, pageViews: byDay.get(key) ?? 0 });
  }

  return {
    today: todayRow?.pageViews ?? 0,
    last7Days: series.reduce((sum, row) => sum + row.pageViews, 0),
    series,
  };
}
