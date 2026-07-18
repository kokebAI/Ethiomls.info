import { redirect } from "next/navigation";
import { PropertyForm } from "@/src/components/PropertyForm";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const session = await getSession();
  const query = await searchParams;

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: {
      id: true,
      role: true,
      faydaIdentity: { select: { id: true } },
      developerProfile: {
        select: {
          id: true,
          tin: true,
          projects: {
            select: { id: true, title: true },
            orderBy: { createdAt: "desc" },
            take: 40,
          },
        },
      },
    },
  });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const typeRaw = (query.type ?? "").toUpperCase().replace(/-/g, "_");
  const defaultListingType =
    typeRaw === "OFF_PLAN" || typeRaw === "SALE" || typeRaw === "RENT"
      ? typeRaw
      : user.role === "CORPORATE_DEVELOPER"
        ? "OFF_PLAN"
        : undefined;

  const projectOptions =
    user.developerProfile?.projects.map((project) => {
      const title =
        project.title &&
        typeof project.title === "object" &&
        project.title !== null &&
        "en" in (project.title as object)
          ? String((project.title as { en?: string }).en ?? "Project")
          : "Project";
      return { id: project.id, title };
    }) ?? [];

  return (
    <main className="relative z-10 px-4 py-10 sm:px-6 lg:py-16">
      <PropertyForm
        ownerId={user.id}
        role={user.role}
        hasFayda={Boolean(user.faydaIdentity)}
        hasDeveloperProfile={Boolean(user.developerProfile)}
        developerTin={user.developerProfile?.tin ?? null}
        projectOptions={projectOptions}
        defaultListingType={defaultListingType}
      />
    </main>
  );
}
