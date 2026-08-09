import { NhostClient } from '@nhost/react';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local';
const region = process.env.NEXT_PUBLIC_NHOST_REGION || 'local';

export const nhost = new NhostClient({
  subdomain,
  region,
});

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || '/api/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = nhost.auth.getAccessToken();
  const adminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET || 'nhost-admin-secret';

  let userId = nhost.auth.getUser()?.id;
  if (!userId && typeof window !== 'undefined') {
    const devEmail = localStorage.getItem('nhost_dev_user_email');
    if (devEmail === 'new-dev-user@company.com') {
      userId = '99999999-9999-9999-9999-999999999999';
    } else {
      userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    }
  }

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-hasura-admin-secret': adminSecret,
      ...(userId ? { 'x-hasura-user-id': userId, 'x-hasura-role': 'user' } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
