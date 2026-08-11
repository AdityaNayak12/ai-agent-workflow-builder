// ponytail: simplified GraphQL client down to 15-line fetch wrapper to Hasura endpoint
const HASURA_ENDPOINT = process.env.NHOST_GRAPHQL_URL || process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'nhost-admin-secret';

export async function executeGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<{ data?: T; errors?: any[] }> {
  const res = await fetch(HASURA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
