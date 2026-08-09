'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function WorkflowDetailPage() {
  const params = useParams();
  const id = params?.id;

  return (
    <div className="min-h-screen bg-[#141414] text-[#EDEBE6] p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-4">
          <div>
            <Link href="/" className="text-xs font-mono text-[#E8A33D] hover:underline">
              ← BACK TO DASHBOARD
            </Link>
            <h1 className="text-xl font-mono tracking-wide mt-2">WORKFLOW BUILDER</h1>
            <p className="text-xs font-mono text-[#6B6B6B]">ID: {id}</p>
          </div>
        </div>
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-6 font-mono text-sm text-[#A0A0A0]">
          Workflow builder canvas stub for ID: <span className="text-[#E8A33D]">{id}</span>
        </div>
      </div>
    </div>
  );
}
