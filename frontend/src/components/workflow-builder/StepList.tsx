'use client';

import React, { useState } from 'react';
import { StepEditor, StepItem } from './StepEditor';

interface StepListProps {
  steps: StepItem[];
  onChange: (steps: StepItem[]) => void;
  isReadOnly?: boolean;
}

const STEP_TYPES = [
  { type: 'llm_call', label: 'LLM Call', badgeClass: 'bg-[#1E293B] text-[#93C5FD] border-[#334155]', desc: 'Generate AI responses using Gemini' },
  { type: 'http_request', label: 'HTTP Request', badgeClass: 'bg-[#132A2A] text-[#5EEAD4] border-[#1F4D4D]', desc: 'Send webhook or API HTTP call' },
  { type: 'db_write', label: 'DB Write', badgeClass: 'bg-[#2E1065] text-[#C4B5FD] border-[#4C1D95]', desc: 'Save execution results to database' },
  { type: 'notify', label: 'Notify', badgeClass: 'bg-[#371B28] text-[#F472B6] border-[#50243B]', desc: 'Send notification alert via Slack' },
  { type: 'conditional_branch', label: 'Branch', badgeClass: 'bg-[#2A2410] text-[#FDE047] border-[#453B18]', desc: 'Evaluate condition and skip to step' },
  { type: 'approval_gate', label: 'Approval Gate', badgeClass: 'bg-[#E8A33D]/10 text-[#E8A33D] border-[#E8A33D]/30', desc: 'Pause execution until manually approved' },
];

export function getStepTypeBadge(type: string) {
  const found = STEP_TYPES.find((t) => t.type === type);
  return found?.badgeClass || 'bg-[#2A2A2A] text-[#A0A0A0] border-[#3A3A3A]';
}

export function StepList({ steps, onChange, isReadOnly = false }: StepListProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(0);

  const handleAddStep = (type: string) => {
    const nextOrder = steps.length + 1;
    const defaultName = `${type.replace('_', ' ').toUpperCase()} Step ${nextOrder}`;
    const newStep: StepItem = {
      tempId: 'temp-' + Date.now() + '-' + Math.random(),
      step_order: nextOrder,
      type,
      name: defaultName,
      config: type === 'conditional_branch' ? { operator: 'equals', then_skip_to: null, else_skip_to: null } : {},
    };

    const updated = [...steps, newStep];
    onChange(updated);
    setShowPicker(false);
    setExpandedStepIndex(updated.length - 1);
  };

  const handleStepChange = (index: number, updatedStep: StepItem) => {
    const next = [...steps];
    next[index] = updatedStep;
    onChange(next);
  };

  const handleDeleteStep = (index: number) => {
    if (confirm(`Are you sure you want to delete Step #${index + 1}?`)) {
      const filtered = steps.filter((_, i) => i !== index);
      // Re-assign step_order
      const reordered = filtered.map((s, i) => ({ ...s, step_order: i + 1 }));
      onChange(reordered);
      if (expandedStepIndex === index) {
        setExpandedStepIndex(null);
      }
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...steps];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    // Re-assign step_order
    const reordered = next.map((s, i) => ({ ...s, step_order: i + 1 }));
    onChange(reordered);
    setExpandedStepIndex(index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const next = [...steps];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    // Re-assign step_order
    const reordered = next.map((s, i) => ({ ...s, step_order: i + 1 }));
    onChange(reordered);
    setExpandedStepIndex(index + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#EDEBE6]">
          WORKFLOW STEPS ({steps.length})
        </h2>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            id="add-step-btn"
            className="bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-colors"
          >
            + ADD STEP
          </button>
        )}
      </div>

      {/* Step Type Picker Modal / Dropdown */}
      {showPicker && !isReadOnly && (
        <div className="bg-[#1C1C1C] border border-[#E8A33D]/50 rounded p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
            <span className="font-mono text-xs text-[#E8A33D] uppercase font-bold">SELECT STEP TYPE</span>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="text-xs font-mono text-[#A0A0A0] hover:text-[#EDEBE6]"
            >
              ✕ CLOSE
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {STEP_TYPES.map((t) => (
              <button
                key={t.type}
                id={`add-step-${t.type}`}
                type="button"
                onClick={() => handleAddStep(t.type)}
                className="bg-[#141414] hover:bg-[#252525] border border-[#2A2A2A] hover:border-[#E8A33D]/30 p-3 rounded text-left transition-all group"
              >
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${t.badgeClass}`}>
                    {t.label.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] font-sans text-[#A0A0A0] mt-1.5 group-hover:text-[#EDEBE6]">
                  {t.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step Cards List */}
      {steps.length === 0 ? (
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-8 text-center font-mono text-xs text-[#6B6B6B]">
          No steps configured in this workflow. Click "+ ADD STEP" to add the first step.
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = expandedStepIndex === index;
            const badgeClass = getStepTypeBadge(step.type);

            return (
              <div
                key={step.id || step.tempId || index}
                className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-4 transition-all"
              >
                {/* Step Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-[#E8A33D]">
                      #{index + 1}
                    </span>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                      {step.type.toUpperCase()}
                    </span>

                    {!isReadOnly ? (
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => handleStepChange(index, { ...step, name: e.target.value })}
                        className="bg-[#141414] border border-[#2A2A2A] rounded px-2.5 py-1 text-xs font-mono text-[#EDEBE6] focus:outline-none focus:border-[#E8A33D] min-w-[200px]"
                      />
                    ) : (
                      <span className="font-mono text-xs font-semibold text-[#EDEBE6]">{step.name}</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                          title="Move Step Up"
                          className="bg-[#141414] border border-[#2A2A2A] text-[#A0A0A0] hover:text-[#EDEBE6] disabled:opacity-30 text-xs px-2 py-1 rounded"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === steps.length - 1}
                          onClick={() => handleMoveDown(index)}
                          title="Move Step Down"
                          className="bg-[#141414] border border-[#2A2A2A] text-[#A0A0A0] hover:text-[#EDEBE6] disabled:opacity-30 text-xs px-2 py-1 rounded"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStep(index)}
                          title="Delete Step"
                          className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20 text-xs px-2 py-1 rounded font-mono"
                        >
                          DELETE
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedStepIndex(isExpanded ? null : index)}
                      className="bg-[#141414] border border-[#2A2A2A] text-xs font-mono text-[#A0A0A0] hover:text-[#EDEBE6] px-2.5 py-1 rounded"
                    >
                      {isExpanded ? '▲ HIDE CONFIG' : '▼ EDIT CONFIG'}
                    </button>
                  </div>
                </div>

                {/* Expandable Step Editor Config Form */}
                {isExpanded && (
                  <div className="mt-3">
                    <StepEditor
                      step={step}
                      allSteps={steps}
                      onChange={(updated) => handleStepChange(index, updated)}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
