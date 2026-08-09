CREATE TABLE IF NOT EXISTS workflow_run_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_run_id UUID NOT NULL REFERENCES step_runs(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_results_run_id ON workflow_run_results(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_results_step_run_id ON workflow_run_results(step_run_id);
