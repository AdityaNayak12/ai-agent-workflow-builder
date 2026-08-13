'use client';

// ponytail: unified trigger config UI card styling with main builder section design
import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { INSERT_MANUAL_TRIGGER, CREATE_WEBHOOK_TRIGGER, DELETE_TRIGGER } from '../../graphql/mutations';

export interface WorkflowTrigger {
  id: string;
  type: string;
  config?: any;
  created_at?: string;
}

interface TriggerConfigProps {
  workflowId: string;
  triggers: WorkflowTrigger[];
  isReadOnly: boolean;
  currentRole: string | null;
  onRefresh: () => void;
}

interface CreateWebhookTriggerData {
  createWebhookTrigger: {
    trigger_id: string;
    webhook_url: string;
    secret: string;
  };
}

export const TriggerConfig: React.FC<TriggerConfigProps> = ({
  workflowId,
  triggers,
  isReadOnly,
  currentRole,
  onRefresh,
}) => {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [addingTrigger, setAddingTrigger] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // One-time secret reveal state
  const [secretRevealData, setSecretRevealData] = useState<{
    triggerId: string;
    webhookUrl: string;
    secret: string;
  } | null>(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [insertManualTrigger] = useMutation(INSERT_MANUAL_TRIGGER);
  const [createWebhookTriggerAction] = useMutation<CreateWebhookTriggerData>(CREATE_WEBHOOK_TRIGGER);
  const [deleteTriggerMutation] = useMutation(DELETE_TRIGGER);

  const isOwner = currentRole !== 'editor' && currentRole !== 'viewer';

  const handleAddManual = async () => {
    try {
      setAddingTrigger(true);
      setErrorMsg(null);
      await insertManualTrigger({ variables: { workflow_id: workflowId } });
      setShowTypePicker(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add manual trigger');
    } finally {
      setAddingTrigger(false);
    }
  };

  const handleAddWebhook = async () => {
    try {
      setAddingTrigger(true);
      setErrorMsg(null);
      const res = await createWebhookTriggerAction({ variables: { workflow_id: workflowId } });
      const data = res.data?.createWebhookTrigger;
      if (data) {
        setSecretRevealData({
          triggerId: data.trigger_id,
          webhookUrl: data.webhook_url,
          secret: data.secret,
        });
      }
      setShowTypePicker(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create webhook trigger');
    } finally {
      setAddingTrigger(false);
    }
  };

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return;
    try {
      setErrorMsg(null);
      await deleteTriggerMutation({ variables: { id: triggerId } });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete trigger');
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded p-6 space-y-4">
      {/* Uniform Section Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8A33D] inline-block" />
          <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-[#EDEBE6]">
            WORKFLOW TRIGGERS
          </h2>
        </div>

        {!isReadOnly && (
          <div className="relative">
            <button
              type="button"
              id="add-trigger-btn"
              onClick={() => setShowTypePicker(!showTypePicker)}
              className="bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-colors flex items-center space-x-1"
            >
              <span>+ ADD TRIGGER</span>
            </button>

            {showTypePicker && (
              <div className="absolute right-0 mt-2 w-56 bg-[#141414] border border-[#2A2A2A] rounded shadow-xl z-20 p-2 space-y-1">
                <button
                  type="button"
                  id="trigger-option-manual"
                  onClick={handleAddManual}
                  disabled={addingTrigger}
                  className="w-full text-left px-3 py-2 text-xs font-mono rounded text-[#EDEBE6] hover:bg-[#252525] transition-colors flex flex-col"
                >
                  <span className="font-semibold text-white">Manual Trigger</span>
                  <span className="text-[10px] text-[#A0A0A0]">Run on-demand via UI or API call</span>
                </button>

                {isOwner && (
                  <button
                    type="button"
                    id="trigger-option-webhook"
                    onClick={handleAddWebhook}
                    disabled={addingTrigger}
                    className="w-full text-left px-3 py-2 text-xs font-mono rounded text-[#EDEBE6] hover:bg-[#252525] transition-colors flex flex-col border-t border-[#2A2A2A]/50 pt-2"
                  >
                    <span className="font-semibold text-[#A78BFA] flex items-center justify-between">
                      Webhook Trigger
                      <span className="text-[9px] bg-[#A78BFA]/20 text-[#A78BFA] px-1.5 py-0.5 rounded font-mono uppercase">OWNER</span>
                    </span>
                    <span className="text-[10px] text-[#A0A0A0]">Inbound HTTP POST webhook with secret header</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-mono p-3 rounded flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-[#EF4444] font-bold hover:text-white">✕</button>
        </div>
      )}

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-[#2A2A2A] rounded">
          <p className="text-xs font-mono text-[#6B6B6B]">No triggers attached to this workflow yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((trig) => {
            const isWebhook = trig.type === 'webhook';
            return (
              <div
                key={trig.id}
                className="bg-[#141414] border border-[#2A2A2A] rounded p-3 flex items-center justify-between font-mono"
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                      isWebhook
                        ? 'bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30'
                        : 'bg-[#6B7280]/20 text-[#9CA3AF] border border-[#6B7280]/30'
                    }`}
                  >
                    {trig.type}
                  </span>

                  <div>
                    <p className="text-xs font-semibold text-[#EDEBE6]">
                      {isWebhook ? 'Inbound HTTP Webhook Trigger' : 'Manual / On-Demand Execution'}
                    </p>
                    <p className="text-[10px] text-[#A0A0A0]">ID: {trig.id}</p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTrigger(trig.id)}
                    className="text-xs font-mono text-[#EF4444] hover:text-red-300 transition-colors px-2 py-1 hover:bg-[#EF4444]/10 rounded uppercase"
                  >
                    DELETE
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* One-Time Secret Reveal Modal */}
      {secretRevealData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#E8A33D]/40 rounded p-6 max-w-lg w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <h3 className="text-sm font-semibold text-[#EDEBE6] flex items-center space-x-2">
                <span>🔑</span>
                <span>WEBHOOK SECRET GENERATED</span>
              </h3>
              <span className="text-[10px] bg-[#E8A33D]/20 text-[#E8A33D] font-mono px-2 py-0.5 rounded font-semibold uppercase">
                ONE-TIME REVEAL
              </span>
            </div>

            {/* Warning Banner */}
            <div className="bg-[#E8A33D]/10 border border-[#E8A33D]/30 text-[#E8A33D] text-xs p-3 rounded flex items-start space-x-2">
              <span className="text-sm">⚠️</span>
              <p className="leading-relaxed">
                <strong className="font-semibold">Copy this secret now!</strong> Generated server-side and will <span className="underline">never be displayed again</span> after closing.
              </p>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-xs font-mono text-[#A0A0A0] mb-1 uppercase">
                Webhook Target URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={secretRevealData.webhookUrl}
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded px-3 py-2 text-xs font-mono text-[#EDEBE6] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(secretRevealData.webhookUrl, 'url')}
                  className="px-3 py-2 bg-[#2A2A2A] hover:bg-[#333] text-xs text-[#EDEBE6] rounded font-mono transition-colors shrink-0 uppercase"
                >
                  {copiedUrl ? 'COPIED!' : 'COPY'}
                </button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-xs font-mono text-[#A0A0A0] mb-1 uppercase">
                Webhook Secret Key (<code className="text-[#A78BFA]">x-webhook-secret</code>)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  id="one-time-secret-input"
                  value={secretRevealData.secret}
                  className="w-full bg-[#141414] border border-[#A78BFA]/50 text-[#A78BFA] rounded px-3 py-2 text-xs font-mono font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  id="copy-secret-btn"
                  onClick={() => copyToClipboard(secretRevealData.secret, 'secret')}
                  className="px-3 py-2 bg-[#A78BFA] hover:bg-[#9061F9] text-black text-xs font-mono font-semibold rounded transition-colors shrink-0 uppercase"
                >
                  {copiedSecret ? 'COPIED!' : 'COPY SECRET'}
                </button>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                id="close-secret-modal-btn"
                onClick={() => setSecretRevealData(null)}
                className="w-full py-2 bg-[#E8A33D] hover:bg-[#D49231] text-[#141414] font-mono text-xs font-bold rounded transition-colors uppercase tracking-wider"
              >
                I HAVE SAVED THE SECRET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
