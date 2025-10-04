/*
   Copyright 2025 David Chaiken

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
/**
 * Core graph calculation functions
 * These functions handle the business logic for graph data manipulation
 * and can be tested independently of the UI components.
 */

export interface Node {
  id: number;
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  nlinks: number;
  fx?: number;
  fy?: number;
  exed?: boolean;
}

export type DashPattern = 'solid' | 'dotted' | 'dashed' | 'long-dashed' | 'dash-dot';

export interface Link {
  source: Node;
  target: Node;
  thickness: number;
  color: string;
  label?: string;
  dashPattern?: DashPattern;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
  totalLinks: number;
  totalLinkThickness: number;
  metadata?: {
    name?: string;
    description?: string;
    createdBy?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}

export const DEFAULT_COLOR = '#1f77b4';
export const DEFAULT_THICKNESS = 1;
export const DEFAULT_SIZE = 5;

/**
 * Creates a new empty graph data structure
 */
export function createEmptyGraphData(): GraphData {
  return {
    nodes: [],
    links: [],
    totalLinks: 0,
    totalLinkThickness: 0,
  };
}

/**
 * Creates a new node with default values
 */
export function createNode(
  id: number,
  label: string = `Node${id}`,
  x: number = 0,
  y: number = 0,
  color: string = DEFAULT_COLOR,
  size: number = DEFAULT_SIZE
): Node {
  return {
    id,
    label,
    color,
    size,
    x,
    y,
    nlinks: 0,
    fx: x,
    fy: y,
  };
}

/**
 * Creates a new link between two nodes
 */
export function createLink(
  source: Node,
  target: Node,
  thickness: number = DEFAULT_THICKNESS,
  color: string = DEFAULT_COLOR,
  label?: string,
  dashPattern?: DashPattern
): Link {
  return {
    source,
    target,
    thickness,
    color,
    label,
    dashPattern,
  };
}

/**
 * Adds a link to the graph and updates counters
 */
export function addLink(graphData: GraphData, link: Link): void {
  graphData.links.push(link);
  graphData.totalLinks++;
  graphData.totalLinkThickness += link.thickness;

  // Update node link counts
  link.source.nlinks++;
  link.target.nlinks++;
}

/**
 * Removes a link from the graph and updates counters
 */
export function removeLink(graphData: GraphData, link: Link): void {
  const linkIndex = graphData.links.indexOf(link);
  if (linkIndex === -1) return;

  graphData.links.splice(linkIndex, 1);
  graphData.totalLinks--;
  graphData.totalLinkThickness -= link.thickness;

  // Update node link counts
  link.source.nlinks--;
  link.target.nlinks--;
}

/**
 * Updates link thickness and adjusts total thickness counter
 */
export function updateLinkThickness(graphData: GraphData, link: Link, newThickness: number): void {
  const oldThickness = link.thickness;
  link.thickness = newThickness;
  graphData.totalLinkThickness += newThickness - oldThickness;
}

/**
 * Removes a node and all its connected links, updating counters
 */
export function removeNode(graphData: GraphData, nodeId: number): void {
  // Find and remove all links connected to this node
  const linksToRemove = graphData.links.filter(link => link.source.id === nodeId || link.target.id === nodeId);
  const thicknessToRemove = linksToRemove.reduce((sum, link) => sum + link.thickness, 0);

  // Remove the links and update counters
  graphData.links = graphData.links.filter(link => link.source.id !== nodeId && link.target.id !== nodeId);
  graphData.totalLinks -= linksToRemove.length;
  graphData.totalLinkThickness -= thicknessToRemove;

  // Remove the node
  graphData.nodes = graphData.nodes.filter(node => node.id !== nodeId);

  // Update nlinks for all remaining nodes that were connected to the removed links
  linksToRemove.forEach(link => {
    if (link.source.id !== nodeId) {
      link.source.nlinks--;
    }
    if (link.target.id !== nodeId) {
      link.target.nlinks--;
    }
  });
}

/**
 * Clears all data from a graph, resetting it to empty state
 */
export function clearGraphData(graphData: GraphData): void {
  graphData.nodes = [];
  graphData.links = [];
  graphData.totalLinks = 0;
  graphData.totalLinkThickness = 0;
}

/**
 * Calculates the average link thickness
 */
export function getAverageLinkThickness(graphData: GraphData): number {
  if (graphData.totalLinks === 0) return 0;
  return graphData.totalLinkThickness / graphData.totalLinks;
}

/**
 * Calculates the average links per node
 */
export function getAverageLinksPerNode(graphData: GraphData): number {
  if (graphData.nodes.length === 0) return 0;
  return graphData.totalLinks / graphData.nodes.length;
}

/**
 * Recalculates all counters based on the current links array
 * This is useful after loading graph data or ensuring consistency
 */
export function recalculateCounters(graphData: GraphData): void {
  graphData.totalLinks = graphData.links.length;
  graphData.totalLinkThickness = graphData.links.reduce((sum, link) => sum + link.thickness, 0);
}

/**
 * Loads graph data from a file format and updates the graph data structure
 * This function handles the core logic of converting loaded data to internal format
 */
export function loadGraphData(
  graphData: GraphData,
  loadedData: {
    nodes: Array<{
      id: number;
      label?: string;
      color?: string;
      size?: number;
      x: number;
      y: number;
      exed?: boolean;
    }>;
    links: Array<{
      source: number;
      target: number;
      thickness?: number;
      color?: string;
      label?: string;
      dashPattern?: DashPattern;
    }>;
  }
): { success: boolean; error?: string; maxNodeId?: number } {
  try {
    // Validate the loaded data
    if (!loadedData.nodes || !loadedData.links) {
      return { success: false, error: 'Invalid graph data format' };
    }

    // Check for duplicate node IDs
    const nodeIds = new Set();
    let maxNodeId = 0;
    for (const node of loadedData.nodes) {
      if (nodeIds.has(node.id)) {
        return { success: false, error: 'Error: Duplicate node ID found in graph' };
      }
      nodeIds.add(node.id);
      maxNodeId = Math.max(maxNodeId, node.id);
    }

    // Clear current graph
    graphData.nodes = [];
    graphData.links = [];
    graphData.totalLinks = 0;
    graphData.totalLinkThickness = 0;

    // Load nodes
    loadedData.nodes.forEach(nodeData => {
      if (
        typeof nodeData.id === 'number' &&
        typeof nodeData.x === 'number' &&
        typeof nodeData.y === 'number' &&
        (!nodeData.label || typeof nodeData.label === 'string') &&
        (!nodeData.color || typeof nodeData.color === 'string') &&
        (!nodeData.size || typeof nodeData.size === 'number')
      ) {
        graphData.nodes.push({
          id: nodeData.id,
          label: nodeData.label || '',
          color: nodeData.color || DEFAULT_COLOR,
          size: nodeData.size || DEFAULT_SIZE,
          x: nodeData.x,
          y: nodeData.y,
          fx: nodeData.x, // Fix the node in its loaded position
          fy: nodeData.y, // Fix the node in its loaded position
          exed: !!nodeData.exed,
          nlinks: 0, // nlinks value is recalculated below
        });
      }
    });

    // Build a Map for fast node lookup
    const nodeMap = new Map<number, Node>();
    graphData.nodes.forEach(node => nodeMap.set(node.id, node));

    // Load links, converting source/target IDs to Node objects
    loadedData.links.forEach(linkData => {
      const sourceNode = nodeMap.get(linkData.source);
      const targetNode = nodeMap.get(linkData.target);
      if (sourceNode && targetNode) {
        const link = createLink(
          sourceNode,
          targetNode,
          linkData.thickness || DEFAULT_THICKNESS,
          linkData.color || DEFAULT_COLOR,
          linkData.label,
          linkData.dashPattern
        );
        addLink(graphData, link);
      }
    });

    return { success: true, maxNodeId };
  } catch (error) {
    return { success: false, error: `Error loading graph: ${String(error)}` };
  }
}
