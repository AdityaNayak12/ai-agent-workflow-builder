'use client';

import React from 'react';
import { useAuthenticationStatus, useUserData, useSignOut } from '@nhost/react';
import { useOrg } from '@/lib/org-context';
import { OrgSwitcher } from '@/components/shared/OrgSwitcher';
import Link from 'next/link';

export default function HomePage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  const user = useUserData();
  const { signOut } = useSignOut();
  const { currentOrg, currentRole, orgMemberships, loading: isOrgLoading } = useOrg();

  if (isAuthLoading || isOrgLoading) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex justify-center items-center font-mono text-xs text-[#6B6B6B]">
        INITIALIZING SYSTEM CONTEXT...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex flex-col justify-center items-center px-4">
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-[4px] p-6 max-w-md w-full text-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E8A33D] mx-auto mb-3" />
          <h1 className="font-mono text-sm tracking-wider uppercase mb-2">AUTHENTICATION REQUIRED</h1>
          <p className="text-xs text-[#6B6B6B] mb-6">
            You must be authenticated to access organization workflows.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#E8A33D] text-[#141414] font-mono text-xs uppercase font-semibold px-4 py-2 rounded-[4px] hover:bg-[#D49231] transition-colors"
          >
            GO TO LOGIN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#EDEBE6] flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-[#2A2A2A] bg-[#1C1C1C] px-6 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
          <span className="font-mono text-xs font-semibold tracking-wider text-[#EDEBE6] uppercase">
            AI WORKFLOW BUILDER
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <OrgSwitcher />
          <button
            onClick={() => signOut()}
            className="text-xs font-mono text-[#6B6B6B] hover:text-[#E5484D] transition-colors bg-transparent border-none cursor-pointer"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Main Content Dashboard Placeholder */}
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[#6B6B6B] mb-1">
            USER SESSION & ORG CONTEXT
          </h2>
          <p className="text-sm font-sans text-[#EDEBE6]">
            Logged in as <span className="font-mono text-[#E8A33D]">{user?.email || user?.id}</span>
          </p>
        </div>

        {orgMemberships.length === 0 ? (
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-[4px] p-8 text-center max-w-lg mx-auto my-12">
            <div className="w-3 h-3 rounded-full bg-[#E8A33D] mx-auto mb-3" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-[#EDEBE6] mb-2">
              YOU'RE NOT PART OF AN ORGANIZATION YET
            </h3>
            <p className="text-xs font-sans text-[#6B6B6B] leading-relaxed">
              Contact your organization administrator to receive an org membership invitation to access workflows and team features.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-[4px] p-5">
              <span className="text-[10px] font-mono uppercase text-[#6B6B6B] block mb-1">ACTIVE ORGANIZATION</span>
              <span className="font-mono text-sm font-semibold text-[#EDEBE6] block">{currentOrg?.name}</span>
              <span className="font-mono text-[10px] text-[#6B6B6B] block mt-1 truncate">ID: {currentOrg?.id}</span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-[4px] p-5">
              <span className="text-[10px] font-mono uppercase text-[#6B6B6B] block mb-1">YOUR ROLE</span>
              <span className="font-mono text-sm font-semibold text-[#E8A33D] uppercase block">{currentRole}</span>
              <span className="font-mono text-[10px] text-[#6B6B6B] block mt-1">Scoped via org_members</span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-[4px] p-5">
              <span className="text-[10px] font-mono uppercase text-[#6B6B6B] block mb-1">MONTHLY QUOTA USAGE</span>
              <span className="font-mono text-sm font-semibold text-[#EDEBE6] block">
                {currentOrg?.calls_used} / {currentOrg?.max_calls} CALLS
              </span>
              <div className="w-full bg-[#141414] h-1.5 rounded-[2px] mt-3 overflow-hidden border border-[#2A2A2A]">
                <div
                  className="bg-[#E8A33D] h-full"
                  style={{ width: `${Math.min(100, ((currentOrg?.calls_used || 0) / (currentOrg?.max_calls || 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
