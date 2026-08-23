/**
 * v2/hooks/useGraphLayout.ts
 * Grouped + collision-aware + tier-aware layout algorithm per RFC §9.
 * Pure computeLayout function + useMemo wrapper.
 *
 * Store reads: pipelineStore.liveTasks (or graphStore.replayTasks in replay), pipelineStore.activeRunMeta,
 *              graphStore.filters, graphStore.selectedTaskId, graphStore.semanticZoomTier, graphStore.replay.mode
 */
import { useMemo, useDeferredValue } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';
import { applyFilters } from './useFilteredTasks';
import type { LiveTask } from '../../../../types/domain';
import type { ActiveRunMeta } from '../../../../stores/pipelineStore';
import type { GraphFilters } from '../types';
import { NT } from '../types';

// ── Layout constants (RFC §9.2) ───────────────────────────────────────────────
const ROOT_W      = 320;
const ROOT_Y      = 0;
const CONFIG_Y    = 110;
const CONFIG_SPACING = 200;
const GROUP_Y     = 185;
const GROUP_GUTTER = 48;
const TECH_Y      = 240;
const TASK_Y      = 370;
const TASK_CHIP_W = 150;
const TASK_GAP    = 16;
const MUT_H       = 110;
const OUTCOME_H   = 100;
const TECH_W      = 200;

const TERMINAL = new Set(['breakthrough', 'defended', 'unresolved', 'failed', 'completed']);
const LIVE_ACTIVE = new Set(['queued', 'mutating', 'transmitting', 'scoring']);

// ── Group techniques by harm_type_group or lexical cluster ───────────────────
function groupTechniques(tasks: LiveTask[]): Record<string, string[]> {
  const techGroups = new Map<string, string>(); // technique → group
  for (const t of tasks) {
    if (!techGroups.has(t.technique)) {
      const group = t.harm_type_group ?? t.technique.split('_')[0];
      techGroups.set(t.technique, group);
    }
  }

  const groups: Record<string, string[]> = {};
  for (const [tech, group] of techGroups) {
    if (!groups[group]) groups[group] = [];
    groups[group].push(tech);
  }
  // Sort groups + techniques within groups for determinism
  const sorted: Record<string, string[]> = {};
  Object.keys(groups).sort().forEach(g => {
    sorted[g] = groups[g].sort();
  });
  return sorted;
}

function computeColWidth(techTaskCount: number): number {
  return Math.max(180, techTaskCount * (TASK_CHIP_W + TASK_GAP) + 32);
}

