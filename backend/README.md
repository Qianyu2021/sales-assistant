# Backend

This backend accepts a lead from the manual form, enriches it, and returns a scored company or property profile.

## Run

```bash
cd backend
node server.js
```

The API listens on `http://localhost:8787` by default.

The Vite frontend proxies `/api` to this backend, and the manual lead form uses
`/api/leads/enrich` by default. Set `VITE_ENRICHMENT_WEBHOOK_PATH` only if you
want the frontend to call an imported n8n webhook workflow instead.

## Endpoint

`POST /api/leads/enrich`

Request body:

```json
{
  "firstName": "Sarah",
  "lastName": "Chen",
  "email": "sarah@greywoodprops.com",
  "company": "Greywood Properties",
  "address": "4821 Lakeview Drive",
  "city": "Austin",
  "state": "TX",
  "source": "manual"
}
```

## Pipeline

1. Normalize company, email, and address fields.
2. Resolve the location from the address with the Census Geocoder.
3. Pull ACS data for median income and a multifamily share proxy from `B25032`.
4. Pull public review volume/rating signals from Google Places when a key is available.
5. Pull free public web/news evidence from the GDELT DOC API.
6. Pull growth and market-pressure signals from NewsAPI and FRED when keys are available.
7. Compute baseline deterministic category scores.
8. Run specialist AI agents when Gemini or OpenAI is configured: Search Research, Review Pain, and Growth + Market.
9. Run a final evaluator agent that reviews specialist findings and adjusts the score.
10. Use Gemini first, or OpenAI as an optional fallback, to write the score narrative and rep talking points from the final score.

The provider layer is designed to work offline with deterministic fallback data, so the UI can be built and tested without every live API key present.

## Public APIs Used And Why

- Google Places API: used to find the property or operating company, capture public rating/review count, and discover official property websites when available. Reviews and website links are useful proxies for resident base, operational complexity, and leasing/customer-service pressure.
- U.S. Census Geocoder: used to resolve a property address into a normalized location, county, tract, ZIP, and coordinates. This keeps the market analysis tied to the property location, not the sender company's office address.
- Census ACS API: used for public demographic context such as median household income and multifamily housing concentration. These help estimate renter-market strength and apartment density.
- GDELT DOC API: used as a free public web/news search source for signals such as portfolio scale, acquisitions, development activity, hiring, leasing pages, complaints, reviews, and management-company mentions.
- FRED API: used for rental-market pressure signals such as rent trend and vacancy-rate context where available.
- NewsAPI: optional source for recent growth, development, acquisition, hiring, and expansion signals when a key is configured.
- Gmail API: used for inbox connection and inbound lead capture. It is not part of the scoring model by itself; it triggers enrichment when a qualified customer inquiry arrives.
- Google Gemini API: used for structured extraction, specialist agent review, final evaluation, narrative writing, and draft email generation. Gemini is used first because the project is configured to keep the Google/Gemini key as the primary AI provider.

## Free APIs By Score Category

The scoring model is built so each category can use free or public-data sources first. Some providers require a free API key or have free-tier limits, but the workflow can still run with fallback signals when a key is missing.

