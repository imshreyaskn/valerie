import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePipelineStore } from '../../stores/pipelineStore';
import { useRunStream } from '../../hooks/useRunStream';
import { useGraphLayout, NT } from './useGraphLayout';
import { GraphStatsHUD } from './GraphStatsHUD';
import { CampaignRootNode } from './nodes/CampaignRootNode';
import { ConfigNode } from './nodes/ConfigNode';
import { TechniqueNode } from './nodes/TechniqueNode';
import { TaskNode } from './nodes/TaskNode';
import { MutationNode } from './nodes/MutationNode';
import { OutcomeNode } from './nodes/OutcomeNode';

// Stable reference outside component — prevents nodeTypes identity churn
const nodeTypes: NodeTypes = {
  [NT.ROOT]:      CampaignRootNode,
  configNode:     ConfigNode,
  [NT.TECHNIQUE]: TechniqueNode,
  [NT.TASK]:      TaskNode,
  [NT.MUTATION]:  MutationNode,
  [NT.OUTCOME]:   OutcomeNode,
};

interface Props {
  runId: string;
  isLive: boolean;
}

export const CampaignGraphCanvas: React.FC<Props> = ({ runId, isLive }) => {
  // Connect SSE only for live runs
  useRunStream(isLive ? runId : null);

  const liveTasks     = usePipelineStore(s => s.liveTasks);
  const activeRunMeta = usePipelineStore(s => s.activeRunMeta);
  const runStats      = usePipelineStore(s => s.runStats);
  const streamHealth  = usePipelineStore(s => s.streamHealth);
  const eventCount    = usePipelineStore(s => s.eventCount);

  // Which tasks have mutations expanded
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  // Derive nodes/edges from store — memoized, pure
  const { nodes: derivedNodes, edges: derivedEdges } = useGraphLayout(
    liveTasks, activeRunMeta, runId, expandedTasks,
  );

  // Inject callback into task nodes (stable ref via toggleExpand)
  const nodes: Node[] = derivedNodes.map(n =>
    n.type === NT.TASK
      ? { ...n, data: { ...n.data, onToggleExpand: toggleExpand } }
      : n
  );
  const edges: Edge[] = derivedEdges;

  // Allow panning / viewport adjustments but keep layout authoritative
  const [localNodes, setLocalNodes] = React.useState<Node[]>(nodes);
  const [localEdges, setLocalEdges] = React.useState<Edge[]>(edges);

  // Sync derived layout into local state every time it changes
  React.useEffect(() => { setLocalNodes(nodes); }, [derivedNodes, expandedTasks]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { setLocalEdges(edges); }, [derivedEdges]);               // eslint-disable-line react-hooks/exhaustive-deps

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setLocalNodes(ns => applyNodeChanges(changes, ns));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges(es => applyEdgeChanges(changes, es));
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#F6F2EE' }}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        nodesDraggable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#D8D0C7"
        />
        <Controls
          style={{ bottom: 16, left: 16, border: 'none', boxShadow: 'none' }}
          showInteractive={false}
        />
        <MiniMap
          style={{
            bottom: 16,
            right: 240,
            background: '#FFFFFF',
            border: '1px solid #D8D0C7',
            borderRadius: 0,
          }}
          nodeColor={(n) => {
            if (n.type === NT.ROOT)      return '#242934';
            if (n.type === NT.TECHNIQUE) return '#D8D0C7';
            if (n.type === NT.OUTCOME) {
              const s = (n.data as any).status as string;
              return s === 'breakthrough' ? '#C0392B' : s === 'defended' ? '#415438' : '#A8A29D';
            }
            if (n.type === NT.TASK) {
              const t = (n.data as any).task;
              return t?.is_breakthrough ? '#C0392B' : '#D8D0C7';
            }
            return '#EDE6DF';
          }}
          maskColor="rgba(246,242,238,0.6)"
        />
      </ReactFlow>

      <GraphStatsHUD
        runStats={runStats}
        streamHealth={streamHealth}
        eventCount={eventCount}
      />
    </div>
  );
};
