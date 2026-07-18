"use client";

import { useState } from "react";
import Link from "next/link";
import { BuildingScrollView } from "@/components/building/building-scroll-view";
import { useTranslation } from "@/hooks/useTranslation";
import type { Building, BuildingUnit } from "@/lib/building/types";
import { formatMoney } from "@/lib/compliance/currency";

type ProjectBuildingDetailProps = {
  building: Building;
  stageLabel: string;
  completionPercent: number;
  developerName: string;
  developerHref?: string | null;
  telegram?: string | null;
  website?: string | null;
  projectAmenities?: string[];
};

function listingTypeKey(type: BuildingUnit["listingType"]): string {
  switch (type) {
    case "RENT":
      return "listing.forRent";
    case "OFF_PLAN":
      return "listing.offPlan";
    default:
      return "listing.forSale";
  }
}

export function ProjectBuildingDetail({
  building,
  stageLabel,
  completionPercent,
  developerName,
  developerHref,
  telegram,
  website,
  projectAmenities = [],
}: ProjectBuildingDetailProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<BuildingUnit | null>(null);

  const amenities =
    selected?.amenities && selected.amenities.length > 0
      ? selected.amenities
      : projectAmenities;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 text-sm text-slate-600">
        <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-800 ring-1 ring-violet-600/15 ring-inset">
          {stageLabel}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 ring-1 ring-emerald-600/15 ring-inset">
          {t("listing.completionPercent")}: {completionPercent}%
        </span>
        {developerHref ? (
          <Link
            href={developerHref}
            className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-500/15 ring-inset hover:bg-slate-200"
          >
            {developerName}
          </Link>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-500/15 ring-inset">
            {developerName}
          </span>
        )}
      </div>

      {(telegram || website) && (
        <p className="flex flex-wrap gap-4 text-sm">
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              {t("listing.website")}
            </a>
          ) : null}
          {telegram ? (
            <a
              href={telegram}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              {t("listing.telegram")}
            </a>
          ) : null}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-950 p-1 shadow-[0_28px_80px_rgba(8,18,36,0.28)] sm:p-1.5">
        <div className="rounded-[0.95rem] bg-white p-4 sm:p-6">
          <BuildingScrollView building={building} onUnitSelect={setSelected} />
        </div>
      </section>

      {selected ? (
        <section
          className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-[var(--shadow-card)]"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">
                {t("listing.propertyId")}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 sm:text-base">
                {selected.propertyId ?? selected.id}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">
                {selected.title ?? selected.unitLabel}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("building.floorLabel", { level: selected.floor })} ·{" "}
                {selected.unitLabel}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => setSelected(null)}
            >
              {t("building.closePanel")}
            </button>
          </div>

          {selected.description ? (
            <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-700">
              {selected.description}
            </p>
          ) : null}

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("listing.price")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {formatMoney(selected.price, selected.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("listing.listingType")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {t(listingTypeKey(selected.listingType))}
              </dd>
            </div>
            {typeof selected.bedrooms === "number" ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("listing.bedrooms")}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {selected.bedrooms}
                </dd>
              </div>
            ) : null}
            {typeof selected.bathrooms === "number" ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("listing.bathrooms")}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {selected.bathrooms}
                </dd>
              </div>
            ) : null}
            {typeof selected.sizeM2 === "number" ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("listing.floorArea")}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {selected.sizeM2} m²
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("listing.status")}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {t(`building.status.${selected.status}`)}
              </dd>
            </div>
          </dl>

          {amenities.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("amenities.title")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {amenities.map((amenity) => (
                  <li
                    key={amenity}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {amenity}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-slate-600" role="status">
          {t("pages.projects.selectUnit")}
        </p>
      )}
    </div>
  );
}
