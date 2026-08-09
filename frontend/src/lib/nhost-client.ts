import { NhostClient } from '@nhost/react';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:1337/v1';
const HASURA_GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';

export const nhost = new NhostClient({
  authUrl,
  graphqlUrl: HASURA_GRAPHQL_ENDPOINT,
  storageUrl: 'http://localhost:1337/v1/storage',
  functionsUrl: 'http://localhost:1337/v1/functions',
});

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
