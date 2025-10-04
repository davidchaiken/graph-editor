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
 * Tests for graph calculations using the actual application code
 * These tests import and test the real functions from src/graph-core.ts
 */

import {
  createEmptyGraphData,
  clearGraphData,
  createNode,
  createLink,
  addLink,
  removeLink,
  updateLinkThickness,
  removeNode,
  getAverageLinkThickness,
  getAverageLinksPerNode,
  recalculateCounters,
  loadGraphData,
  type GraphData,
  DEFAULT_COLOR,
  DEFAULT_THICKNESS,
  DEFAULT_SIZE,
} from '../src/graph-core';

describe('Graph Calculations', () => {
  let graphData: GraphData;

  beforeEach(() => {
    graphData = createEmptyGraphData();
  });

  describe('Graph Data Creation', () => {
    test('should create empty graph data', () => {
      expect(graphData.nodes).toEqual([]);
      expect(graphData.links).toEqual([]);
      expect(graphData.totalLinks).toBe(0);
      expect(graphData.totalLinkThickness).toBe(0);
    });

    test('should create nodes with default values', () => {
      const node = createNode(1, 'Test Node', 10, 20);

      expect(node.id).toBe(1);
      expect(node.label).toBe('Test Node');
      expect(node.x).toBe(10);
      expect(node.y).toBe(20);
      expect(node.color).toBe(DEFAULT_COLOR);
      expect(node.size).toBe(DEFAULT_SIZE);
      expect(node.nlinks).toBe(0);
      expect(node.fx).toBe(10);
      expect(node.fy).toBe(20);
    });

    test('should create links with default values', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const link = createLink(node1, node2);

      expect(link.source).toBe(node1);
      expect(link.target).toBe(node2);
      expect(link.thickness).toBe(DEFAULT_THICKNESS);
      expect(link.color).toBe(DEFAULT_COLOR);
    });
  });

  describe('clearGraphData', () => {
    test('should clear all data from existing graph', () => {
      // Setup: Add some data to the graph
      const node1 = createNode(1, 'Node 1', 10, 20);
      const node2 = createNode(2, 'Node 2', 30, 40);
      const link = createLink(node1, node2, 5);

      // Add nodes to the graph
      graphData.nodes.push(node1, node2);
      addLink(graphData, link);

      // Verify data exists
      expect(graphData.nodes.length).toBe(2);
      expect(graphData.links.length).toBe(1);
      expect(graphData.totalLinks).toBe(1);
      expect(graphData.totalLinkThickness).toBe(5);

      // Clear the data
      clearGraphData(graphData);

      // Verify data is cleared
      expect(graphData.nodes).toEqual([]);
      expect(graphData.links).toEqual([]);
      expect(graphData.totalLinks).toBe(0);
      expect(graphData.totalLinkThickness).toBe(0);
    });
  });

  describe('Link Management', () => {
    test('should add link and update counters', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const link = createLink(node1, node2, 5);

      addLink(graphData, link);

      expect(graphData.totalLinks).toBe(1);
      expect(graphData.totalLinkThickness).toBe(5);
      expect(graphData.links).toContain(link);
      expect(node1.nlinks).toBe(1);
      expect(node2.nlinks).toBe(1);
    });

    test('should remove link and update counters', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const link = createLink(node1, node2, 3);

      addLink(graphData, link);
      removeLink(graphData, link);

      expect(graphData.totalLinks).toBe(0);
      expect(graphData.totalLinkThickness).toBe(0);
      expect(graphData.links).not.toContain(link);
      expect(node1.nlinks).toBe(0);
      expect(node2.nlinks).toBe(0);
    });

    test('should update link thickness', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const link = createLink(node1, node2, 3);

      addLink(graphData, link);
      updateLinkThickness(graphData, link, 7);

      expect(link.thickness).toBe(7);
      expect(graphData.totalLinkThickness).toBe(7);
    });

    test('should handle multiple links', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const node3 = createNode(3);

      const link1 = createLink(node1, node2, 3);
      const link2 = createLink(node2, node3, 5);

      addLink(graphData, link1);
      addLink(graphData, link2);

      expect(graphData.totalLinks).toBe(2);
      expect(graphData.totalLinkThickness).toBe(8);
      expect(node1.nlinks).toBe(1);
      expect(node2.nlinks).toBe(2);
      expect(node3.nlinks).toBe(1);
    });
  });

  describe('Node Management', () => {
    test('should remove node and all connected links', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const node3 = createNode(3);

      // Add nodes to graph data first
      graphData.nodes.push(node1, node2, node3);

      const link1 = createLink(node1, node2, 3);
      const link2 = createLink(node1, node3, 5);
      const link3 = createLink(node2, node3, 2);

      addLink(graphData, link1);
      addLink(graphData, link2);
      addLink(graphData, link3);

      removeNode(graphData, 1); // Remove node1

      expect(graphData.nodes.length).toBe(2);
      expect(graphData.totalLinks).toBe(1); // Only link3 remains
      expect(graphData.totalLinkThickness).toBe(2);
      expect(node2.nlinks).toBe(1);
      expect(node3.nlinks).toBe(1);
    });

    test('should handle removing node with no links', () => {
      const node1 = createNode(1);
      graphData.nodes.push(node1);

      removeNode(graphData, 1);

      expect(graphData.nodes.length).toBe(0);
      expect(graphData.totalLinks).toBe(0);
      expect(graphData.totalLinkThickness).toBe(0);
    });
  });

  describe('Calculation Functions', () => {
    test('should calculate average link thickness', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const node3 = createNode(3);

      addLink(graphData, createLink(node1, node2, 4));
      addLink(graphData, createLink(node2, node3, 6));

      expect(getAverageLinkThickness(graphData)).toBe(5);
    });

    test('should return 0 for average thickness with no links', () => {
      expect(getAverageLinkThickness(graphData)).toBe(0);
    });

    test('should calculate average links per node', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const node3 = createNode(3);

      graphData.nodes.push(node1, node2, node3);
      addLink(graphData, createLink(node1, node2));
      addLink(graphData, createLink(node2, node3));

      expect(getAverageLinksPerNode(graphData)).toBe(2 / 3);
    });

    test('should return 0 for average links with no nodes', () => {
      expect(getAverageLinksPerNode(graphData)).toBe(0);
    });
  });

  describe('Counter Recalculation', () => {
    test('should recalculate counters correctly', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);

      // Manually add links to simulate inconsistency
      const link1 = createLink(node1, node2, 3);
      const link2 = createLink(node1, node2, 5);
      graphData.links.push(link1, link2);

      // Manually set wrong counters
      graphData.totalLinks = 999;
      graphData.totalLinkThickness = 999;

      recalculateCounters(graphData);

      expect(graphData.totalLinks).toBe(2);
      expect(graphData.totalLinkThickness).toBe(8);
    });
  });

  describe('Graph Data Loading', () => {
    test('should load graph data correctly', () => {
      const loadedData = {
        nodes: [
          { id: 1, label: 'Node1', x: 0, y: 0 },
          { id: 2, label: 'Node2', x: 10, y: 10 },
          { id: 3, label: 'Node3', x: 20, y: 20 },
        ],
        links: [
          { source: 1, target: 2, thickness: 3 },
          { source: 2, target: 3, thickness: 5 },
        ],
      };

      const result = loadGraphData(graphData, loadedData);

      expect(result.success).toBe(true);
      expect(result.maxNodeId).toBe(3);
      expect(graphData.nodes.length).toBe(3);
      expect(graphData.totalLinks).toBe(2);
      expect(graphData.totalLinkThickness).toBe(8);

      // Check that nlinks were updated correctly
      const node1 = graphData.nodes.find(n => n.id === 1);
      const node2 = graphData.nodes.find(n => n.id === 2);
      const node3 = graphData.nodes.find(n => n.id === 3);

      expect(node1?.nlinks).toBe(1);
      expect(node2?.nlinks).toBe(2);
      expect(node3?.nlinks).toBe(1);
    });

    test('should handle loading with node ID 0', () => {
      const loadedData = {
        nodes: [
          { id: 0, label: 'Node0', x: 0, y: 0 },
          { id: 1, label: 'Node1', x: 10, y: 10 },
        ],
        links: [{ source: 0, target: 1, thickness: 3 }],
      };

      const result = loadGraphData(graphData, loadedData);

      expect(result.success).toBe(true);
      expect(result.maxNodeId).toBe(1);
      expect(graphData.nodes.length).toBe(2);
      expect(graphData.totalLinks).toBe(1);
      expect(graphData.totalLinkThickness).toBe(3);
    });

    test('should handle invalid data', () => {
      const invalidData = {
        nodes: null,
        links: [],
      };

      // ignore the typescript errors because this test is intentionally using invalid data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      const result = loadGraphData(graphData, invalidData as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid graph data format');
    });

    test('should handle duplicate node IDs', () => {
      const loadedData = {
        nodes: [
          { id: 1, label: 'Node1', x: 0, y: 0 },
          { id: 1, label: 'Node1Duplicate', x: 10, y: 10 }, // Duplicate ID
        ],
        links: [],
      };

      const result = loadGraphData(graphData, loadedData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error: Duplicate node ID found in graph');
    });
  });

  describe('Complex Scenarios', () => {
    test('should maintain consistency through multiple operations', () => {
      const node1 = createNode(1);
      const node2 = createNode(2);
      const node3 = createNode(3);

      // Add nodes
      graphData.nodes.push(node1, node2, node3);

      // Create and add links
      const link1 = createLink(node1, node2, 3);
      const link2 = createLink(node2, node3, 5);

      addLink(graphData, link1);
      addLink(graphData, link2);

      // Modify a link
      updateLinkThickness(graphData, link1, 7);

      // Remove a link
      removeLink(graphData, link2);

      // Verify final state
      expect(graphData.totalLinks).toBe(1);
      expect(graphData.totalLinkThickness).toBe(7);
      expect(node1.nlinks).toBe(1);
      expect(node2.nlinks).toBe(1);
      expect(node3.nlinks).toBe(0);
    });
  });
});
