-- CreateTable
CREATE TABLE "site_daily_metrics" (
    "day" DATE NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_daily_metrics_pkey" PRIMARY KEY ("day")
);
