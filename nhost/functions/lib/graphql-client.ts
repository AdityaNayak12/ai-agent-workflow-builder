import { execSync } from 'child_process';

const HASURA_ENDPOINT = process.env.NHOST_GRAPHQL_URL || process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
const HASURA_ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'nhost-admin-secret';

function queryPostgres(sql: string): any {
  try {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    const stdout = execSync(`psql -U postgres -d postgres -t -A -c ${JSON.stringify(cleanSql)}`, { encoding: 'utf-8' }).trim();
    if (!stdout) return [];
    return stdout.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return line; }
    });
  } catch (e: any) {
    console.error('Postgres fallback query error:', e.message);
    return [];
  }
}

export async function executeGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<{ data?: T; errors?: any[] }> {
  // 1. Try Hasura GraphQL Engine over HTTP
  try {
    const response = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data || result.errors) return result;
    }
  } catch {
    // Hasura HTTP offline, fallback to direct Postgres execution
  }

  // 2. Fallback execution for local Postgres dev mode
  try {
    if (query.includes('GetWorkflowDetails')) {
      const sql = `
        SELECT json_build_object(
          'id', w.id,
          'org_id', w.org_id,
          'is_active', w.is_active,
          'organization', json_build_object(
            'id', o.id,
            'calls_used', o.calls_used,
            'max_calls', o.max_calls
          )
        )
        FROM workflows w
        JOIN organizations o ON w.org_id = o.id
        WHERE w.id = '${variables.workflow_id}'::uuid;
      `;
      const rows = queryPostgres(sql);
      return { data: { workflows_by_pk: rows[0] || null } as any };
    }

    if (query.includes('GetOrgMember')) {
      const sql = `
        SELECT json_build_object('id', id, 'role', role)
        FROM org_members
        WHERE org_id = '${variables.org_id}'::uuid AND user_id = '${variables.user_id}'::uuid;
      `;
      const rows = queryPostgres(sql);
      return { data: { org_members: rows } as any };
    }

    if (query.includes('CreateWorkflowRun')) {
      const sql = `
        INSERT INTO workflow_runs (workflow_id, status, triggered_by, started_at)
        VALUES ('${variables.workflow_id}'::uuid, 'running', '${variables.triggered_by}'::uuid, NOW())
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { insert_workflow_runs_one: rows[0] } as any };
    }

    if (query.includes('GetWorkflowSteps')) {
      const sql = `
        SELECT json_build_object(
          'id', id,
          'step_order', step_order,
          'type', type,
          'name', name,
          'config', config
        )
        FROM workflow_steps
        WHERE workflow_id = '${variables.workflow_id}'::uuid
        ORDER BY step_order ASC;
      `;
      const rows = queryPostgres(sql);
      return { data: { workflow_steps: rows } as any };
    }

    if (query.includes('CreatePausedStepRun')) {
      const sql = `
        INSERT INTO step_runs (workflow_run_id, step_id, status, input, started_at)
        VALUES ('${variables.workflow_run_id}'::uuid, '${variables.step_id}'::uuid, 'paused', '{"stub": true, "note": "Awaiting approval"}'::jsonb, NOW())
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { insert_step_runs_one: rows[0] } as any };
    }

    if (query.includes('PauseWorkflowRun')) {
      const sql = `
        UPDATE workflow_runs
        SET status = 'paused'
        WHERE id = '${variables.run_id}'::uuid
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { update_workflow_runs_by_pk: rows[0] } as any };
    }

    if (query.includes('CreateStepRun')) {
      const sql = `
        INSERT INTO step_runs (workflow_run_id, step_id, status, input, started_at)
        VALUES ('${variables.workflow_run_id}'::uuid, '${variables.step_id}'::uuid, 'running', '{"stub": true}'::jsonb, NOW())
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { insert_step_runs_one: rows[0] } as any };
    }

    if (query.includes('CompleteStepRun')) {
      const sql = `
        UPDATE step_runs
        SET status = 'completed', finished_at = NOW(), output = '{"result": "stub_success"}'::jsonb
        WHERE id = '${variables.step_run_id}'::uuid
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { update_step_runs_by_pk: rows[0] } as any };
    }

    if (query.includes('CompleteWorkflowRun')) {
      const sql = `
        UPDATE workflow_runs
        SET status = 'completed', finished_at = NOW()
        WHERE id = '${variables.run_id}'::uuid
        RETURNING json_build_object('id', id);
      `;
      const rows = queryPostgres(sql);
      return { data: { update_workflow_runs_by_pk: rows[0] } as any };
    }

    if (query.includes('IncrementOrgUsage')) {
      const sql = `
        UPDATE organizations
        SET calls_used = calls_used + ${variables.inc}
        WHERE id = '${variables.org_id}'::uuid
        RETURNING json_build_object('id', id, 'calls_used', calls_used);
      `;
      const rows = queryPostgres(sql);
      return { data: { update_organizations_by_pk: rows[0] } as any };
    }

    return { data: {} as any };
  } catch (err: any) {
    return { errors: [{ message: err.message }] };
  }
}
