# Daily NBE Exchange-Rate Update Instruction

## Objective

Keep EthioMLS's USD/ETB conversion rate synchronized with the National Bank of
Ethiopia's official Indicative Daily Exchange Rate.

The NBE rate is a reference/accounting rate based on the previous business
day's transactions. It is not a mandatory retail transaction rate.

## Official source

- Publisher: National Bank of Ethiopia
- Public rates page:
  `https://nbe.gov.et/exchange/indicatives-rates/`
- Official JSON endpoint used by that page:
  `https://api.nbe.gov.et/api/filter-exchange-rates?date=YYYY-MM-DD`
- Currency row: `currency.code === "USD"`
- App rate: numeric `weighted_average`
- Source date: row `date`

Do not scrape the HTML page and do not use a third-party exchange-rate API.

## Schedule

Run once every weekday at **06:15 UTC / 09:15 East Africa Time**.

NBE publishes weekday rates. On weekends and Ethiopian/NBE holidays, retain the
most recent verified rate. A missed daily run must retry the previous seven
calendar dates, newest first, until an official USD row is found.

## Fetch procedure

1. Request today's official API URL with:
   - method: `GET`
   - `Accept: application/json`
   - a descriptive `User-Agent`, for example `EthioMLS/1.0 rate-sync`
   - a 10-second timeout
2. Require HTTP 200.
3. Parse the JSON and require:
   - `success === true`
   - `data` is an array
   - exactly one usable row where `currency.code === "USD"`
4. Read:
   - `weighted_average` as the primary USD/ETB rate
   - `buying` and `selling` for audit/display purposes
   - `date` as the official effective date
5. If no USD row exists, query the preceding date. Try at most seven dates.

## Validation rules

Before storing a result:

- Convert all rate strings to finite positive numbers.
- Require `weighted_average` to be between `50` and `500` ETB per USD.
- Require `buying <= selling`.
- Require `weighted_average` to be between buying and selling, allowing a
  rounding tolerance of `0.05`.
- Require the official date not to be in the future.
- Reject duplicate records for the same source, currency pair, and date.
- If the new weighted average changes by more than 20% from the last verified
  value, do not publish it automatically. Record an operational alert and keep
  serving the previous verified rate until an administrator reviews it.

Never replace a valid stored rate with the static proxy baseline.

## Persistence

Store each verified observation in PostgreSQL/Supabase rather than changing an
environment variable. Environment variables are deployment configuration and
are not suitable for daily mutable data.

The rate table should retain:

- `baseCurrency`: `"USD"`
- `quoteCurrency`: `"ETB"`
- `weightedAverage`
- `buyingRate`
- `sellingRate`
- `effectiveDate`
- `source`: `"NBE"`
- `sourceUrl`
- `fetchedAt`
- `isVerified`

Enforce a unique constraint on:

`(source, baseCurrency, quoteCurrency, effectiveDate)`

Use an upsert so retries are idempotent.

## App behavior

1. Server-side financial and foreign-buyer eligibility calculations must read
   the latest verified NBE USD/ETB record.
2. The public conversion UI must obtain the same server-provided value. Do not
   compile `NEXT_PUBLIC_NBE_USD_ETB_RATE` into the client bundle.
3. Cache the latest record for no more than one hour.
4. Display:
   - `1 USD = {weightedAverage} ETB`
   - `NBE indicative rate`
   - the official effective date
5. If synchronization fails, continue using the latest verified database
   record and mark it as stale when it is more than three business days old.
6. Use the existing static proxy baseline only when the database has never
   received a verified NBE rate. Log this as a high-priority configuration
   warning.

## Logging and monitoring

Each run must log:

- requested date(s)
- selected official date
- fetched USD rate
- whether the database row was inserted, updated, or unchanged
- elapsed time

Failures must include the HTTP status or validation reason without logging
database credentials. Alert when no verified rate has been stored for three
consecutive business days.

## Acceptance checks

- A successful run stores the official USD weighted average for its effective
  date.
- Running the job twice creates no duplicate rows.
- A weekend run retains/fetches the latest weekday rate.
- A malformed or implausible response cannot replace the latest verified rate.
- Property pricing, foreign-buyer eligibility, search conversions, and
  Telegram output all use the same latest verified database rate.
- The UI shows the NBE source and effective date.
