export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { syncCatalogFromCrmOnBoot } = await import(
    "@/lib/crm/sync-catalog-from-crm"
  );
  syncCatalogFromCrmOnBoot();
}
