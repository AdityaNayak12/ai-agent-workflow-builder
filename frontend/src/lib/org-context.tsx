'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useAuthenticationStatus } from '@nhost/react';

export interface Org {
  id: string;
  name: string;
  calls_used: number;
  max_calls: number;
}

export interface OrgMember {
  id: string;
  role: 'owner' | 'editor' | 'viewer';
  organization: Org;
}

interface GetUserOrgMembershipsData {
  org_members: OrgMember[];
}

interface OrgContextType {
  orgMemberships: OrgMember[];
  currentOrg: Org | null;
  currentRole: 'owner' | 'editor' | 'viewer' | null;
  setCurrentOrgId: (orgId: string) => void;
  loading: boolean;
  refetchOrgs: () => void;
}

const GET_USER_ORG_MEMBERSHIPS = gql`
  query GetUserOrgMemberships {
    org_members {
      id
      role
      organization {
        id
        name
        calls_used
        max_calls
      }
    }
  }
`;

const OrgContext = createContext<OrgContextType>({
  orgMemberships: [],
  currentOrg: null,
  currentRole: null,
  setCurrentOrgId: () => {},
  loading: false,
  refetchOrgs: () => {},
});

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthenticationStatus();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery<GetUserOrgMembershipsData>(GET_USER_ORG_MEMBERSHIPS, {
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network',
  });

  const orgMemberships: OrgMember[] = data?.org_members || [];

  // Set default selected org to first membership if not set
  useEffect(() => {
    if (orgMemberships.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgMemberships[0].organization.id);
    }
  }, [orgMemberships, selectedOrgId]);

  const activeMembership = orgMemberships.find(m => m.organization.id === selectedOrgId) || orgMemberships[0] || null;
  const currentOrg = activeMembership?.organization || null;
  const currentRole = activeMembership?.role || null;

  return (
    <OrgContext.Provider
      value={{
        orgMemberships,
        currentOrg,
        currentRole,
        setCurrentOrgId: setSelectedOrgId,
        loading,
        refetchOrgs: () => refetch(),
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
