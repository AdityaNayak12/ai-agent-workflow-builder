import { NhostClient } from '@nhost/react';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local';
const region = process.env.NEXT_PUBLIC_NHOST_REGION || 'local';

export const nhost = new NhostClient({
  subdomain,
  region,
});

const HASURA_GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';

const httpLink = createHttpLink({
  uri: HASURA_GRAPHQL_ENDPOINT,
});

const authLink = setContext((_, { headers }) => {
  const token = nhost.auth.getAccessToken();

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
