/**
 * Key that may call POST /api/crm/ingest-listing.
 * Production Telecloud sets CRM_APP_API_KEY for the outbound CRM register.
 * Accept that same key so CRM (and `npm run scrape:seed-from-crm`) can write
 * listings back without a second secret. CRM_INGEST_API_KEY still wins when set.
 */
export function crmIngestApiKey(): string {
  return (
    process.env.CRM_INGEST_API_KEY?.trim() ||
    process.env.AGT_CRM_API_KEY?.trim() ||
    process.env.CRM_APP_API_KEY?.trim() ||
    ""
  );
}
