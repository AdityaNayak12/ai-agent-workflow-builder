'use client';

// ponytail: simplified org switcher using native <select> element
import React from 'react';
import { useOrg } from '@/lib/org-context';

export const OrgSwitcher: React.FC = () => {
  const { orgMemberships, currentOrg, currentRole, setCurrentOrgId } = useOrg();

  if (orgMemberships.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-xs font-mono text-[#6B6B6B]">
        <span>No Organization Memberships</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 bg-[#1C1C1C] border border-[#2A2A2A] px-3 py-1.5 rounded-[4px]">
      <label htmlFor="org-switcher-select" className="text-xs font-mono text-[#6B6B6B] uppercase tracking-wider">
        Org:
      </label>
      <select
        id="org-switcher-select"
        value={currentOrg?.id || ''}
        onChange={(e) => setCurrentOrgId(e.target.value)}
        className="bg-[#141414] text-[#EDEBE6] font-mono text-xs border border-[#2A2A2A] rounded-[4px] px-2 py-1 focus:outline-none focus:border-[#E8A33D]"
      >
        {orgMemberships.map((m) => (
          <option key={m.organization.id} value={m.organization.id}>
            {m.organization.name} [{m.role.toUpperCase()}]
          </option>
        ))}
      </select>

      {currentRole && (
        <span className="text-[10px] font-mono uppercase bg-[#2A2A2A] text-[#E8A33D] px-2 py-0.5 rounded-[4px] border border-[#E8A33D]/30">
          {currentRole}
        </span>
      )}
    </div>
  );
};
