// Apollo.io People Match API — email + phone lookup by name + company.
// Auth: APOLLO_API_KEY (X-Api-Key header). Free tier ~50 req/min.
// Ported from Advisor Vantage (lib/apollo.ts); rewritten to fetch to match
// WorkBox's conventions (no axios dependency).

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export interface ApolloEnrichResult {
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

interface ApolloPerson {
  email?: string | null;
  phone_numbers?: { raw_number: string }[];
  linkedin_url?: string | null;
}

interface ApolloMatchResponse {
  person: ApolloPerson | null;
}

export class ApolloNotConfiguredError extends Error {
  constructor() {
    super("APOLLO_API_KEY is not set");
    this.name = "ApolloNotConfiguredError";
  }
}

export async function enrichContact(params: {
  first_name: string;
  last_name: string;
  company: string;
}): Promise<ApolloEnrichResult | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new ApolloNotConfiguredError();

  const res = await fetch(`${APOLLO_BASE}/people/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      first_name: params.first_name,
      last_name: params.last_name,
      organization_name: params.company,
      reveal_personal_emails: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Apollo ${res.status}`);

  const data = (await res.json()) as ApolloMatchResponse;
  if (!data.person) return null;
  const { person } = data;
  return {
    email: person.email ?? null,
    phone: person.phone_numbers?.[0]?.raw_number ?? null,
    linkedin_url: person.linkedin_url ?? null,
  };
}