// ── Main layout function ──────────────────────────────────────────────────────
export function computeLayout(
  tasks: Record<string, LiveTask>,
  meta: ActiveRunMeta | null,
  filters: GraphFilters,
  selectedTaskId: string | null,
  tier: 0 | 1 | 2 | 3 | 4,
  runId?: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const taskList = Object.values(tasks);
  const { visibleIds, dimmedIds } = applyFilters(tasks, filters);

  // ── 1. Group techniques ───────────────────────────────────────────────────
  const groups = groupTechniques(taskList);
  const groupNames = Object.keys(groups);

  // ── 2-4. Compute column/group widths and total canvas width ──────────────
  const colWidths: Record<string, number> = {};
  for (const techs of Object.values(groups)) {
    for (const tech of techs) {
      const count = taskList.filter(t => t.technique === tech).length;
      colWidths[tech] = computeColWidth(count);
    }
  }

  const groupWidths: Record<string, number> = {};
  for (const [g, techs] of Object.entries(groups)) {
    groupWidths[g] = techs.reduce((sum, t) => sum + colWidths[t], 0);
  }

  const totalWidth = Object.values(groupWidths).reduce((s, w) => s + w, 0)
    + Math.max(0, groupNames.length - 1) * GROUP_GUTTER;
  const canvasW = Math.max(totalWidth, ROOT_W + 100);
  const centerX = canvasW / 2;

  // ── 5. Root node ──────────────────────────────────────────────────────────
  nodes.push({
    id: 'root',
    type: NT.ROOT,
    position: { x: centerX - ROOT_W / 2, y: ROOT_Y },
    data: { runId: runId ?? meta?.domain, meta },
    draggable: false,
    selectable: true,
  });

  // ── 6. Config nodes ───────────────────────────────────────────────────────
  const configItems = [
    { key: 'attacker', label: 'ATTACKER', value: meta?.attacker_model || '—' },
    { key: 'judge',    label: 'JUDGE',    value: meta?.judge_model    || '—' },
    { key: 'target',   label: 'TARGET',   value: meta?.endpoint_name  || meta?.endpoint_id || '—' },
  ];
  configItems.forEach(({ key, label, value }, i) => {
    const id = `config-${key}`;
    const x = centerX + (i - 1) * CONFIG_SPACING - 90;
    nodes.push({
      id,
      type: NT.CONFIG,
      position: { x, y: CONFIG_Y },
      data: { key, label, value },
      draggable: false,
      selectable: true,
    });
    edges.push({
      id: `e-root-${id}`,
      source: 'root',
      target: id,
      type: 'structural',
    });
  });

  // Tier 0: only root + configs
  if (tier === 0) return { nodes, edges };

  // ── 7-12. Groups, techniques, tasks, mutations, outcomes ──────────────────
  let xCursor = 0;

  for (const [groupName, techs] of Object.entries(groups)) {
    const groupWidth = groupWidths[groupName];

    // Group divider bar (tier >= 1)
    nodes.push({
      id: `group-${groupName}`,
      type: NT.GROUP_BAR,
      position: { x: xCursor, y: GROUP_Y },
      data: { label: groupName, width: groupWidth },
      draggable: false,
      selectable: false,
    });

    for (const tech of techs) {
      const colW = colWidths[tech];
      const techX = xCursor + colW / 2 - TECH_W / 2;
      const techTasks = taskList.filter(t => t.technique === tech);
      const visibleCount = techTasks.filter(t => visibleIds.has(t.task_id)).length;

      nodes.push({
        id: `tech-${tech}`,
        type: NT.TECHNIQUE,
        position: { x: techX, y: TECH_Y },
        data: { technique: tech, taskCount: techTasks.length, visibleCount },
        draggable: false,
        selectable: true,
      });
      edges.push({
        id: `e-config-target-tech-${tech}`,
        source: 'config-target',
        target: `tech-${tech}`,
        type: 'structural',
      });

      // Tier 1: technique overview only — no task chips
      if (tier >= 2) {
        techTasks.forEach((task, taskIdx) => {
          const taskX = techX + (taskIdx - (techTasks.length - 1) / 2) * (TASK_CHIP_W + TASK_GAP);
          const dimmed = dimmedIds.has(task.task_id);
          const isLiveTask = LIVE_ACTIVE.has(task.status);

          nodes.push({
            id: `task-${task.task_id}`,
            type: NT.TASK,
            position: { x: taskX, y: TASK_Y },
            data: { task, dimmed },
            className: dimmed ? 'dimmed' : undefined,
            draggable: false,
            selectable: true,
          });
          edges.push({
            id: `e-tech-${tech}-task-${task.task_id}`,
            source: `tech-${tech}`,
            target: `task-${task.task_id}`,
            type: 'structural',
            animated: isLiveTask,
            className: dimmed ? 'dimmed' : undefined,
          });

          // Decide if mutations should expand
          const shouldExpand =
            (tier >= 3 && task.is_breakthrough) ||
            (tier >= 4 && task.task_id === selectedTaskId);

          let lastNodeId = `task-${task.task_id}`;
          let lastY = TASK_Y;

          if (shouldExpand && task.iterations > 0) {
            for (let iter = 1; iter <= task.iterations; iter++) {
              const mutId = `mut-${task.task_id}-${iter}`;
              const mutY = TASK_Y + iter * MUT_H;
              const iterRecord = task.iterations_history?.[iter - 1];
              const isFinal = iter === task.iterations;
              const isSelected = task.task_id === selectedTaskId;

              nodes.push({
                id: mutId,
                type: NT.MUTATION,
                position: { x: taskX, y: mutY },
                data: {
                  iteration: iter,
                  totalIterations: task.iterations,
                  prompt: iterRecord?.adversarial_prompt ?? (isFinal ? task.adversarial_prompt : undefined),
                  response: iterRecord?.target_response ?? (isFinal ? task.target_response : undefined),
                  riskScore: iterRecord?.risk_score ?? (isFinal ? task.risk_score : undefined),
                  vectorScores: iterRecord?.vector_scores ?? (isFinal ? task.vector_scores : undefined),
                  judgeReasoning: iterRecord?.judge_reasoning ?? (isFinal ? task.judge_reasoning : undefined),
                  status: iterRecord ? 'completed' : (isFinal ? task.status : 'mutating'),
                  taskId: task.task_id,
                  dimmed,
                  // stagger delay for CSS animation
                  animDelay: (iter - 1) * 30,
                },
                className: dimmed ? 'dimmed mutation-enter' : 'mutation-enter',
                style: { '--iter': String(iter - 1) } as React.CSSProperties,
                draggable: false,
                selectable: true,
              });
              edges.push({
                id: `e-${lastNodeId}-${mutId}`,
                source: lastNodeId,
                target: mutId,
                // Active mutation chain gets animated edge; others structural
                type: isSelected ? 'activeMutation' : 'structural',
                animated: isSelected && isFinal,
                className: dimmed ? 'dimmed' : undefined,
              });
              lastNodeId = mutId;
              lastY = mutY;
            }
          }

          // Outcome node for terminal tasks
          if (TERMINAL.has(task.status)) {
            const outcomeId = `outcome-${task.task_id}`;
            const outcomeY = shouldExpand && task.iterations > 0
              ? lastY + OUTCOME_H
              : TASK_Y + OUTCOME_H;

            nodes.push({
              id: outcomeId,
              type: NT.OUTCOME,
              position: { x: taskX, y: outcomeY },
              data: {
                status: task.status,
                riskScore: task.risk_score,
                iterations: task.iterations,
                taskId: task.task_id,
                dimmed,
              },
              className: dimmed ? 'dimmed' : undefined,
              draggable: false,
              selectable: true,
            });
            edges.push({
              id: `e-${lastNodeId}-${outcomeId}`,
              source: lastNodeId,
              target: outcomeId,
              type: 'structural',
              animated: false,
              className: [
                task.is_breakthrough ? 'edge-breakthrough' :
                task.status === 'defended' || task.status === 'completed' ? 'edge-defended' : 'edge-unresolved',
                dimmed ? 'dimmed' : '',
              ].filter(Boolean).join(' ') || undefined,
            });
          }
        });
      }

      xCursor += colW;
    }
    xCursor += GROUP_GUTTER;
  }

  return { nodes, edges };
}

