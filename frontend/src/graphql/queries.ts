import { gql } from '@apollo/client';

export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(where: { org_id: { _eq: $org_id } }, order_by: { created_at: desc }) {
      id
      org_id
      name
      description
      created_at
      updated_at
      steps {
        id
      }
      triggers {
        id
        type
      }
      runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        created_at
      }
    }
  }
`;
