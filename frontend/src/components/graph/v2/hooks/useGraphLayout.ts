/**
 * v2/hooks/useGraphLayout.ts
 * Clean rank-based DAG layout engine for Campaign Graph.
 * Computes non-overlapping positions for:
 * 1. Root Node (Tier 0)
 * 2. Config Nodes: Attacker, Target, Judge (Tier 1)
 * 3. Technique Group Headers (Tier 2)
 * 4. Attack Specimen Tasks (Tier 3)
 * 5. Mutation Chains & Terminal Outcomes (Tier 4)
 *
 * All nodes have draggable: true so users can interactively rearrange them.
 */
import { useMemo, useDeferredValue } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { usePipelineStore } from '../../../../stores/pipelineStore';
import { useGraphStore } from '../store/graphStore';
import { useFilteredTasks } from './useFilteredTasks';
import type { LiveTask } from '../../../../types/domain';
import type { ActiveRunMeta } from '../../../../stores/pipelineStore';
import { NT } from '../types';

// ── Layout Geometry Constants (Generous non-overlapping pitch) ───────────────
const ROOT_W = 380;
const ROOT_Y = 0;

const CONFIG_W = 220;
const CONFIG_Y = 240;
const CONFIG_GAP = 28;

const TECH_W = 220;
const TECH_Y = 390;

const TASK_W = 180;
const TASK_GAP = 28;
const TASK_Y = 560;

const MUTATION_H = 155;
const OUTCOME_H = 145;
const COLUMN_GAP = 56;

const TERMINAL_STATUSES = new Set(['breakthrough', 'defended', 'unresolved', 'failed', 'completed']);
const LIVE_ACTIVE_STATUSES = new Set(['queued', 'mutating', 'transmitting', 'scoring']);

// ── Helper: Group tasks by technique ──────────────────────────────────────────
function groupTasksByTechnique(tasks: LiveTask[]): Record<string, LiveTask[]> {
  const map: Record<string, LiveTask[]> = {};
  for (const t of tasks) {
    const tech = t.technique || 'general_attack';
    if (!map[tech]) map[tech] = [];
    map[tech].push(t);
  }
  // Sort techniques alphabetically for stable layout
  const sorted: Record<string, LiveTask[]> = {};
  Object.keys(map)
    .sort()
    .forEach((k) => {
      sorted[k] = map[k];
    });
  return sorted;
}

