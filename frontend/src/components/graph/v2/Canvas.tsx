/**
 * v2/Canvas.tsx
 * Interactive React Flow Canvas Host for Campaign Graph.
 * Handles interactive node dragging, selection, keyboard navigation, and inspector orchestration.
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphLayout } from './hooks/useGraphLayout';
import { useSemanticZoom } from './hooks/useSemanticZoom';
import { useGraphStore } from './store/graphStore';
import { usePipelineStore } from '../../../stores/pipelineStore';
import { NT } from './types';

import { RootNode } from './nodes/RootNode';
import { ConfigNode } from './nodes/ConfigNode';
import { TechniqueNode } from './nodes/TechniqueNode';
import { TaskNode } from './nodes/TaskNode';
import { MutationNode } from './nodes/MutationNode';
import { OutcomeNode } from './nodes/OutcomeNode';

import { StructuralEdge } from './edges/StructuralEdge';
import { ActiveMutationEdge } from './edges/ActiveMutationEdge';

import { GraphBackground } from './Background';
import { GraphMiniMap } from './MiniMap';
import { StatsCard } from './StatsCard';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';

// ── Define Node & Edge Types outside component scope (RF invariant) ──────────
const NODE_TYPES: NodeTypes = {
  [NT.ROOT]: RootNode,
  [NT.CONFIG]: ConfigNode,
  [NT.TECHNIQUE]: TechniqueNode,
  [NT.TASK]: TaskNode,
  [NT.MUTATION]: MutationNode,
  [NT.OUTCOME]: OutcomeNode,
};

const EDGE_TYPES: EdgeTypes = {
  structural: StructuralEdge,
  activeMutation: ActiveMutationEdge,
};

interface Props {
  className?: string;
}

export const Canvas = memo(function Canvas({ className = '' }: Props) {
  const { nodes: layoutNodes, edges: layoutEdges } = useGraphLayout();
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Sync layout updates with React Flow internal state
  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);

  useEffect(() => {
    setEdges(layoutEdges);
  }, [layoutEdges, setEdges]);

  const { onMove } = useSemanticZoom();
  const { setCenter, fitView } = useReactFlow();

  const selectTask = useGraphStore((s) => s.selectTask);
  const selectMutation = useGraphStore((s) => s.selectMutation);
  const selectNodeId = useGraphStore((s) => s.selectNodeId);
  const closeInspector = useGraphStore((s) => s.closeInspector);
  const inspectorOpen = useGraphStore((s) => s.inspectorOpen);
  const inspectorWidth = useGraphStore((s) => s.inspectorWidth);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // ── Node Click Handler ──────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === NT.TASK) {
        const task = (node.data as any)?.task;
        if (task?.task_id) {
          selectTask(task.task_id);
          setCenter(node.position.x + 90, node.position.y + 70, {
            duration: 400,
          });
        }
      } else if (node.type === NT.MUTATION) {
        const data = node.data as { taskId?: string; iteration?: number };
        if (data.taskId && data.iteration !== undefined) {
          selectMutation(data.taskId, data.iteration);
        }
      } else if (node.type === NT.OUTCOME) {
        const data = node.data as { taskId?: string };
        if (data.taskId) {
          selectTask(data.taskId);
        } else {
          selectNodeId(node.id);
        }
      } else {
        selectNodeId(node.id);
      }
    },
    [selectTask, selectMutation, selectNodeId, setCenter]
  );

  // ── Pane Click Handler ──────────────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    closeInspector();
  }, [closeInspector]);

  const expandAllTasks = useGraphStore((s) => s.expandAllTasks);
  const collapseAll = useGraphStore((s) => s.collapseAll);
  const expandedTaskIds = useGraphStore((s) => s.expandedTaskIds);
  const liveTasks = usePipelineStore((s) => s.liveTasks);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 });
  }, [fitView]);

  // ── Keyboard Navigation & Power Hotkeys ─────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        closeInspector();
        e.preventDefault();
      } else if (e.key === 'f' || e.key === 'F') {
        handleFitView();
        e.preventDefault();
      } else if (e.key === 'e' || e.key === 'E') {
        const allIds = Object.keys(liveTasks);
        if (expandedTaskIds.length > 0) {
          collapseAll();
        } else if (allIds.length > 0) {
          expandAllTasks(allIds);
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeInspector, handleFitView, expandedTaskIds, liveTasks, collapseAll, expandAllTasks]);

  return (
    <div
      ref={canvasContainerRef}
      className={`relative w-full h-full bg-parchment overflow-hidden select-none ${className}`}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Top Unified Toolbar */}
      <Toolbar onFitView={handleFitView} />

      {/* React Flow Viewport Canvas */}
      <div className="absolute inset-0 pt-12">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onMove={onMove}
          nodesDraggable={true}
          elementsSelectable={true}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.15}
          maxZoom={2.0}
          proOptions={{ hideAttribution: true }}
        >
          {/* Controls positioned top-right */}
          <Controls
            position="top-right"
            style={{
              top: 56,
              right: inspectorOpen ? inspectorWidth + 16 : 16,
              transition: 'right 0.25s ease-out',
            }}
            showInteractive={false}
            showFitView={false}
          />
          <GraphBackground />
          <GraphMiniMap />
        </ReactFlow>
      </div>

      {/* Borderless Horizontal Telemetry HUD below Top Bar */}
      <StatsCard />

      {/* Slide-in Resizable Inspector Drawer */}
      <Inspector />
    </div>
  );
});
