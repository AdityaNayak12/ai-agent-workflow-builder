'use client';

import React from 'react';

export interface StepItem {
  tempId?: string;
  id?: string;
  workflow_id?: string;
  step_order: number;
  type: string;
  name: string;
  config: any;
}

interface StepEditorProps {
  step: StepItem;
  allSteps: StepItem[];
  onChange: (updatedStep: StepItem) => void;
  isReadOnly?: boolean;
}

export function StepEditor({ step, allSteps, onChange, isReadOnly = false }: StepEditorProps) {
  const config = step.config || {};

  const updateConfig = (key: string, value: any) => {
    onChange({
      ...step,
      config: {
        ...config,
        [key]: value,
      },
    });
  };

  const otherSteps = allSteps.filter((s) => s.step_order !== step.step_order);

  switch (step.type) {
    case 'llm_call':
      return (
        <div className="space-y-3 pt-3 border-t border-[#2A2A2A]">
          <div>
            <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">PROMPT TEMPLATE</label>
            <textarea
              disabled={isReadOnly}
              rows={3}
              value={config.prompt || ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              placeholder="e.g. Summarize the following input text: {{input}}"
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">MODEL OVERRIDE (OPTIONAL)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={config.model || ''}
              onChange={(e) => updateConfig('model', e.target.value)}
              placeholder="e.g. gemini-1.5-flash"
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
            />
          </div>
        </div>
      );

    case 'http_request':
      return (
        <div className="space-y-3 pt-3 border-t border-[#2A2A2A]">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">METHOD</label>
              <select
                disabled={isReadOnly}
                value={config.method || 'GET'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">ENDPOINT URL</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.example.com/webhook"
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">BODY (JSON / TEXT)</label>
            <textarea
              disabled={isReadOnly}
              rows={2}
              value={config.body || ''}
              onChange={(e) => updateConfig('body', e.target.value)}
              placeholder='{"key": "value"}'
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
            />
          </div>
        </div>
      );

    case 'db_write':
      return (
        <div className="pt-3 border-t border-[#2A2A2A]">
          <div className="bg-[#141414] border border-[#2A2A2A] p-3 rounded text-xs font-mono text-[#A0A0A0]">
            ℹ️ Target table is automatically configured to system results table (<span className="text-[#E8A33D]">workflow_run_results</span>).
          </div>
        </div>
      );

    case 'notify':
      return (
        <div className="space-y-3 pt-3 border-t border-[#2A2A2A]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">CHANNEL</label>
              <select
                disabled={isReadOnly}
                value={config.channel || 'slack'}
                onChange={(e) => updateConfig('channel', e.target.value)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              >
                <option value="slack">Slack</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">RECIPIENT / CHANNEL ID</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={config.recipient || ''}
                onChange={(e) => updateConfig('recipient', e.target.value)}
                placeholder="#engineering or C123456"
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">MESSAGE CONTENT</label>
            <textarea
              disabled={isReadOnly}
              rows={2}
              value={config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="Notification alert message text..."
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
            />
          </div>
        </div>
      );

    case 'conditional_branch':
      return (
        <div className="space-y-3 pt-3 border-t border-[#2A2A2A]">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">FIELD</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={config.field || ''}
                onChange={(e) => updateConfig('field', e.target.value)}
                placeholder="payload.status"
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">OPERATOR</label>
              <select
                disabled={isReadOnly}
                value={config.operator || 'equals'}
                onChange={(e) => updateConfig('operator', e.target.value)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              >
                <option value="equals">equals</option>
                <option value="contains">contains</option>
                <option value="exists">exists</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">VALUE</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={config.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="success"
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">IF TRUE ➔ THEN SKIP TO STEP</label>
              <select
                disabled={isReadOnly}
                value={config.then_skip_to ?? ''}
                onChange={(e) => updateConfig('then_skip_to', e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              >
                <option value="">Next Sequential Step</option>
                {otherSteps.map((s) => (
                  <option key={s.step_order} value={s.step_order}>
                    Step #{s.step_order}: {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#A0A0A0] mb-1">IF FALSE ➔ ELSE SKIP TO STEP</label>
              <select
                disabled={isReadOnly}
                value={config.else_skip_to ?? ''}
                onChange={(e) => updateConfig('else_skip_to', e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
              >
                <option value="">Next Sequential Step</option>
                {otherSteps.map((s) => (
                  <option key={s.step_order} value={s.step_order}>
                    Step #{s.step_order}: {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      );

    case 'approval_gate':
      return (
        <div className="pt-3 border-t border-[#2A2A2A]">
          <div className="bg-[#E8A33D]/10 border border-[#E8A33D]/30 p-3 rounded text-xs font-mono text-[#E8A33D]">
            ⏸️ Pauses workflow execution run state until manually approved by an organization owner or editor.
          </div>
        </div>
      );

    default:
      return null;
  }
}
