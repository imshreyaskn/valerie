import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { LiveTask } from '../../types/domain';
import type { ActiveRunMeta } from '../../stores/pipelineStore';

// ── Layout constants ────────────────────────────────────────────
const COL_W      = 260;  // px between technique columns
const ROOT_Y     = 0;
const CONFIG_Y   = 110;  // attacker/judge/endpoint config nodes
const TECH_Y     = 230;  // technique row
const TASK_Y     = 360;  // task branches
const MUT_H      = 110;  // height per mutation step
const OUTCOME_H  = 100;  // gap after last mutation to outcome

// ── Node type identifiers ───────────────────────────────────────
export const NT = {
  ROOT:      'campaignRoot',
  TECHNIQUE: 'techniqueNode',
  TASK:      'taskNode',
  MUTATION:  'mutationNode',
  OUTCOME:   'outcomeNode',
} as const;

export interface GraphNodes {
  nodes: Node[];
  edges: Edge[];
}

// Stable sort so technique columns don't jump as store updates
function sortedTechniques(tasks: LiveTask[]): string[] {
  const set = new Set<string>();
  tasks.forEach(t => set.add(t.technique));
  return Array.from(set).sort();
}

export function useGraphLayout(
  liveTasks: Record<string, LiveTask>,
  activeRunMeta: ActiveRunMeta | null,
  runId: string | null,
  expandedTasks: Set<string>,   // task_ids whose mutations are visible
): GraphNodes {
  return useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const tasks = Object.values(liveTasks);
    const techniques = sortedTechniques(tasks);
    const totalCols = Math.max(techniques.length, 1);
    const canvasW = totalCols * COL_W;
    const centerX = canvasW / 2;

    // ── 1. Campaign Root ─────────────────────────────────────────
    nodes.push({
      id: 'root',
      type: NT.ROOT,
      position: { x: centerX - 160, y: ROOT_Y },
      data: { runId, meta: activeRunMeta },
      draggable: false,
    });

    // ── 2. Config nodes (attacker, judge, target) ─────────────────
    const configItems = [
      { key: 'attacker', label: 'ATTACKER', value: activeRunMeta?.attacker_model || '—' },
      { key: 'judge',    label: 'JUDGE',    value: activeRunMeta?.judge_model    || '—' },
      { key: 'target',   label: 'TARGET',   value: activeRunMeta?.endpoint_name  || activeRunMeta?.endpoint_id || '—' },
    ];
    const configSpacing = 260;
    const configStartX = centerX - configSpacing;
    configItems.forEach((cfg, i) => {
      const id = `config-${cfg.key}`;
      nodes.push({
        id,
        type: 'configNode',
        position: { x: configStartX + i * configSpacing - 70, y: CONFIG_Y },
        data: cfg,
        draggable: false,
      });
      edges.push({
        id: `e-root-${id}`,
        source: 'root',
        target: id,
        type: 'smoothstep',
        style: { stroke: '#D8D0C7', strokeWidth: 1 },
        animated: false,
      });
    });

    if (techniques.length === 0) return { nodes, edges };

    // ── 3. Technique + Task layers ────────────────────────────────
    techniques.forEach((tech, colIdx) => {
      const techX = colIdx * COL_W + COL_W / 2 - 100;
      const techId = `tech-${tech}`;

      const techTasks = tasks.filter(t => t.technique === tech);

      nodes.push({
        id: techId,
        type: NT.TECHNIQUE,
        position: { x: techX, y: TECH_Y },
        data: { technique: tech, taskCount: techTasks.length },
        draggable: false,
      });

      // Edge from any config node → technique (or from root if no configs)
      edges.push({
        id: `e-config-${techId}`,
        source: 'config-target',
        target: techId,
        type: 'smoothstep',
        style: { stroke: '#D8D0C7', strokeWidth: 1 },
        animated: false,
      });

      // ── 4. Task branches under each technique ──────────────────
      techTasks.forEach((task, taskIdx) => {
        const taskX = techX + (taskIdx - (techTasks.length - 1) / 2) * 160;
        const taskId = `task-${task.task_id}`;
        const isExpanded = expandedTasks.has(task.task_id);
        const isLive = !['breakthrough', 'defended', 'unresolved', 'completed', 'failed'].includes(task.status);

        nodes.push({
          id: taskId,
          type: NT.TASK,
          position: { x: taskX, y: TASK_Y },
          data: { task, expanded: isExpanded },
          draggable: false,
        });

        edges.push({
          id: `e-${techId}-${taskId}`,
          source: techId,
          target: taskId,
          type: 'smoothstep',
          animated: isLive,
          style: { stroke: '#D8D0C7', strokeWidth: 1 },
        });

        // ── 5. Mutations (only if expanded) ───────────────────────
        const iterations = task.iterations ?? 0;
        let lastNodeId = taskId;
        let lastY = TASK_Y;

        if (isExpanded && iterations > 0) {
          for (let iter = 1; iter <= iterations; iter++) {
            const mutId = `mut-${task.task_id}-${iter}`;
            const mutY = TASK_Y + iter * MUT_H;
            const isLastIter = iter === iterations;
            const isFinalJudged = isLastIter && (task.risk_score > 0 || task.judge_reasoning);

            nodes.push({
              id: mutId,
              type: NT.MUTATION,
              position: { x: taskX, y: mutY },
              data: {
                iteration: iter,
                prompt: isLastIter ? task.adversarial_prompt : undefined,
                riskScore: isLastIter && isFinalJudged ? task.risk_score : undefined,
                status: isLastIter ? task.status : 'completed',
              },
              draggable: false,
            });

            edges.push({
              id: `e-${lastNodeId}-${mutId}`,
              source: lastNodeId,
              target: mutId,
              type: 'smoothstep',
              animated: isLive && isLastIter,
              label: isLastIter && isFinalJudged ? task.risk_score.toFixed(2) : undefined,
              style: { stroke: '#D8D0C7', strokeWidth: 1 },
              labelStyle: { fill: '#6E7280', fontSize: 10, fontFamily: 'JetBrains Mono' },
              labelBgStyle: { fill: '#F6F2EE' },
            });

            lastNodeId = mutId;
            lastY = mutY;
          }
        }

        // ── 6. Outcome terminal node ───────────────────────────────
        const isTerminal = task.status === 'breakthrough' || task.status === 'defended' ||
                           task.status === 'unresolved'   || task.status === 'failed' ||
                           task.status === 'completed';
        if (isTerminal) {
          const outcomeId = `outcome-${task.task_id}`;
          const outcomeY  = (isExpanded && iterations > 0) ? (lastY + OUTCOME_H) : (TASK_Y + OUTCOME_H);

          nodes.push({
            id: outcomeId,
            type: NT.OUTCOME,
            position: { x: taskX, y: outcomeY },
            data: {
              status:     task.status,
              riskScore:  task.risk_score,
              iterations: task.iterations,
            },
            draggable: false,
          });

          edges.push({
            id: `e-${lastNodeId}-${outcomeId}`,
            source: lastNodeId,
            target: outcomeId,
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: task.is_breakthrough ? '#6E1818' : '#415438',
              strokeWidth: 1.5,
            },
          });
        }
      });
    });

    return { nodes, edges };
  }, [liveTasks, activeRunMeta, runId, expandedTasks]);
}