export function computeLayout(
  tasks: Record<string, LiveTask>,
  meta: ActiveRunMeta | null,
  expandedTaskIds: string[],
  _visibleIds: Set<string>,
  dimmedIds: Set<string>,
  selectedTaskId: string | null,
  runId?: string | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const taskList = Object.values(tasks);
  const techGroups = groupTasksByTechnique(taskList);
  const techKeys = Object.keys(techGroups);

  // 1. Calculate column widths
  const colWidths: Record<string, number> = {};
  for (const [tech, tList] of Object.entries(techGroups)) {
    const taskCount = Math.max(1, tList.length);
    colWidths[tech] = Math.max(TECH_W + 40, taskCount * (TASK_W + TASK_GAP));
  }

  const totalColumnsWidth =
    techKeys.reduce((acc, k) => acc + (colWidths[k] ?? TECH_W), 0) +
    Math.max(0, techKeys.length - 1) * COLUMN_GAP;

  const totalConfigsWidth = 3 * CONFIG_W + 2 * CONFIG_GAP;
  const canvasWidth = Math.max(totalColumnsWidth, totalConfigsWidth, ROOT_W + 160, 900);
  const centerX = canvasWidth / 2;

  // 2. Root Node (Tier 0)
  nodes.push({
    id: 'campaignRoot',
    type: NT.ROOT,
    position: { x: centerX - ROOT_W / 2, y: ROOT_Y },
    data: { runId: runId ?? meta?.domain ?? 'CAMPAIGN', meta },
    draggable: true,
    selectable: true,
  });

  // 3. Config Nodes (Tier 1) - Attacker, Target, Judge
  const configNodesData = [
    {
      key: 'attacker' as const,
      label: 'ATTACKER',
      sublabel: '1.01 · GENERATOR',
      value: meta?.attacker_model || 'DEFAULT ATTACKER',
      details: meta?.max_iterations ? `MAX ITERATIONS: ${meta.max_iterations}` : undefined,
      isFlowNode: false,
    },
    {
      key: 'target' as const,
      label: 'TARGET SUT',
      sublabel: '1.02 · ENDPOINT',
      value: meta?.endpoint_name || meta?.endpoint_id || 'DEFAULT TARGET',
      details: meta?.domain ? `DOMAIN: ${meta.domain.toUpperCase()}` : undefined,
      isFlowNode: true,
    },
    {
      key: 'judge' as const,
      label: 'SAFETY JUDGE',
      sublabel: '1.03 · EVALUATOR',
      value: meta?.judge_model || 'DEFAULT JUDGE',
      details: 'MULTI-OBJECTIVE HARMONIC SCORING',
      isFlowNode: false,
    },
  ];

  const configStartX = centerX - (3 * CONFIG_W + 2 * CONFIG_GAP) / 2;

  configNodesData.forEach((cfg, idx) => {
    const configId = `config-${cfg.key}`;
    const x = configStartX + idx * (CONFIG_W + CONFIG_GAP);

    nodes.push({
      id: configId,
      type: NT.CONFIG,
      position: { x, y: CONFIG_Y },
      data: cfg,
      draggable: true,
      selectable: true,
    });

    // Edge from Root to Config
    edges.push({
      id: `e-root-${configId}`,
      source: 'campaignRoot',
      target: configId,
      type: 'structural',
    });
  });

  // If no techniques yet (e.g. empty or initializing run)
  if (techKeys.length === 0) {
    return { nodes, edges };
  }

  // 4. Technique Columns & Tasks (Tier 2 & 3)
  const columnsStartX = centerX - totalColumnsWidth / 2;
  let currentX = columnsStartX;

  techKeys.forEach((tech) => {
    const colWidth = colWidths[tech] ?? TECH_W;
    const techCenterX = currentX + colWidth / 2;
    const techId = `tech-${tech}`;
    const tList = techGroups[tech] ?? [];

    const breakthroughCount = tList.filter((t) => t.is_breakthrough || (t.risk_score ?? 0) >= 0.7).length;
    const defendedCount = tList.filter((t) => t.status === 'defended' || (t.status === 'completed' && !t.is_breakthrough)).length;
    const activeCount = tList.filter((t) => LIVE_ACTIVE_STATUSES.has(t.status)).length;
    const displayName = tech.replace(/_/g, ' ');
    const harmGroup = tList[0]?.harm_type_group ?? tList[0]?.harm_type;

    // Technique Header Node
    nodes.push({
      id: techId,
      type: NT.TECHNIQUE,
      position: { x: techCenterX - TECH_W / 2, y: TECH_Y },
      data: {
        technique: tech,
        displayName,
        taskCount: tList.length,
        breakthroughCount,
        defendedCount,
        activeCount,
        harmGroup,
      },
      draggable: true,
      selectable: true,
    });

    // Edge from Target Config Node to Technique Node
    edges.push({
      id: `e-target-${techId}`,
      source: 'config-target',
      target: techId,
      type: 'structural',
    });

    // 5. Tasks within this technique column
    const tasksTotalWidth = tList.length * TASK_W + Math.max(0, tList.length - 1) * TASK_GAP;
    const tasksStartX = techCenterX - tasksTotalWidth / 2;

    tList.forEach((task, tIdx) => {
      const taskX = tasksStartX + tIdx * (TASK_W + TASK_GAP);
      const taskId = `task-${task.task_id}`;
      const isDimmed = dimmedIds.has(task.task_id);
      const isSelectedTask = selectedTaskId === task.task_id;
      const isExpanded = expandedTaskIds.includes(task.task_id);
      const isLiveTask = LIVE_ACTIVE_STATUSES.has(task.status);
      const hasMutations = (task.iterations ?? 0) > 0 || (task.iterations_history && task.iterations_history.length > 0);

      // Task Specimen Node
      nodes.push({
        id: taskId,
        type: NT.TASK,
        position: { x: taskX, y: TASK_Y },
        data: {
          task,
          isExpanded,
          hasMutations,
          dimmed: isDimmed,
        },
        className: isDimmed ? 'dimmed' : undefined,
        draggable: true,
        selectable: true,
      });

      // Edge from Technique to Task
      edges.push({
        id: `e-${techId}-${taskId}`,
        source: techId,
        target: taskId,
        type: 'structural',
        animated: isLiveTask,
        className: isDimmed ? 'dimmed' : undefined,
      });

      let lastNodeId = taskId;
      let lastNodeY = TASK_Y;

      // 6. Mutation Chain (when expanded)
      if (isExpanded && hasMutations) {
        const iterCount = Math.max(1, task.iterations ?? 1);

        for (let iter = 1; iter <= iterCount; iter++) {
          const mutId = `mut-${task.task_id}-${iter}`;
          const mutY = TASK_Y + iter * MUTATION_H;
          const iterRecord = task.iterations_history?.find((h) => h.iteration === iter) || task.iterations_history?.[iter - 1];
          const isLatestIter = iter === iterCount;

          nodes.push({
            id: mutId,
            type: NT.MUTATION,
            position: { x: taskX, y: mutY },
            data: {
              iteration: iter,
              totalIterations: iterCount,
              prompt: iterRecord?.adversarial_prompt || (isLatestIter ? task.adversarial_prompt || task.prompt : task.prompt),
              riskScore: iterRecord?.risk_score !== undefined ? iterRecord.risk_score : (isLatestIter ? task.risk_score : 0.0),
              semanticDistance: (task as any).lineage_chain?.[iter - 1]?.semantic_distance_from_parent,
              status: iterRecord ? 'completed' : (isLatestIter ? task.status : 'completed'),
              taskId: task.task_id,
              isLatest: isLatestIter,
            },
            className: isDimmed ? 'dimmed' : undefined,
            draggable: true,
            selectable: true,
          });

          // Edge from previous node to this mutation iteration
          edges.push({
            id: `e-${lastNodeId}-${mutId}`,
            source: lastNodeId,
            target: mutId,
            type: isSelectedTask ? 'activeMutation' : 'structural',
            animated: isSelectedTask && isLatestIter && isLiveTask,
            className: isDimmed ? 'dimmed' : undefined,
          });

          lastNodeId = mutId;
          lastNodeY = mutY;
        }
      }

      // 7. Outcome Node (Terminal glyph)
      if (TERMINAL_STATUSES.has(task.status)) {
        const outcomeId = `outcome-${task.task_id}`;
        const outcomeY = isExpanded && hasMutations ? lastNodeY + OUTCOME_H : TASK_Y + 170;

        nodes.push({
          id: outcomeId,
          type: NT.OUTCOME,
          position: { x: taskX, y: outcomeY },
          data: {
            status: task.status,
            riskScore: task.risk_score ?? 0,
            iterations: task.iterations ?? 0,
            taskId: task.task_id,
            isBreakthrough: task.is_breakthrough || (task.risk_score ?? 0) >= 0.7,
            latencyMs: task.latency_ms,
          },
          className: isDimmed ? 'dimmed' : undefined,
          draggable: true,
          selectable: true,
        });

        // Edge to Outcome
        edges.push({
          id: `e-${lastNodeId}-${outcomeId}`,
          source: lastNodeId,
          target: outcomeId,
          type: 'structural',
          className: [
            task.is_breakthrough ? 'edge-breakthrough' : 'edge-defended',
            isDimmed ? 'dimmed' : '',
          ]
            .filter(Boolean)
            .join(' '),
        });
      }
    });

    currentX += colWidth + COLUMN_GAP;
  });

  return { nodes, edges };
}

export function useGraphLayout(): { nodes: Node[]; edges: Edge[] } {
  const liveTasks = usePipelineStore((s) => s.liveTasks);
  const activeRunMeta = usePipelineStore((s) => s.activeRunMeta);
  const activeRunId = usePipelineStore((s) => s.activeRunId);

  const expandedTaskIds = useGraphStore((s) => s.expandedTaskIds);
  const selectedTaskId = useGraphStore((s) => s.selectedTaskId);
  const { visibleIds, dimmedIds } = useFilteredTasks();

  const deferredTasks = useDeferredValue(liveTasks);

  return useMemo(() => {
    return computeLayout(
      deferredTasks,
      activeRunMeta,
      expandedTaskIds,
      visibleIds,
      dimmedIds,
      selectedTaskId,
      activeRunId
    );
  }, [
    deferredTasks,
    activeRunMeta,
    expandedTaskIds,
    visibleIds,
    dimmedIds,
    selectedTaskId,
    activeRunId,
  ]);
}
