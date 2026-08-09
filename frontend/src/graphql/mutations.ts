import { gql } from '@apollo/client';

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($name: String!, $description: String, $org_id: uuid!) {
    insert_workflows_one(object: { name: $name, description: $description, org_id: $org_id }) {
      id
      name
      description
      org_id
    }
  }
`;

export const UPDATE_WORKFLOW = gql`
  mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String) {
    update_workflows_by_pk(pk_columns: { id: $id }, _set: { name: $name, description: $description }) {
      id
      name
      description
    }
  }
`;

export const INSERT_WORKFLOW_STEPS = gql`
  mutation InsertWorkflowSteps($objects: [workflow_steps_insert_input!]!) {
    insert_workflow_steps(objects: $objects) {
      returning {
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

export const UPDATE_WORKFLOW_STEP = gql`
  mutation UpdateWorkflowStep($id: uuid!, $step_order: Int!, $type: String!, $name: String!, $config: jsonb) {
    update_workflow_steps_by_pk(
      pk_columns: { id: $id }
      _set: { step_order: $step_order, type: $type, name: $name, config: $config }
    ) {
      id
      step_order
      type
      name
      config
    }
  }
`;

export const DELETE_WORKFLOW_STEP = gql`
  mutation DeleteWorkflowStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;

export const DELETE_WORKFLOW_STEPS_FOR_WORKFLOW = gql`
  mutation DeleteWorkflowStepsForWorkflow($workflow_id: uuid!) {
    delete_workflow_steps(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
  }
`;