// ── React hook wrapper ────────────────────────────────────────────────────────
export function useGraphLayout(): { nodes: Node[]; edges: Edge[] } {
  const liveTasks = usePipelineStore(s => s.liveTasks);
  const activeRunMeta = usePipelineStore(s => s.activeRunMeta);
  const activeRunId = usePipelineStore(s => s.activeRunId);
  const replayMode = useGraphStore(s => s.replay.mode);
  const replayTasks = useGraphStore(s => s.replayTasks);
  const filters = useGraphStore(s => s.filters);
  const selectedTaskId = useGraphStore(s => s.selectedTaskId);
  const tier = useGraphStore(s => s.semanticZoomTier);

  // Defer for large task lists — keeps SSE ingestion unblocked
  const deferredLiveTasks = useDeferredValue(liveTasks);
  const deferredReplayTasks = useDeferredValue(replayTasks);

  return useMemo(() => {
    const tasks = replayMode === 'paused' ? deferredReplayTasks : deferredLiveTasks;
    return computeLayout(tasks, activeRunMeta, filters, selectedTaskId, tier, activeRunId);
  }, [deferredLiveTasks, deferredReplayTasks, activeRunMeta, activeRunId, filters, selectedTaskId, tier, replayMode]);
}

// Need React for CSSProperties type
import React from 'react';
