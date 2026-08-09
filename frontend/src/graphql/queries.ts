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

export const GET_WORKFLOW_DETAIL = gql`
  query GetWorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      is_active
      created_at
      updated_at
      steps(order_by: { step_order: asc }) {
        id
        workflow_id
        step_order
        type
        name
        config
      }
    }
  }
`;
