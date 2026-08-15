import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { api } from '../utils/api';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { diffWords } from 'diff';

interface LineageNode {
  id: string;
  iteration: number;
  text: string;
  technique: string;
  risk_score: number;
  semantic_distance_from_parent: number;
  parent_prompt_id?: string;
}

export const PromptDiffModal = ({
  runId,
  taskId,
  open,
  onOpenChange,
}: {
  runId: string;
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [lineage, setLineage] = useState<LineageNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !runId || !taskId) return;
    api.getLineage(runId, taskId).then((res: any) => {
      const lin = res?.data?.lineage || res?.lineage || [];
      setLineage(lin);
      if (lin.length > 0) {
        setSelectedNodeId(lin[lin.length - 1].id);
      }
    }).catch(console.error);
  }, [open, runId, taskId]);

  const nodes: Node[] = lineage.map((node, i) => ({
    id: node.id,
    position: { x: 150 + (i % 2) * 20, y: node.iteration * 150 + 50 },
    data: {
      label: (
        <div
          className="p-2 w-44 text-center cursor-pointer"
          onClick={() => setSelectedNodeId(node.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setSelectedNodeId(node.id)}
          aria-label={`Iteration ${node.iteration}, risk score ${node.risk_score.toFixed(2)}`}
        >
          <div className="text-label-mono text-steel mb-1">Iter {node.iteration}</div>
          <div className={`text-lg font-mono font-bold ${node.risk_score >= 0.7 ? 'text-danger' : 'text-steel'}`}>
            {node.risk_score.toFixed(2)}
          </div>
        </div>
      ),
    },
    style: {
      background: selectedNodeId === node.id ? '#EDE8E3' : '#FFFFFF',
      border: `1px solid ${node.risk_score >= 0.7 ? '#C0392B' : '#D4CCC6'}`,
      borderRadius: '6px',
      cursor: 'pointer',
    },
  }));

  const edges: Edge[] = lineage
    .filter(node => node.parent_prompt_id)
    .map(node => ({
      id: `e-${node.parent_prompt_id}-${node.id}`,
      source: node.parent_prompt_id as string,
      target: node.id,
      label: `Dist: ${node.semantic_distance_from_parent.toFixed(2)}`,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#727481' },
      style: { stroke: '#727481', strokeWidth: 1.5 },
    }));

  const selectedNode = lineage.find(n => n.id === selectedNodeId) ?? null;
  const previousNode = selectedNode?.parent_prompt_id
    ? lineage.find(n => n.id === selectedNode.parent_prompt_id) ?? null
    : null;

  const diffResult = previousNode && selectedNode
    ? diffWords(previousNode.text, selectedNode.text)
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate/40 backdrop-blur-sm z-40 animate-fade-in" />

        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[88vh] bg-ivory z-50 flex shadow-xl border border-hairline rounded-lg overflow-hidden"
          aria-labelledby="diff-modal-title"
        >
          {/* Left: React Flow lineage tree */}
          <div className="w-2/5 border-r border-hairline bg-parchment flex flex-col">
            <div className="px-5 py-3.5 border-b border-hairline bg-ivory flex items-center gap-3">
              <h2 id="diff-modal-title" className="text-subhead text-slate">Attack Evolution</h2>
              <span className="text-caption text-taupe font-mono">{lineage.length} iterations</span>
            </div>
            <div className="flex-1 relative">
              <ReactFlow nodes={nodes} edges={edges} fitView>
                <Background color="#D4CCC6" gap={16} />
                <Controls />
              </ReactFlow>
            </div>
          </div>

          {/* Right: Semantic diff */}
          <div className="flex-1 flex flex-col bg-ivory min-w-0">
            <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
              <h2 className="text-subhead text-slate">Semantic Diff</h2>
              <Dialog.Close
                className="p-1 text-taupe hover:text-slate transition-colors duration-150 rounded-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="flex-1 p-6 overflow-y-auto font-mono text-small leading-relaxed">
              {!previousNode && selectedNode && (
                <div>
                  <p className="text-label-mono text-steel mb-3">Seed Prompt — Iter {selectedNode.iteration}</p>
                  <div className="p-4 bg-linen border border-hairline rounded-md text-steel whitespace-pre-wrap">
                    {selectedNode.text}
                  </div>
                </div>
              )}

              {previousNode && selectedNode && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-label-mono text-steel">Diff from Iter {previousNode.iteration}</p>
                    <span className="text-caption text-taupe font-mono">
                      Semantic distance: <span className="text-slate font-bold">{selectedNode.semantic_distance_from_parent.toFixed(3)}</span>
                    </span>
                  </div>
                  <div className="p-5 bg-linen border border-hairline rounded-md whitespace-pre-wrap leading-relaxed">
                    {diffResult.map((part, i) => (
                      <span
                        key={i}
                        className={
                          part.added   ? 'bg-success-muted text-success font-semibold px-0.5 rounded-sm' :
                          part.removed ? 'bg-danger-muted text-danger line-through px-0.5 rounded-sm' :
                          'text-slate'
                        }
                      >
                        {part.value}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-linen border border-hairline rounded-md">
                      <p className="text-label-mono text-taupe mb-1">Technique</p>
                      <p className="text-small text-slate">{selectedNode.technique}</p>
                    </div>
                    <div className="p-3 bg-linen border border-hairline rounded-md">
                      <p className="text-label-mono text-taupe mb-1">Risk Score</p>
                      <p className={`text-small font-bold font-mono ${selectedNode.risk_score >= 0.7 ? 'text-danger' : 'text-steel'}`}>
                        {selectedNode.risk_score.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!selectedNode && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-small text-taupe">Select a node to view the diff.</p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
