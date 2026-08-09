'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { useOrg, OrgMember } from '@/lib/org-context';
import { nhost } from '@/lib/nhost-client';
import { GET_ORG_WORKFLOWS } from '@/graphql/queries';

interface Trigger {
  id: string;
  type: string;
}

interface Step {
  id: string;
}

interface Run {
  id: string;
  status: string;
  created_at: string;
}

interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  steps: Step[];
  triggers: Trigger[];
  runs: Run[];
}

interface GetOrgWorkflowsData {
  workflows: Workflow[];
}

function getStatusBadge(status?: string) {
  if (!status) {
    return {
      label: 'No runs yet',
      classes: 'bg-[#2A2A2A] text-[#A0A0A0] border-[#3A3A3A]',
    };
  }

  const s = status.toLowerCase();
  switch (s) {
    case 'running':
      return { label: 'RUNNING', classes: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30' };
    case 'completed':
      return { label: 'COMPLETED', classes: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30' };
    case 'failed':
      return { label: 'FAILED', classes: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30' };
    case 'paused':
      return { label: 'PAUSED', classes: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30' };
    case 'pending':
    case 'skipped':
    default:
      return { label: s.toUpperCase(), classes: 'bg-[#6B7280]/10 text-[#9CA3AF] border-[#6B7280]/30' };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { currentOrg, currentRole, orgMemberships, loading: orgLoading, setCurrentOrgId } = useOrg();

  const { data, loading: workflowsLoading, error } = useQuery<GetOrgWorkflowsData>(GET_ORG_WORKFLOWS, {
    variables: { org_id: currentOrg?.id },
    skip: !currentOrg?.id,
    fetchPolicy: 'cache-and-network',
  });

  const workflows: Workflow[] = data?.workflows || [];
  const canCreateWorkflow = currentRole === 'owner' || currentRole === 'editor';

  const handleSignOut = async () => {
    await nhost.auth.signOut();
    router.push('/login');
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex items-center justify-center font-mono text-sm">
        Loading organization context...
      </div>
    );
  }

  if (!currentOrg && orgMemberships.length === 0) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[#1C1C1C] border border-[#2A2A2A] rounded p-8 space-y-4">
          <span className="w-3 h-3 rounded-full bg-[#E8A33D] inline-block" />
          <h1 className="text-lg font-mono tracking-wider uppercase text-[#EDEBE6]">No Organization Memberships</h1>
          <p className="text-xs font-sans text-[#A0A0A0]">
            You are not part of any organization yet. Contact an administrator to receive an invitation.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full bg-[#2A2A2A] hover:bg-[#3A3A3A] text-[#EDEBE6] font-mono text-xs py-2 px-4 rounded transition-colors"
          >
            SIGN OUT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#EDEBE6] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#1C1C1C]/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E8A33D] inline-block" />
              <span className="font-mono font-bold text-sm tracking-wider uppercase">AI WORKFLOW BUILDER</span>
            </div>

            {/* Org Switcher Selector */}
            {orgMemberships.length > 1 && (
              <div className="border-l border-[#2A2A2A] pl-4">
                <select
                  value={currentOrg?.id || ''}
                  onChange={(e) => setCurrentOrgId(e.target.value)}
                  className="bg-[#141414] border border-[#2A2A2A] text-xs font-mono text-[#EDEBE6] rounded px-2.5 py-1 focus:outline-none focus:border-[#E8A33D]"
                >
                  {orgMemberships.map((o: OrgMember) => (
                    <option key={o.organization.id} value={o.organization.id}>
                      {o.organization.name} ({o.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="block font-mono text-xs font-semibold text-[#EDEBE6]">
                {currentOrg?.name}
              </span>
              <span className="block font-mono text-[10px] text-[#E8A33D] uppercase">
                {currentRole} ROLE
              </span>
            </div>

            {canCreateWorkflow && (
              <Link
                href="/workflows/new"
                id="new-workflow-btn"
                className="bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded transition-colors"
              >
                + NEW WORKFLOW
              </Link>
            )}

            <button
              onClick={handleSignOut}
              className="border border-[#2A2A2A] hover:border-[#3A3A3A] bg-[#141414] text-[#6B6B6B] hover:text-[#EDEBE6] font-mono text-xs px-3 py-2 rounded transition-colors"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-mono tracking-wide uppercase text-[#EDEBE6]">
              Workflows
            </h1>
            <p className="text-xs font-sans text-[#6B6B6B] mt-1">
              Active workflows for <span className="text-[#EDEBE6] font-semibold">{currentOrg?.name}</span>
            </p>
          </div>

          <div className="text-xs font-mono text-[#6B6B6B]">
            TOTAL: <span className="text-[#E8A33D] font-bold">{workflows.length}</span>
          </div>
        </div>

        {workflowsLoading ? (
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-12 text-center font-mono text-xs text-[#6B6B6B]">
            Fetching workflows for {currentOrg?.name}...
          </div>
        ) : error ? (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] p-4 rounded font-mono text-xs">
            FAILED TO LOAD WORKFLOWS: {error.message}
          </div>
        ) : workflows.length === 0 ? (
          /* Empty State */
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#E8A33D]/10 border border-[#E8A33D]/20 text-[#E8A33D] flex items-center justify-center mx-auto font-mono text-lg font-bold">
              ⚡
            </div>
            <h3 className="font-mono text-base font-semibold uppercase tracking-wider text-[#EDEBE6]">
              No workflows yet
            </h3>
            <p className="text-xs font-sans text-[#A0A0A0]">
              Create one to get started building and automating event-driven flows for {currentOrg?.name}.
            </p>
            {canCreateWorkflow ? (
              <Link
                href="/workflows/new"
                id="empty-new-workflow-btn"
                className="inline-block bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded transition-colors"
              >
                + CREATE NEW WORKFLOW
              </Link>
            ) : (
              <span className="inline-block text-xs font-mono text-[#6B6B6B] italic">
                (Viewer role cannot create new workflows)
              </span>
            )}
          </div>
        ) : (
          /* Workflows Grid / List */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((w) => {
              const latestRun = w.runs && w.runs.length > 0 ? w.runs[0] : undefined;
              const badge = getStatusBadge(latestRun?.status);
              const stepCount = w.steps?.length || 0;
              const triggers = w.triggers || [];

              return (
                <div
                  key={w.id}
                  onClick={() => router.push(`/workflows/${w.id}`)}
                  className="bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#E8A33D]/50 rounded p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h2 className="font-mono text-sm font-semibold text-[#EDEBE6] group-hover:text-[#E8A33D] transition-colors line-clamp-1">
                        {w.name}
                      </h2>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-xs font-sans text-[#A0A0A0] line-clamp-2 min-h-[2rem]">
                      {w.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono text-[#6B6B6B]">
                    <div className="flex items-center space-x-2">
                      <span>{stepCount} {stepCount === 1 ? 'STEP' : 'STEPS'}</span>
                      {triggers.length > 0 && <span>•</span>}
                      <div className="flex items-center space-x-1">
                        {triggers.map((t) => (
                          <span
                            key={t.id}
                            className="bg-[#141414] text-[#E8A33D] text-[9px] uppercase px-1.5 py-0.5 rounded border border-[#2A2A2A]"
                          >
                            {t.type}
                          </span>
                        ))}
                      </div>
                    </div>

                    <span className="text-[#E8A33D] group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
