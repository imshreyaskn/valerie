/**
 * v2/Canvas.tsx
 * React Flow host for Campaign Graph v2.
 * nodeTypes MUST be defined here, outside any component, to prevent remounts on every render.
 *
 * Handles:
 *  - Keyboard navigation (ArrowUp/Down for node step, Escape to deselect, ←→ for replay step)
 *  - Click → select node/task, shift+click → multi-select
 *  - onMove → semantic zoom tier
 *  - filterChip bar + DebugBar height offset
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  type NodeMouseHandler,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphLayout } from './hooks/useGraphLayout';
import { useSemanticZoom } from './hooks/useSemanticZoom';
import { useReplayBuffer } from './hooks/useReplayBuffer';
import { useGraphStore } from './store/graphStore';
import { NT } from './types';

import { RootNode }      from './nodes/RootNode';
import { ConfigNode }    from './nodes/ConfigNode';
import { TechniqueNode } from './nodes/TechniqueNode';
import { TaskNode }      from './nodes/TaskNode';
import { MutationNode }  from './nodes/MutationNode';
import { OutcomeNode }   from './nodes/OutcomeNode';
import { GroupBar }      from './nodes/GroupBar';

import { StructuralEdge }     from './edges/StructuralEdge';
import { ActiveMutationEdge } from './edges/ActiveMutationEdge';

import { GraphBackground } from './Background';
import { GraphMiniMap }    from './MiniMap';
import { StatsCard }       from './StatsCard';
import { FilterChips }     from './FilterChips';
import { DebugBar }        from './DebugBar';
import { Inspector }       from './Inspector';

// ── nodeTypes MUST be outside component (React Flow invariant) ────────────────
const NODE_TYPES: NodeTypes = {
  [NT.ROOT]:      RootNode,
  [NT.CONFIG]:    ConfigNode,
  [NT.TECHNIQUE]: TechniqueNode,
  [NT.TASK]:      TaskNode,
  [NT.MUTATION]:  MutationNode,
  [NT.OUTCOME]:   OutcomeNode,
  [NT.GROUP_BAR]: GroupBar,
};

const EDGE_TYPES: EdgeTypes = {
  structural:     StructuralEdge,
  activeMutation: ActiveMutationEdge,
};

// ── Header height accounting ──────────────────────────────────────────────────
const FILTER_BAR_H = 44;
const DEBUG_BAR_H  = 44;

interface Props {
  showFilters?: boolean;
  showDebugBar?: boolean;
}

export const Canvas = memo(function Canvas({ showFilters = true, showDebugBar = true }: Props) {
  const { nodes, edges } = useGraphLayout();
  const { onMove } = useSemanticZoom();
  useReplayBuffer();

  const selectTask = useGraphStore(s => s.selectTask);
  const selectNodeId = useGraphStore(s => s.selectNodeId);
  const closeInspector = useGraphStore(s => s.closeInspector);
  const toggleMultiSelect = useGraphStore(s => s.toggleMultiSelect);
  const stepReplay = useGraphStore(s => s.stepReplay);
  const replayMode = useGraphStore(s => s.replay.mode);
  const inspectorOpen = useGraphStore(s => s.inspectorOpen);

  // ── Node click handler ────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    if (node.type === NT.TASK) {
      const task = (node.data as { task?: { task_id?: string } }).task;
      if (!task?.task_id) return;
      if (event.shiftKey) {
        toggleMultiSelect(task.task_id);
      } else {
        selectTask(task.task_id);
      }
    } else if (node.type === NT.MUTATION) {
      const data = node.data as { taskId?: string; iteration?: number };
      if (data.taskId && data.iteration !== undefined) {
        const gs = useGraphStore.getState();
        gs.selectMutation(data.taskId, data.iteration);
      }
    } else if (node.type === NT.OUTCOME) {
      const data = node.data as { taskId?: string };
      if (data.taskId) selectTask(data.taskId);
      else selectNodeId(node.id);
    } else {
      selectNodeId(node.id);
    }
  }, [selectTask, selectNodeId, toggleMultiSelect]);

  // ── Pane click → deselect ─────────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    closeInspector();
  }, [closeInspector]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInspector();
        e.preventDefault();
      }
      if (replayMode === 'paused') {
        if (e.key === 'ArrowLeft') { stepReplay(-1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { stepReplay(1);  e.preventDefault(); }
      }
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [closeInspector, stepReplay, replayMode]);

  const headerOffset = (showDebugBar ? DEBUG_BAR_H : 0) + (showFilters ? FILTER_BAR_H : 0);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-parchment overflow-hidden"
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Filter bar — above RF canvas */}
      <FilterChips visible={showFilters} />

      {/* Debug/replay bar */}
      <DebugBar visible={showDebugBar} />

      {/* React Flow canvas — offset by bars */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: headerOffset }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onMove={onMove}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.1}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          // Disable default selection — we handle it in graphStore
          nodesFocusable
          edgesFocusable={false}
          selectNodesOnDrag={false}
          multiSelectionKeyCode="Shift"
        >
          <Controls
            position="top-right"
            style={{ top: 16, right: inspectorOpen ? 420 : 16 }}
            showInteractive={false}
          />
          <GraphBackground />
          <GraphMiniMap />
        </ReactFlow>
      </div>

      {/* Stats HUD — bottom left */}
      <StatsCard />

      {/* Inspector panel — right edge */}
      <Inspector />
    </div>
  );
});
