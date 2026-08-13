'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { useOrg } from '@/lib/org-context';
import { GET_WORKFLOW_DETAIL } from '@/graphql/queries';
import {
  CREATE_WORKFLOW,
  UPDATE_WORKFLOW,
  INSERT_WORKFLOW_STEPS,
  DELETE_WORKFLOW_STEPS_FOR_WORKFLOW,
} from '@/graphql/mutations';
import { StepList } from '@/components/workflow-builder/StepList';
import { StepItem } from '@/components/workflow-builder/StepEditor';
import { TriggerConfig } from '@/components/workflow-builder/TriggerConfig';

interface GetWorkflowDetailData {
  workflows_by_pk: {
    id: string;
    org_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    steps: {
      id: string;
      workflow_id: string;
      step_order: number;
      type: string;
      name: string;
      config: any;
    }[];
    triggers?: {
      id: string;
      type: string;
      config: any;
      created_at: string;
    }[];
  } | null;
}

interface CreateWorkflowData {
  insert_workflows_one: {
    id: string;
    name: string;
    description?: string;
    org_id: string;
  };
}

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || 'new';
  const isNew = rawId === 'new';

  const { currentOrg, currentRole, loading: orgLoading } = useOrg();
  const isReadOnly = !orgLoading && currentRole !== 'owner' && currentRole !== 'editor';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, loading: detailLoading, refetch } = useQuery<GetWorkflowDetailData>(GET_WORKFLOW_DETAIL, {
    variables: { id: rawId },
    skip: isNew || !rawId,
    fetchPolicy: 'network-only',
  });

  const [createWorkflow] = useMutation<CreateWorkflowData>(CREATE_WORKFLOW);
  const [updateWorkflow] = useMutation(UPDATE_WORKFLOW);
  const [insertWorkflowSteps] = useMutation(INSERT_WORKFLOW_STEPS);
  const [deleteWorkflowSteps] = useMutation(DELETE_WORKFLOW_STEPS_FOR_WORKFLOW);

  useEffect(() => {
    if (!isNew && data?.workflows_by_pk) {
      const wf = data.workflows_by_pk;
      setName(wf.name || '');
      setDescription(wf.description || '');
      if (wf.steps) {
        setSteps(
          wf.steps.map((s) => ({
            id: s.id,
            workflow_id: s.workflow_id,
            step_order: s.step_order,
            type: s.type,
            name: s.name,
            config: s.config || {},
          }))
        );
      }
    } else if (isNew) {
      setName('New Workflow');
      setDescription('');
      setSteps([]);
    }
  }, [isNew, data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!currentOrg?.id) {
      setSaveError('No active organization selected.');
      return;
    }
    if (!name.trim()) {
      setSaveError('Workflow name is required.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      let targetWorkflowId = rawId;

      if (isNew) {
        // Create new workflow
        const wfRes = await createWorkflow({
          variables: {
            name,
            description,
            org_id: currentOrg.id,
          },
        });
        if (!wfRes.data?.insert_workflows_one) {
          throw new Error('Failed to create workflow object.');
        }
        targetWorkflowId = wfRes.data.insert_workflows_one.id;
      } else {
        // Update workflow metadata
        await updateWorkflow({
          variables: {
            id: rawId,
            name,
            description,
          },
        });
        // Delete existing steps for atomic re-insertion
        await deleteWorkflowSteps({
          variables: { workflow_id: rawId },
        });
      }

      // Insert updated steps
      if (steps.length > 0) {
        const stepObjects = steps.map((s, idx) => ({
          workflow_id: targetWorkflowId,
          step_order: idx + 1,
          type: s.type,
          name: s.name,
          config: s.config || {},
        }));

        await insertWorkflowSteps({
          variables: {
            objects: stepObjects,
          },
        });
      }

      setSaving(false);
      router.push('/');
    } catch (err: any) {
      setSaving(false);
      setSaveError(err.message || 'Failed to save workflow.');
    }
  };

  if (orgLoading || (!isNew && detailLoading)) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex items-center justify-center font-mono text-xs">
        Loading workflow builder...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#EDEBE6] font-sans antialiased pb-16">
      {/* Header Bar */}
      <header className="border-b border-[#2A2A2A] bg-[#1C1C1C]/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-xs font-mono text-[#E8A33D] hover:underline flex items-center space-x-1"
            >
              <span>← BACK TO DASHBOARD</span>
            </Link>
            <span className="border-l border-[#2A2A2A] h-4 inline-block" />
            <span className="font-mono text-xs text-[#6B6B6B] uppercase">
              {isNew ? 'NEW WORKFLOW BUILDER' : `WORKFLOW ID: ${rawId.slice(0, 8)}...`}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                id="save-workflow-btn"
                className="bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE WORKFLOW'}
              </button>
            )}

            {isReadOnly && (
              <span className="text-xs font-mono text-[#E8A33D] bg-[#E8A33D]/10 border border-[#E8A33D]/30 px-3 py-1.5 rounded">
                READ-ONLY VIEWER MODE
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Builder Form */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {saveError && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-mono p-3 rounded">
            SAVE ERROR: {saveError}
          </div>
        )}

        {/* Workflow Metadata */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#2A2A2A] pb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8A33D] inline-block" />
            <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#EDEBE6]">
              WORKFLOW METADATA
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#A0A0A0] mb-1">
                WORKFLOW NAME *
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lead Enrichment Pipeline"
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-mono text-[#EDEBE6] placeholder-[#6B6B6B] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-[#A0A0A0] mb-1">
                DESCRIPTION
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of what this workflow automates..."
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-sans text-[#EDEBE6] placeholder-[#6B6B6B] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Workflow Triggers Config */}
        {!isNew && (
          <TriggerConfig
            workflowId={rawId}
            triggers={data?.workflows_by_pk?.triggers || []}
            isReadOnly={isReadOnly}
            currentRole={currentRole}
            onRefresh={refetch}
          />
        )}

        {/* Workflow Step List Editor */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-6">
          <StepList steps={steps} onChange={setSteps} isReadOnly={isReadOnly} />
        </div>
      </main>
    </div>
  );
}
