/**
 * v2/types.ts
 * Node type constants and graph-specific interfaces for Campaign Graph v2.
 * NT is the single source of truth for node type strings — never use string literals.
 */
import type { Node, Edge } from '@xyflow/react';

// ── Node type constants ───────────────────────────────────────────────────────
export const NT = {
  ROOT:      'campaignRoot',
  CONFIG:    'configNode',
  TECHNIQUE: 'techniqueNode',
  TASK:      'taskNode',
  MUTATION:  'mutationNode',
  OUTCOME:   'outcomeNode',
  GROUP_BAR: 'groupBar',
} as const;

export type NodeType = typeof NT[keyof typeof NT];

// ── Graph node / edge type aliases ────────────────────────────────────────────
// ponytail: just re-export RF types with any data — each node component owns its
// own data interface; graph-wide we don't need a discriminated union.
export type GraphNode = Node;
export type GraphEdge = Edge;

// ── Filter state ─────────────────────────────────────────────────────────────
import type { TaskStatus } from '../../../types/domain';

export interface GraphFilters {
  statuses: TaskStatus[];
  techniques: string[];
  harmTypes: string[];
  breakthroughOnly: boolean;
  showResolved: boolean;
}