| Score category | Free/public APIs used | API key / env vars | What the API contributes |
| --- | --- | --- | --- |
| Portfolio fit and size | Google Places API, GDELT DOC API, Gmail API, property/operator websites discovered through public search | `GOOGLE_PLACES_API_KEY` or `Google_PLACE_API_KEY`; no key for GDELT, configured with `GDELT_DOC_BASE_URL`; `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` for Gmail intake | Google Places can find the official property website and review footprint. GDELT/public web evidence looks for operator, owner, managed-by language, portfolio, units, communities, and multifamily business fit. Gmail signature/domain evidence can identify the sender or operating company. |
| Leasing demand | Google Places API, GDELT DOC API, property websites, listing pages, FRED API | `GOOGLE_PLACES_API_KEY` or `Google_PLACE_API_KEY`; no key for GDELT, configured with `GDELT_DOC_BASE_URL`; `FRED_API_KEY` and `FRED_API_BASE_URL` | Public search and fetched property websites look for availability, floor plans, schedule-a-tour CTAs, apply-now pages, active listings, and leasing language. FRED market indicators add rent/vacancy pressure when available. |
| Operational pain | Google Places API, GDELT DOC API, NewsAPI when configured | `GOOGLE_PLACES_API_KEY` or `Google_PLACE_API_KEY`; no key for GDELT, configured with `GDELT_DOC_BASE_URL`; `NEWS_API_KEY` and `NEWS_API_BASE_URL` | Google Places gives rating and review count. Public web/news evidence looks for reviews, complaints, response issues, leasing-office staffing, hiring, maintenance, resident communication, and reputation pressure. NewsAPI can add recent hiring, growth, complaints, or operational headlines. |
| Market attractiveness | U.S. Census Geocoder, Census ACS API, FRED API | Census Geocoder does not require a key, configured with `CENSUS_GEOCODER_BASE_URL`; ACS uses optional `CENSUS_API_KEY` and `CENSUS_DATA_BASE_URL`; FRED uses `FRED_API_KEY` and `FRED_API_BASE_URL` | Census Geocoder anchors the analysis to the property address. ACS adds median income and multifamily concentration. FRED adds rental-market pressure such as rent trend and vacancy context. |
| AI opportunity | GDELT DOC API, fetched property/operator websites, Google Places website links | No key for GDELT, configured with `GDELT_DOC_BASE_URL`; `GOOGLE_PLACES_API_KEY` or `Google_PLACE_API_KEY` for website discovery | Public websites are scanned for phone, email, text, contact-form, office-hours, chatbot, live-chat, AI assistant, resident portal, RentCafe, Entrata, AppFolio, Yardi, and similar workflow signals. The score is higher when traditional contact channels are visible and chatbot/AI coverage is not. |
| Lead intake and extraction | Gmail API, Google Gemini API | Gmail uses `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, and optional `GMAIL_SEARCH_QUERY`; Gemini uses `GOOGLE_GEMINI_API_KEY` or `GOOGLE_Gemini_API_KEY` or `Google_Gemini_API_KEY`, plus `GOOGLE_GEMINI_MODEL` or `Google_model` | Gmail provides inbound messages. Gemini extracts structured lead fields from the email body and signature, including sender name, property name, property address, operating company, and signature/company address. |
| Narrative and outreach | Google Gemini API, optional OpenAI fallback | Gemini uses `GOOGLE_GEMINI_API_KEY` or `GOOGLE_Gemini_API_KEY` or `Google_Gemini_API_KEY`, plus `GOOGLE_GEMINI_MODEL` or `Google_model`; OpenAI fallback uses `OPENAI_API_KEY` and `OPENAI_MODEL` | Gemini reviews the structured evidence and writes the category insights, overall analysis, recommended next step, and draft reply/prospecting email. OpenAI is only a fallback if configured. |

### API Key Details

- `GOOGLE_PLACES_API_KEY` or `Google_PLACE_API_KEY`: Google Places key. Used for property/company lookup, rating, review count, and official website discovery. It supports portfolio fit, leasing demand, operational pain, AI opportunity, and source discovery.
- `CENSUS_API_KEY`: optional U.S. Census API key. Used by the ACS data provider for median household income and multifamily concentration. It supports market attractiveness and portfolio fit.
- `CENSUS_DATA_BASE_URL`: base URL for the Census ACS API. Defaults to `https://api.census.gov`.
- `CENSUS_GEOCODER_BASE_URL`: base URL for the U.S. Census Geocoder. It does not require an API key in this app. It turns a property address into a normalized location so local market data is attached to the correct property.
- `FRED_API_KEY`: Federal Reserve Economic Data API key. Used for rental vacancy and rent trend signals. It supports leasing demand and market attractiveness.
- `FRED_API_BASE_URL`: base URL for FRED. Defaults to `https://api.stlouisfed.org`.
- `NEWS_API_KEY`: NewsAPI key. Optional. Used for recent company growth, acquisition, development, hiring, or operational-pressure headlines. It supports operational pain, leasing demand, and portfolio/growth context.
- `NEWS_API_BASE_URL`: base URL for NewsAPI. Defaults to `https://newsapi.org`.
- `GDELT_DOC_BASE_URL`: GDELT DOC API base URL. No API key is used. It supports public web/news evidence for portfolio scale, leasing activity, operator discovery, reviews, complaints, and growth.
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`: Google OAuth credentials for Gmail. Used to connect an inbox and trigger enrichment from inbound sales inquiries.
- `GMAIL_SEARCH_QUERY`: optional Gmail search query controlling which inbox messages are checked.
- `GOOGLE_GEMINI_API_KEY`, `GOOGLE_Gemini_API_KEY`, or `Google_Gemini_API_KEY`: Gemini API key. Used for email extraction, AI agent review, final evaluation, narrative, and draft email generation.
- `GOOGLE_GEMINI_MODEL` or `Google_model`: Gemini model name. Defaults to `gemini-2.5-flash`.
- `OPENAI_API_KEY`: optional OpenAI API key. Used only as a fallback LLM provider when Gemini is not configured.
- `OPENAI_MODEL`: optional OpenAI model name. Defaults to `gpt-4o-mini`.

## Enrichment, Scoring, And Output Workflow

The app accepts leads from manual input or Gmail. Gmail leads are parsed from the email body and signature. The body is treated as the source for the property or apartment name and property address. The sender signature is treated as evidence for the sender or operating company, including company name and office address.

After intake, the backend normalizes the lead and enriches it in stages:

1. Identify the contact, property, apartment, operator, sender company, property address, and signature company address.
2. Geocode the property address so local income, multifamily density, and market context are based on the property location.
3. Pull public review and website evidence from Google Places.
4. Search public web/news sources for portfolio size, leasing activity, operating-company relationship, hiring, growth, reviews, complaints, and contact-channel signals.
5. Pull market and demographic signals from Census/FRED-style public data.
6. Calculate category scores, then let AI agents review the evidence and adjust conservatively when public evidence is stronger or weaker than the baseline.
7. Return a lead score, category-level explanations, overall analysis, recommended next step, and a draft outreach/reply email.

The final score is the sum of five category point scores:

- Portfolio fit and size: 30 points
- Leasing demand: 25 points
- Operational pain: 25 points
- Market attractiveness: 15 points
- AI opportunity: 5 points

For Gmail leads, the draft email is written as a reply to the inbound inquiry. It uses the sender's real name when available, answers the inquiry at a high level, introduces EliseAI in the context of the property/operator, asks discovery questions, and suggests a call. For manual leads, the draft is a prospecting email for the sales rep to send.

## Assumptions And Scoring Logic

- Larger apartment operators have higher automation ROI because they manage more inquiries, residents, leasing workflows, and repetitive communication.
- A property-level lead may actually belong to a larger operating company. The app therefore tries to identify the parent/operator from the property website, public search evidence, sender email domain, and signature.
- The property address should drive local market analysis. The sender company's signature address is useful for identifying the operator, but it should not replace the apartment/property location.
- Active floor plans, availability pages, tour CTAs, ILS listings, and rental-market pressure suggest stronger leasing demand.
- Review volume is a proxy for resident base and communication load. Low ratings, response complaints, staffing mentions, and maintenance/communication issues increase operational-pain scoring.
- If public evidence shows phone, email, text, or contact forms without visible chatbot/AI coverage, the AI-opportunity score increases because EliseAI may fill an obvious automation gap.
- Scores remain conservative when evidence is missing. Fallback data keeps the app usable, but the narrative calls out uncertainty so reps can verify it in discovery.
- AI agents do not invent facts. They review the collected evidence and pass structured findings into a final evaluator, which can adjust category scores when the evidence supports it.

## How This Helps A Sales Rep

This workflow turns a raw apartment or property-management inquiry into a rep-ready qualification summary. Instead of manually searching Google, apartment websites, reviews, market data, and company pages, the rep sees the likely operator, property context, category scores, evidence-backed reasoning, and a suggested next step in one place.

The category score breakdown helps the rep understand why a lead is hot, warm, or cold. For example, a large multifamily operator with active listings, many reviews, hiring signals, and no visible chatbot can be prioritized quickly because the likely ROI and pain are clearer. A small single-property lead with little online leasing activity can be handled with lighter discovery.

The outreach email helps the rep act immediately. For inbound Gmail leads, it drafts a reply that acknowledges the sender's question, introduces EliseAI for leasing and resident communication workflows, and asks discovery questions about inquiry volume, channels, and portfolio scope. For manual leads, it gives the rep a prospecting message grounded in the public evidence found during enrichment.

## Swap in real data providers

- `providers/location.js`: Census Geocoder address matching and geography lookup.
- `providers/demographics.js`: ACS multifamily share and median-income pull.
- `providers/reviews.js`: Google Places search and details lookup.
- `providers/search.js`: GDELT public web/news evidence for rental fit, growth, reviews, and response pain.
- `providers/agents.js`: multi-agent review and final evaluator scoring adjustments.
- `providers/news.js`: growth-trigger collection and classification.
- `providers/market.js`: FRED-based market pressure.
- `providers/scoring.js`: category weights and final scoring logic.
