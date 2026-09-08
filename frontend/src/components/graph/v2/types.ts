/**
 * v2/types.ts
 * Node type constants and graph-specific types for Campaign Graph.
 * NT is the single source of truth for node type strings.
 */
import type { Node, Edge } from '@xyflow/react';
import type { FilterState } from '../../../types/filters';

export const NT = {
  ROOT:      'campaignRoot',
  CONFIG:    'configNode',
  TECHNIQUE: 'techniqueNode',
  TASK:      'taskNode',
  MUTATION:  'mutationNode',
  OUTCOME:   'outcomeNode',
} as const;

export type NodeType = typeof NT[keyof typeof NT];

export type GraphNode = Node;
export type GraphEdge = Edge;

export type { FilterState };
