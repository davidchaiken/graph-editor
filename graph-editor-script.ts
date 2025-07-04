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

import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import ForceGraph, { LinkObject, NodeObject } from 'force-graph';

const APPLICATION_NAME = "graph-editor";
const GRAPH_EDITOR_VERSION = "0.3";

const DEFAULT_COLOR = '#1f77b4';
const DEFAULT_THICKNESS = 1;
const DEFAULT_SIZE = 5;

const DASH_PATTERN_OPTIONS = ['solid', 'dotted', 'dashed', 'long-dashed', 'dash-dot'] as const;
const DEFAULT_PATTERN = 'solid';
type DashPattern = typeof DASH_PATTERN_OPTIONS[number];

function isDashPattern(dashPattern: string): dashPattern is DashPattern {
  return DASH_PATTERN_OPTIONS.includes(dashPattern as DashPattern);
}

// Node is stored in the ForceGraph NodeObject.
// It is not really a proper extension, because it restricts some of the
// properties and makes some of them required to reduce runtime type checks.
interface Node extends NodeObject {
  id: number;
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  exed?: boolean;
}

// Link is stored in the ForceGraph LinkObject.
// It makes the source and target properties required and restricts
// these two properties to the Node type to reduce runtime type checks.
interface Link extends Required<LinkObject> {
  source: Node;
  target: Node;
  thickness: number;
  color: string;
  label?: string;
  dashPattern?: DashPattern;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize slider backgrounds
  updateNodeSizePreview();
  updateLinkThicknessPreview();

  // Set initial opacity for Delete Node button
  (document.getElementById('deleteNodeBtn') as HTMLButtonElement)!.style.opacity = '0.5';
  
  // Set initial state for Clear button
  (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.disabled = true;
  (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.style.opacity = '0.5';

  // Track if graph has been modified
  let isGraphModified = false;

  // Track the current operation (clear or load)
  let modalFunction: (() => void) | null = null;

  // Add this variable at the top level with other state variables
  let isFirstSave = true;

  function executeOrConfirm(graphFunction: () => void) {
    hideGraphError();
    if (isGraphModified) {
      modalFunction = graphFunction;
      showConfirmModal();
    } else {
      graphFunction();
    }
  }

  function hideConfirmModalAndExecute(): void {
    hideConfirmModal();
    if (modalFunction) {
      modalFunction();
      modalFunction = null;
    }
  }

  // Add event listeners for modal buttons
  document.getElementById('saveAndProceedBtn')!.addEventListener('click', () => {
    const graphName = (document.getElementById('graphName') as HTMLInputElement)!.value || 'graph';
    saveGraphFileToDisk(graphName);
    hideConfirmModalAndExecute();
  });

  document.getElementById('proceedWithoutSaveBtn')!.addEventListener('click', hideConfirmModalAndExecute);

  document.getElementById('cancelBtn')!.addEventListener('click', hideConfirmModal);

  // Add help icon event listener
  document.getElementById('helpIcon')!.addEventListener('click', () => {
    window.open('https://github.com/davidchaiken/graph-editor/blob/main/README.md', '_blank');
  });

  // Add global event listener for node size slider
  (document.getElementById('nodeSize') as HTMLInputElement)!.addEventListener('input', () => {
    updateNodeSizePreview();
  });

  // Graph data
  const gData: GraphData = {
    nodes: [],
    links: []
  };

  // Initialize graph
  const Graph = new ForceGraph(
    document.getElementById('graph')!)
      .graphData(gData)
      .nodeId('id')
      .nodeLabel('label')
      .nodeColor('color')
      .nodeVal('size')
      .linkWidth('thickness')
      .linkColor('color')
      // Use a function to handle undefined labels
      .linkLabel((link: LinkObject) => (link as Link).label || '')
      .linkCanvasObject((linkobj: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const link = linkobj as Link;
        const source: NodeObject = link.source as NodeObject;
        const target: NodeObject = link.target as NodeObject;
        
        // Draw link
        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(target.x!, target.y!);
        
        // Set line style based on selection
        if (link === selectedLink) {
          // Glow effect for selected links
          ctx.shadowBlur = 15;
          ctx.shadowColor = link.color || DEFAULT_COLOR;
          ctx.lineWidth = (link.thickness || DEFAULT_THICKNESS) * 0.75;
        } else {
          // Normal style for unselected links
          ctx.shadowBlur = 0;
          ctx.lineWidth = (link.thickness || DEFAULT_THICKNESS) * 0.5;
        }
        
        // Set line dash pattern
        switch(link.dashPattern) {
          case 'dotted':
            ctx.setLineDash([2, 2]);
            break;
          case 'dashed':
            ctx.setLineDash([5, 5]);
            break;
          case 'long-dashed':
            ctx.setLineDash([10, 3]);
            break;
          case 'dash-dot':
            ctx.setLineDash([7, 2, 2, 2]);
            break;
          default: // 'solid'
            ctx.setLineDash([]);
        }
        
        ctx.strokeStyle = link.color || DEFAULT_COLOR;
        ctx.stroke();

        // Draw link label if it exists
        if (link.label) {
          const midX = (source.x! + target.x!) / 2;
          const midY = (source.y! + target.y!) / 2;
          
          // Calculate angle for text rotation
          const angle = Math.atan2(target.y! - source.y!, target.x! - source.x!);
          
          // Save context state
          ctx.save();
          
          // Move to midpoint and rotate
          ctx.translate(midX, midY);
          
          // Adjust angle to keep text readable
          // If the angle is in the bottom half of the circle, flip the text
          const adjustedAngle = angle + (Math.abs(angle) > Math.PI/2 ? Math.PI : 0);
          ctx.rotate(adjustedAngle);
          
          // Draw text
          const fontSize = 12/globalScale;
          ctx.font = `italic ${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'black';
          ctx.fillText(link.label, 0, -10); // Offset text above the line
          
          // Restore context state
          ctx.restore();
        }
      })
      .onNodeClick((node: NodeObject, event: MouseEvent) => handleNodeClickForLink(node as Node, event))
      .onNodeRightClick(handleNodeRightClick)
      .onLinkClick(handleLinkClick)
      .onBackgroundClick(() => {
        selectedNode = null;
        selectedLink = null;
        // Only update the UI to reflect the cleared selection
        const deleteNodeBtn = (document.getElementById('deleteNodeBtn') as HTMLButtonElement)!;
        const deleteLinkBtn = (document.getElementById('deleteLinkBtn') as HTMLButtonElement)!;
        deleteNodeBtn.disabled = true;
        deleteNodeBtn.style.opacity = '0.5';
        deleteLinkBtn.disabled = true;
        deleteLinkBtn.style.opacity = '0.5';
        // Clear link label input
        (document.getElementById('linkLabel') as HTMLInputElement)!.value = '';
        Graph.graphData(gData);
      })
      .onNodeDragEnd((node: NodeObject) => {
        node.fx = node.x!;
        node.fy = node.y!;
        isGraphModified = true;
        Graph.d3Force('center', null); // the user is taking control of the positions of nodes
      })
      .nodeCanvasObject((nodeobj: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const node = nodeobj as Node;
        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size || DEFAULT_SIZE, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || DEFAULT_COLOR;
        ctx.fill();

        // Add glow effect if node is selected
        if (node === selectedNode) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = node.color || DEFAULT_COLOR;
          // Draw a slightly larger circle for the glow
          ctx.beginPath();
          ctx.arc(node.x, node.y, (node.size || DEFAULT_SIZE) * 1.2, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || DEFAULT_COLOR;
          ctx.fill();
          // Reset shadow for the label
          ctx.shadowBlur = 0;
        }

        // Draw label
        const label = node.label || '';
        const fontSize = 12/globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(label, node.x, node.y + (node.size || DEFAULT_SIZE) + fontSize);

        // Draw X mark if node is marked
        if (node.exed) {
          const size = node.size || DEFAULT_SIZE;
          const x = node.x;
          const y = node.y;
          
          // Draw X mark
          ctx.beginPath();
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          
          // First diagonal
          ctx.moveTo(x - size * 0.7, y - size * 0.7);
          ctx.lineTo(x + size * 0.7, y + size * 0.7);
          
          // Second diagonal
          ctx.moveTo(x + size * 0.7, y - size * 0.7);
          ctx.lineTo(x - size * 0.7, y + size * 0.7);
          
          ctx.stroke();
        }
      })
      .d3Force('charge', d3.forceManyBody().strength(-100))
      .d3Force('link', d3.forceLink().distance((link: any) => {
        // distance is determined by the color of the nodes and the link
        const baseDistance = 100;
        const l = link as Link;
        if ((l.source as Node).color === (l.target as Node).color) {
          if ((l.source as Node).color == l.color) {
            return baseDistance * 0.5; // node + link color makes nodes a lot more attractive
          } else {
            return baseDistance * 0.75; // node color makes nodes more attractive
          }
        }
        return baseDistance;
      }).strength((link: any) => {
        const l = link as Link;
        switch (l.dashPattern) {
          case 'dotted':
            return (l.thickness || DEFAULT_THICKNESS) * 0.02;
          case 'dashed':
            return (l.thickness || DEFAULT_THICKNESS) * 0.04;
          case 'long-dashed':
            return (l.thickness || DEFAULT_THICKNESS) * 0.06;
          case 'dash-dot':
            return (l.thickness || DEFAULT_THICKNESS) * 0.08;
          default:
            return (l.thickness || DEFAULT_THICKNESS) * 0.1;
        }
      }))
      .d3Force('center', null) // center force is not intuitive when editing
      .d3Force('collision', d3.forceCollide((node: any) => ((node as Node).size || DEFAULT_SIZE) + 1))
      .width((document.getElementById('graph') as HTMLElement)!.offsetWidth)
      .height((document.getElementById('graph') as HTMLElement)!.offsetHeight);

  // Initialize view
  Graph.centerAt(0, 0, 1000);
  Graph.zoom(1.5);

  // Set default color to first palette color
  const defaultColor = ((document.querySelector('#colorPalette .color-option') as HTMLElement)!.dataset.color!) || DEFAULT_COLOR;
  (document.getElementById('colorPicker') as HTMLInputElement)!.value = defaultColor;
  updateColorSelection(defaultColor);

  // Handle window resize
  window.addEventListener('resize', () => {
    const graphElement = document.getElementById('graph') as HTMLElement;
    Graph
      .width(graphElement.offsetWidth)
      .height(graphElement.offsetHeight);
  });

  // State variables
  let selectedNode: Node | null = null;
  let selectedLink: Link | null = null;
  let isCreatingLink = true;
  let nextNodeId = 1; // maximum node id + 1
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Track mouse position
  document.getElementById('graph')!.addEventListener('mousemove', (event) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const graphCoords = Graph.screen2GraphCoords(x, y);
    lastMouseX = graphCoords.x;
    lastMouseY = graphCoords.y;
  });

  // Event handlers
  document.getElementById('addNodeBtn')!.addEventListener('click', addNode);
  document.getElementById('deleteNodeBtn')!.addEventListener('click', deleteNode);
  document.getElementById('deleteLinkBtn')!.addEventListener('click', deleteLink);
  document.getElementById('addLinksToggle')!.addEventListener('change', toggleLinkCreation);
  (document.getElementById('nodeSize') as HTMLInputElement)!.addEventListener('input', updateNodeSizePreview);
  (document.getElementById('linkThickness') as HTMLInputElement)!.addEventListener('input', updateLinkThicknessPreview);
  document.getElementById('autoLayoutBtn')!.addEventListener('click', () => {
    hideGraphError();
    Graph.d3Force('center', d3.forceCenter(0, 0).strength(0.1)); // move towards origin
    startAutoLayout();
  });
  document.getElementById('saveGraphBtn')!.addEventListener('click', () => {
    hideGraphError();
    showSaveGraphModal();
  });
  document.getElementById('loadGraphBtn')!.addEventListener('click', () => {
    executeOrConfirm(loadGraph);
  });

  document.getElementById('clearGraphBtn')!.addEventListener('click', () => {
    executeOrConfirm(clearGraph);
  });

  // Add keyboard event handler for Delete and Backspace keys
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') &&
        document.activeElement !== (document.getElementById('nodeLabel') as HTMLInputElement) &&
        document.activeElement !== (document.getElementById('linkLabel') as HTMLInputElement)) {
      if (selectedLink) {
        deleteLink();
      } else if (selectedNode) {
        deleteNode();
      }
    }
  });

  // Add keyboard event handler for n key
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'n' &&
        document.activeElement !== (document.getElementById('nodeLabel') as HTMLInputElement) &&
        (document.activeElement as HTMLElement).tagName !== 'INPUT' &&
        (document.activeElement as HTMLElement).tagName !== 'TEXTAREA') {

      // Create a new node at the current mouse position
      const proposedLabel = (document.getElementById('nodeLabel') as HTMLInputElement)!.value || 'Node ' + (gData.nodes.length + 1);
      const size = parseInt((document.getElementById('nodeSize') as HTMLInputElement)!.value);
      const color = (document.getElementById('colorPicker') as HTMLInputElement)!.value;
      const exed = (document.getElementById('nodeExed') as HTMLInputElement)!.checked;
      const uniqueLabel = getUniqueLabel(proposedLabel);

      const newNode = {
        id: nextNodeId++,
        label: uniqueLabel,
        color,
        size,
        exed,
        x: lastMouseX,
        y: lastMouseY,
        fx: lastMouseX,  // Fix the node in place
        fy: lastMouseY   // Fix the node in place
      };

      gData.nodes.push(newNode);
      Graph.graphData(gData);
      Graph.d3ReheatSimulation();

      // Mark graph as modified
      isGraphModified = true;

      // Select the newly created node
      handleNodeClick(newNode);
    }
  });

  // Add keyboard event handler for x key
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'x' &&
        document.activeElement !== (document.getElementById('nodeLabel') as HTMLInputElement) &&
        (document.activeElement as HTMLElement).tagName !== 'INPUT' &&
        (document.activeElement as HTMLElement).tagName !== 'TEXTAREA') {
      
      const exedInput = (document.getElementById('nodeExed') as HTMLInputElement)!;
      const newState = !exedInput.checked;
      exedInput.checked = newState;
      
      // If a node is selected, update its state too
      if (selectedNode) {
        selectedNode.exed = newState;
        isGraphModified = true;
        Graph.graphData(gData);
      }
    }
  });

  // Color palette event handlers
  document.querySelectorAll('#colorPalette .color-option').forEach((option: Element) => {
    option.addEventListener('click', () => {
      const color = (option as HTMLElement).dataset.color || DEFAULT_COLOR;
      (document.getElementById('colorPicker') as HTMLInputElement)!.value = color;
      applyColor(color);
      updateColorSelection(color);
    });
  });

  // Color input change handler
  document.getElementById('colorPicker')!.addEventListener('input', (e: Event) => {
    const color = (e.target as HTMLInputElement).value;
    applyColor(color);
  });

  // Add event listener for link label changes
  document.getElementById('linkLabel')!.addEventListener('input', (e: Event) => {
    if (selectedLink) {
      selectedLink.label = (e.target as HTMLInputElement).value;
    }
  });

  // Add event listener for link thickness changes
  document.getElementById('linkThickness')!.addEventListener('input', (e: Event) => {
    if (selectedLink) {
      selectedLink.thickness = parseInt((e.target as HTMLInputElement).value);
      isGraphModified = true;
      Graph.graphData(gData);
    }
  });

  // Helper function to apply color to selected entity
  function applyColor(color: string) {
    if (selectedNode) {
      selectedNode.color = color;
      isGraphModified = true;
    } else if (selectedLink) {
      selectedLink.color = color;
      isGraphModified = true;
    }
    Graph.graphData(gData);
  }

  // Helper function to update color selection
  function updateColorSelection(color: string) {
    const palette = document.getElementById('colorPalette') as HTMLElement;
    
    // Check if the color is in our palette
    const isPaletteColor = Array.from(palette.querySelectorAll('.color-option')).some(option => (option as HTMLElement).dataset.color === color);
    
    // Update palette selection
    palette.querySelectorAll('.color-option').forEach(option => {
      (option as HTMLElement).classList.toggle('selected', (option as HTMLElement).dataset.color === color);
    });
    
    // Update color picker value
    (document.getElementById('colorPicker') as HTMLInputElement)!.value = color || DEFAULT_COLOR;

    // Update X checkbox color
    const xMark = document.querySelector('.x-mark') as HTMLElement;
    if (xMark) {
      xMark.style.backgroundColor = color || DEFAULT_COLOR;
    }
  }

  // Helper function to get contrasting text color
  function getContrastColor(hexColor: string) {
    if (!hexColor) return '#000000';
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Functions
  function getUniqueLabel(proposedLabel: string) {
    // Check if the label already exists
    const existingLabels = new Set(gData.nodes.map(node => node.label));
    if (!existingLabels.has(proposedLabel)) {
      return proposedLabel;
    }

    // Check if label ends with a number
    const numberMatch = proposedLabel.match(/(.*?)(\d+)$/);
    
    if (numberMatch) {
      // Label ends with a number
      const baseLabel = numberMatch[1]!.trim();
      const number = parseInt(numberMatch[2]!);
      
      // Find the next available number
      let nextNumber = number + 1;
      while (existingLabels.has(`${baseLabel} ${nextNumber}`)) {
        nextNumber++;
      }
      return `${baseLabel} ${nextNumber}`;
    } else {
      // Label doesn't end with a number
      const newLabel = `${proposedLabel} 2`;
      if (!existingLabels.has(newLabel)) {
        return newLabel;
      }
      // If "2" already exists, treat it as a number and increment
      return getUniqueLabel(newLabel);
    }
  }

  function addNode(): void {
    const proposedLabel = (document.getElementById('nodeLabel') as HTMLInputElement)!.value || 'Node ' + (gData.nodes.length + 1);
    const size = parseInt((document.getElementById('nodeSize') as HTMLInputElement)!.value);
    const color = (document.getElementById('colorPicker') as HTMLInputElement)!.value;
    const exed = (document.getElementById('nodeExed') as HTMLInputElement)!.checked;

    const uniqueLabel = getUniqueLabel(proposedLabel);

    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // For the first node, place it at the origin
    let x = 0;
    let y = 0;

    // If there are existing nodes, find a position near the last added node
    if (gData.nodes.length > 0) {
      const lastNode = gData.nodes[gData.nodes.length - 1];
      if (lastNode) {
        // Place new node slightly offset from the last node
        const offset = 100; // Distance between nodes
        const angle = Math.random() * 2 * Math.PI; // Random angle
        x = lastNode.x + offset * Math.cos(angle);
        y = lastNode.y + offset * Math.sin(angle);
      }
    }

    const newNode = {
      id: nextNodeId++,
      label: uniqueLabel,
      color,
      size,
      exed,
      x,
      y,
      fx: x,  // Fix the node in place
      fy: y   // Fix the node in place
    };

    gData.nodes.push(newNode);
    Graph.graphData(gData);
    Graph.d3ReheatSimulation();

    // Mark graph as modified
    isGraphModified = true;

    // Select the newly created node
    handleNodeClick(newNode);
  }

  function deleteNode(): void {
    if (!selectedNode) return;

    // Store the node ID before deletion
    const nodeIdToDelete = selectedNode.id;

    // Remove all links connected to the node
    gData.links = gData.links.filter(link => 
      link.source.id !== nodeIdToDelete && link.target.id !== nodeIdToDelete
    );

    // Remove the node
    gData.nodes = gData.nodes.filter(node => node.id !== nodeIdToDelete);

    // Disable Clear button if no nodes remain
    if (gData.nodes.length === 0) {
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.disabled = true;
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.style.opacity = '0.5';
      isGraphModified = false; // special case: no need to save, even if the graph is modified
    } else {
      isGraphModified = true; // mark graph as modified
    }

    // Clear selection
    selectedNode = null;
    selectedLink = null;

    // Update UI and graph
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);

    // Ensure the size slider has its event listener
    const sizeInput = document.getElementById('nodeSize');
    sizeInput!.addEventListener('input', () => {
      updateNodeSizePreview();
    });
    updateNodeSizePreview();
  }

  function deleteLink(): void {
    if (!selectedLink) return;

    // Store the source and target nodes before deletion
    const sourceNode = selectedLink.source;
    const targetNode = selectedLink.target;

    // Remove the link from the array
    gData.links = gData.links.filter(link => link !== selectedLink);

    // Mark graph as modified
    isGraphModified = true;

    // Check if source node has any remaining links
    const sourceHasLinks = gData.links.some(link => 
      link.source.id === sourceNode.id || link.target.id === sourceNode.id
    );
    
    // Check if target node has any remaining links
    const targetHasLinks = gData.links.some(link => 
      link.source.id === targetNode.id || link.target.id === targetNode.id
    );

    // Fix position of nodes that lost their last link
    if (!sourceHasLinks) {
      sourceNode.fx = sourceNode.x!;
      sourceNode.fy = sourceNode.y!;
    }
    
    if (!targetHasLinks) {
      targetNode.fx = targetNode.x!;
      targetNode.fy = targetNode.y!;
    }

    // Clear selection
    selectedLink = null;
    selectedNode = null;

    // Update UI and graph
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);
  }

  function toggleLinkCreation(event: Event) {
    isCreatingLink = (event.target as HTMLInputElement).checked;
    
    if (isCreatingLink) {
      Graph.onNodeClick((node: NodeObject, event: MouseEvent) => 
        handleNodeClickForLink(node as Node, event));
    } else {
      Graph.onNodeClick((node: NodeObject, event: MouseEvent) =>
        handleNodeClick(node as Node));
    }
  }

  // Helper function to get the current pattern from the selected style canvas
  function getCurrentPattern(): DashPattern {
    const selectedStyle = document.getElementById('selectedStyle');
    return selectedStyle ? selectedStyle.dataset.pattern as DashPattern || DEFAULT_PATTERN : DEFAULT_PATTERN;
  }

  function handleNodeClickForLink(node: Node, event: MouseEvent) {
    if (!isCreatingLink) {
      handleNodeClick(node);
      return;
    }

    if (selectedNode && selectedNode !== node) {
      // Check if a link already exists between these nodes
      const selNode = selectedNode; // fix TypeScript selectedNode null check issue
      const existingLink = gData.links.find(link => 
        (link.source.id === selNode.id && link.target.id === node.id) ||
        (link.source.id === node.id && link.target.id === selNode.id)
      );

      if (!existingLink) {
        // Create new link with current properties from the Link tool
        const newLink = {
          source: selectedNode,
          target: node,
          thickness: parseInt((document.getElementById('linkThickness') as HTMLInputElement)!.value),
          color: (document.getElementById('colorPicker') as HTMLInputElement)!.value,
          label: (document.getElementById('linkLabel') as HTMLInputElement)!.value || undefined,
          dashPattern: getCurrentPattern()
        };
        gData.links.push(newLink);
        Graph.graphData(gData);

        // Mark graph as modified
        isGraphModified = true;

        // Select the target if shift is held down, otherwise select based on control key
        if (event.shiftKey) {
          handleNodeClick(node);
        } else if (event.ctrlKey) {
          // Keep the source node selected
          handleNodeClick(selectedNode);
        } else {
          // default is to select the link
          handleLinkClick(newLink, event);
        }
      } else {
        // If a link exists, just select the node
        handleNodeClick(node);
      }
      return; // Exit early to prevent node selection
    }
    
    // If no link was created or selected, select the clicked node
    handleNodeClick(node);
  }

  function handleNodeClick(node: Node) {
    selectedNode = node;
    selectedLink = null;
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);
    Graph.d3Force('center', null); // the user is taking control of the positions of nodes

    // Enable Clear button if this is the first node
    if (gData.nodes.length === 1) {
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.disabled = false;
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.style.opacity = '1';
    }
  }

  function handleNodeRightClick(node: NodeObject) {
    // Release node from its fixed position and let the simulation take over
    delete node.fx;
    delete node.fy;
    Graph.graphData(gData);
  }

  function handleLinkClick(linkobj: LinkObject, event?: MouseEvent) {
    const link = linkobj as Link;
    if (event) {
      event.stopPropagation();
    }
    selectedLink = link;
    selectedNode = null;
    
    // Update UI to reflect link selection
    const deleteNodeBtn = (document.getElementById('deleteNodeBtn') as HTMLButtonElement)!;
    const deleteLinkBtn = (document.getElementById('deleteLinkBtn') as HTMLButtonElement)!;
    deleteNodeBtn.disabled = true;
    deleteNodeBtn.style.opacity = '0.5';
    deleteLinkBtn.disabled = false;
    deleteLinkBtn.style.opacity = '1';
    
    // Update link label input
    (document.getElementById('linkLabel') as HTMLInputElement)!.value = link.label || '';
    
    // Update link dash pattern
    setSelectedStyle(link.dashPattern || DEFAULT_PATTERN);
    
    // Update link thickness slider
    const thicknessSlider = (document.getElementById('linkThickness') as HTMLInputElement);
    thicknessSlider.value = link.thickness.toString();
    updateLinkThicknessPreview();
    
    // Update color palette
    updateColorSelection(link.color);

    // Force graph update to show label
    Graph.graphData(gData);
    Graph.d3ReheatSimulation();
  }

  function updateNodePropertiesUI(): void {
    const labelInput = (document.getElementById('nodeLabel') as HTMLInputElement)!;
    const sizeInput = (document.getElementById('nodeSize') as HTMLInputElement)!;
    const exedInput = (document.getElementById('nodeExed') as HTMLInputElement)!;
    const deleteBtn = (document.getElementById('deleteNodeBtn') as HTMLButtonElement)!;

    if (selectedNode) {
      labelInput.value = selectedNode.label || '';
      sizeInput.value = selectedNode.size.toString();
      exedInput.checked = !!selectedNode.exed;
      updateColorSelection(selectedNode.color || DEFAULT_COLOR);
      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      labelInput.addEventListener('input', () => {
        if (selectedNode) {
          selectedNode.label = labelInput.value;
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });
      sizeInput.addEventListener('input', () => {
        if (selectedNode) {
          selectedNode.size = parseInt(sizeInput.value);
          isGraphModified = true;
          Graph.graphData(gData);
        }
        updateNodeSizePreview();
      });
      exedInput.addEventListener('change', () => {
        if (selectedNode) {
          selectedNode.exed = exedInput.checked;
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });
      updateNodeSizePreview();
    } else {
      labelInput.value = '';
      sizeInput.value = '10';
      exedInput.checked = false;
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.5';
      const newLabelInput = labelInput.cloneNode(true) as HTMLInputElement;
      if (labelInput.parentNode && labelInput.parentNode instanceof HTMLElement) {
        labelInput.parentNode.replaceChild(newLabelInput, labelInput);
      }
      updateNodeSizePreview();
    }
  }

  function updateLinkPropertiesUI(): void {
    const thicknessInput = (document.getElementById('linkThickness') as HTMLInputElement)!;
    const deleteBtn = (document.getElementById('deleteLinkBtn') as HTMLButtonElement)!;

    if (selectedLink) {
      thicknessInput.value = selectedLink.thickness.toString();
      updateColorSelection(selectedLink.color || DEFAULT_COLOR);
      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      thicknessInput.addEventListener('input', () => {
        if (selectedLink) {
          selectedLink.thickness = parseInt(thicknessInput.value);
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });
      updateLinkThicknessPreview();
    } else {
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.5';
      updateLinkThicknessPreview();
    }
  }

  function updateNodeSizePreview(): void {
    const size = (document.getElementById('nodeSize') as HTMLInputElement)!.value;
    const sizeInput = (document.getElementById('nodeSize') as HTMLInputElement)!;
    if (!sizeInput) return;
    const min = parseInt(sizeInput.min);
    const max = parseInt(sizeInput.max);
    const percent = ((parseInt(size) - min) / (max - min)) * 100;
    sizeInput.style.setProperty('--value-percent', `${percent}%`);
  }

  function updateLinkThicknessPreview(): void {
    const thickness = (document.getElementById('linkThickness') as HTMLInputElement)!.value;
    const thicknessInput = (document.getElementById('linkThickness') as HTMLInputElement)!;
    const min = parseInt(thicknessInput.min);
    const max = parseInt(thicknessInput.max);
    const percent = ((parseInt(thickness) - min) / (max - min)) * 100;
    thicknessInput.style.setProperty('--value-percent', `${percent}%`);
  }

  function startAutoLayout(): void {
    // Clear fixed positions
    gData.nodes.forEach(node => {
      delete node.fx;
      delete node.fy;
    });
    
    // Mark graph as modified
    isGraphModified = true;
    
    // Restart the simulation with animation
    Graph.d3ReheatSimulation();
  }

  function saveGraph(): void {
    // Show the save graph modal
    showSaveGraphModal();
  }

  function updateSaveSelectedButtonState(): void {
    const saveGraphFileInput = (document.getElementById('saveGraphFile') as HTMLInputElement)!;
    const saveImageFileInput = (document.getElementById('saveImageFile') as HTMLInputElement)!;
    const savePdfFileInput = (document.getElementById('savePdfFile') as HTMLInputElement)!;
    const saveSelectedBtn = (document.getElementById('saveSelectedBtn') as HTMLButtonElement)!;
    
    if (!saveGraphFileInput || !saveImageFileInput || !savePdfFileInput || !saveSelectedBtn) {
      return;
    }
    
    const states = {
      saveGraphFile: saveGraphFileInput.checked,
      saveImageFile: saveImageFileInput.checked,
      savePdfFile: savePdfFileInput.checked
    };
    
    // Disable button if no options are checked
    const shouldDisable = !(states.saveGraphFile || states.saveImageFile || states.savePdfFile);
    saveSelectedBtn.disabled = shouldDisable;
    saveSelectedBtn.style.opacity = shouldDisable ? '0.5' : '1';
  }

  function showSaveGraphModal(): void {
    const modal = document.getElementById('saveGraphModal') as HTMLElement;
    modal.style.display = 'flex';
    
    // Set JSON save option as checked by default only on first save
    const saveGraphFileInput = document.getElementById('saveGraphFile') as HTMLInputElement;
    if (saveGraphFileInput && isFirstSave) {
      saveGraphFileInput.checked = true;
      isFirstSave = false;
    }
    
    // Add event listeners for the checkboxes
    const checkboxes = ['saveGraphFile', 'saveImageFile', 'savePdfFile'];
    checkboxes.forEach((id: string) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        // Remove any existing listeners
        checkbox.removeEventListener('change', updateSaveSelectedButtonState);
        // Add the new listener
        checkbox.addEventListener('change', function(_event: Event) {
          updateSaveSelectedButtonState();
        });
      }
    });
    
    // Set initial button state
    updateSaveSelectedButtonState();
  }

  function hideSaveGraphModal(): void {
    const modal = document.getElementById('saveGraphModal') as HTMLElement;
    modal.style.display = 'none';
  }

  // Add event listeners for save graph modal buttons
  const saveSelectedBtn = document.getElementById('saveSelectedBtn') as HTMLButtonElement;
  saveSelectedBtn.addEventListener('click', handleSaveSelected);
  const cancelSaveBtn = document.getElementById('cancelSaveBtn') as HTMLButtonElement;
  cancelSaveBtn.addEventListener('click', hideSaveGraphModal);

  function handleSaveSelected(): void {
    const saveGraphFile = document.getElementById('saveGraphFile') as HTMLInputElement;
    const saveImageFile = document.getElementById('saveImageFile') as HTMLInputElement;
    const savePdfFile = document.getElementById('savePdfFile') as HTMLInputElement;

    if (!saveGraphFile && !saveImageFile && !savePdfFile) {
      showGraphError('Please select at least one save option');
      return;
    }

    const graphName = (document.getElementById('graphName') as HTMLInputElement)!.value || 'graph';

    if (saveGraphFile && saveGraphFile.checked) {
      saveGraphFileToDisk(graphName);
      isGraphModified = false; // Only clear the modified flag if saving as JSON
    }

    if (saveImageFile && saveImageFile.checked) {
      saveGraphAsImage(graphName);
    }

    if (savePdfFile && savePdfFile.checked) {
      saveGraphAsPdf(graphName);
    }

    hideSaveGraphModal();
  }

  function saveGraphFileToDisk(graphName: string): void {
    const graphData = {
      metadata: {
        application: APPLICATION_NAME,
        version: GRAPH_EDITOR_VERSION,
        timestamp: new Date().toISOString().split('.')[0] + 'Z',  // Keep UTC for metadata
        name: graphName
      },
      nodes: gData.nodes.map(node => {
        const nodeData: Node = {
          id: node.id,
          label: node.label,
          color: node.color,
          size: node.size,
          x: node.x,
          y: node.y
        };
        // Only include exed if it's true
        if (node.exed) {
          nodeData.exed = true;
        }
        return nodeData;
      }),
      links: gData.links.map(link => ({
        source: link.source.id,
        target: link.target.id,
        thickness: link.thickness,
        color: link.color,
        label: link.label,
        dashPattern: link.dashPattern
      }))
    };

    const jsonString = JSON.stringify(graphData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Generate date stamp in local time
    const now = new Date();
    const dateStamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + 'T' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphName}-${dateStamp}.graph`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function saveGraphAsImage(graphName: string): void {
    // Get the graph container
    const graphContainer = document.getElementById('graph')! as HTMLElement;
    
    // Store and remove the pattern canvases
    const styleOptions = document.getElementById('styleOptions')! as HTMLElement;
    const patternCanvases = Array.from(styleOptions.querySelectorAll('canvas'));
    patternCanvases.forEach(canvas => canvas.remove());
    
    // Use html2canvas to capture the graph
    html2canvas(graphContainer, {
      useCORS: true,
      allowTaint: true
    }).then((canvas: HTMLCanvasElement) => {
      // Restore the pattern canvases
      patternCanvases.forEach((canvas: HTMLCanvasElement) => styleOptions.appendChild(canvas));
      
      // Generate date stamp in local time
      const now = new Date();
      const dateStamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      // Convert canvas to blob
      canvas.toBlob((blob: Blob | null) => {
        const url = URL.createObjectURL(blob!);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${graphName}-${dateStamp}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    });
  }

  function saveGraphAsPdf(graphName: string): void {
    // Get the graph container
    const graphContainer = document.getElementById('graph')! as HTMLElement;
    
    // Store and remove the pattern canvases
    const styleOptions = document.getElementById('styleOptions')! as HTMLElement;
    const patternCanvases = Array.from(styleOptions.querySelectorAll('canvas'));
    patternCanvases.forEach(canvas => canvas.remove());
    
    // Use html2canvas to capture the graph
    html2canvas(graphContainer, {
      useCORS: true,
      allowTaint: true
    }).then((canvas: HTMLCanvasElement) => {
      // Restore the pattern canvases
      patternCanvases.forEach((canvas: HTMLCanvasElement) => styleOptions.appendChild(canvas));
      
      // Generate date stamp in local time
      const now = new Date();
      const dateStamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      // Create PDF using the imported jsPDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'in',
        format: 'letter'
      });
      
      // Calculate dimensions to fit on US Letter landscape with some padding
      const letterWidth = 11; // US Letter width in inches
      const letterHeight = 8.5; // US Letter height in inches
      const padding = 0.4; // padding in inches
      
      // Calculate scale to fit the canvas on US Letter while maintaining aspect ratio
      const scale = Math.min(
        (letterWidth - padding * 2) / canvas.width,
        (letterHeight - padding * 2) / canvas.height
      );
      
      // Calculate dimensions after scaling
      const scaledWidth = canvas.width * scale;
      const scaledHeight = canvas.height * scale;
      
      // Calculate centering offsets
      const xOffset = (letterWidth - scaledWidth) / 2;
      const yOffset = (letterHeight - scaledHeight) / 2;
      
      // Add the image to the PDF with calculated dimensions and position
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        xOffset,
        yOffset,
        scaledWidth,
        scaledHeight
      );
      
      // Save the PDF
      pdf.save(`${graphName}-${dateStamp}.pdf`);
    });
  }

  function loadGraph(): void {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.graph,.json';  // Accept both .graph and .json for backward compatibility
    
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files![0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const graphData = JSON.parse((event.target as FileReader).result as string);
          processGraphData(graphData);
        } catch (error: any) {
          showGraphError('Error loading graph: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  // This function processes the graph data and updates the graph.
  // It is called when the user loads a graph and for the example graph on initialization.
  // Error handling needs to be done by the caller.
  function processGraphData(graphData: any): void {
    // Validate the loaded data
    if (!graphData.nodes || !graphData.links) {
      throw new Error('Invalid graph data format');
    }

    // Set the graph name if it exists in the metadata
    if (graphData.metadata && graphData.metadata.name) {
      (document.getElementById('graphName') as HTMLInputElement)!.value = graphData.metadata.name;
    }

    // Check for duplicate node IDs
    const nodeIds = new Set();
    let maxNodeId = 0;
    for (const node of graphData.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error('Error: Duplicate node ID found in graph');
      }
      nodeIds.add(node.id);
      maxNodeId = Math.max(maxNodeId, node.id);
    }

    // Clear current graph
    gData.nodes = [];
    gData.links = [];

    // Load nodes
    graphData.nodes.forEach((nodeData: Node) => {
      if (nodeData.id &&
          typeof nodeData.id === 'number' &&
          nodeData.x &&
          typeof nodeData.x === 'number' &&
          nodeData.y &&
          typeof nodeData.y === 'number' &&
          (!nodeData.label || typeof nodeData.label === 'string') &&
          (!nodeData.color || typeof nodeData.color === 'string') &&
          (!nodeData.size || typeof nodeData.size === 'number')
      ) {
        gData.nodes.push({
          id: nodeData.id,
          label: nodeData.label || '',
          color: nodeData.color || DEFAULT_COLOR,
          size: nodeData.size || DEFAULT_SIZE,
          x: nodeData.x,
          y: nodeData.y,
          fx: nodeData.x,  // Fix the node in its loaded position
          fy: nodeData.y,  // Fix the node in its loaded position
          exed: !!nodeData.exed
        });
      } else {
        console.warn(`Loaded node (${nodeData.id}) failed type check.`);
      }
    });

    // Build a Map for fast node lookup
    const nodeMap = new Map<number, Node>();
    gData.nodes.forEach(node => nodeMap.set(node.id, node));

    // Load links, converting source/target IDs to Node objects
    graphData.links.forEach((
      linkData: Omit<Link, 'source' | 'target'> &
      { source: number, target: number }) => {
      const sourceNode = nodeMap.get(linkData.source);
      const targetNode = nodeMap.get(linkData.target);
      if (sourceNode &&
          targetNode &&
          (!linkData.thickness || typeof linkData.thickness === 'number') &&
          (!linkData.color || typeof linkData.color === 'string') &&
          (!linkData.label || typeof linkData.label === 'string') &&
          (!linkData.dashPattern || isDashPattern(linkData.dashPattern))
        ) {
        gData.links.push({
          source: sourceNode,
          target: targetNode,
          thickness: linkData.thickness || DEFAULT_THICKNESS,
          color: linkData.color || DEFAULT_COLOR,
          ...(linkData.label && { label: linkData.label }),
          ...(linkData.dashPattern && {dashPattern: linkData.dashPattern })
        });
      } else {
        console.warn(
          `Loaded link (${linkData.source} -> ${linkData.target}) failed type check.`);
      }
    });

    // Set nextNodeId to max ID + 1
    nextNodeId = maxNodeId + 1;

    // Update the graph
    selectedNode = null;
    selectedLink = null;
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);

    // Reset modification flag after loading
    isGraphModified = false;

    // Enable Clear button if graph has nodes
    if (gData.nodes.length > 0) {
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.disabled = false;
      (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.style.opacity = '1';
    }

    // Calculate bounds of the loaded graph
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    gData.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    // If we have nodes, center and zoom to fit them
    if (gData.nodes.length > 0) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = maxX - minX;
      const height = maxY - minY;
      const scale = Math.min(
        (window.innerWidth - 250) / (width + 100), // Account for sidebar and padding
        window.innerHeight / (height + 100)
      );
      Graph.d3Force('center', null) // center force is not intuitive when editing
      Graph.centerAt(centerX, centerY, 1000);
      Graph.zoom(scale * 0.8); // Zoom to 80% of the calculated scale to add some padding
    }
  }

  function showGraphError(message: string): void {
    const errorDiv = (document.getElementById('graphError') as HTMLElement)!;
    const messageSpan = (document.getElementById('errorMessage') as HTMLElement)!;
    messageSpan.textContent = message;
    errorDiv.style.display = 'block';
  }

  function hideGraphError(): void {
    const errorDiv = (document.getElementById('graphError') as HTMLElement)!;
    errorDiv.style.display = 'none';
  }

  function showConfirmModal(): void {
    (document.getElementById('confirmModal') as HTMLElement)!.style.display = 'flex';
  }

  function hideConfirmModal(): void {
    (document.getElementById('confirmModal') as HTMLElement)!.style.display = 'none';
  }

  function clearGraph(): void {
    // Clear graph data
    gData.nodes = [];
    gData.links = [];
    
    // Reset state variables
    selectedNode = null;
    selectedLink = null;
    isCreatingLink = true;
    nextNodeId = 1;
    isGraphModified = false;
    
    // Reset view
    Graph.centerAt(0, 0, 1000);
    Graph.zoom(1.5);
    
    // Update graph and UI
    Graph.graphData(gData);
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    
    // Reset node label input
    (document.getElementById('nodeLabel') as HTMLInputElement)!.value = '';
    
    // Reset graph name
    (document.getElementById('graphName') as HTMLInputElement)!.value = '';
    
    // Disable Clear button
    (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.disabled = true;
    (document.getElementById('clearGraphBtn') as HTMLButtonElement)!.style.opacity = '0.5';
  }

  // Load example graph on initialization
  fetch('example.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load example graph');
      }
      return response.json();
    })
    .then(graphData => {
      // Use the existing loadGraph function to process the data
      processGraphData(graphData);
    })
    .catch(error => {
      console.error('Error loading example graph:', error);
    });

  // Dismiss help banner on any user action
  function dismissHelpBanner(): void {
    const banner = document.getElementById('helpBanner') as HTMLElement;
    if (banner) banner.style.display = 'none';

    // Remove event listeners after first action
    window.removeEventListener('mousedown', dismissHelpBanner, true);
    window.removeEventListener('keydown', dismissHelpBanner, true);
    window.removeEventListener('touchstart', dismissHelpBanner, true);
  }

  window.addEventListener('mousedown', dismissHelpBanner, true);
  window.addEventListener('keydown', dismissHelpBanner, true);
  window.addEventListener('touchstart', dismissHelpBanner, true);

  /**
   * Draws a line pattern on a canvas element.
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   * @param {DashPattern} pattern - The pattern to draw.
   * @returns {void}
   */
  function drawPattern(canvas: HTMLCanvasElement, pattern: DashPattern): void {
    const ctx = (canvas.getContext('2d'))!;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the pattern
    ctx.beginPath();
    ctx.setLineDash(pattern === 'dotted' ? [1, 3] :
                   pattern === 'dashed' ? [6, 4] :
                   pattern === 'long-dashed' ? [12, 4] :
                   pattern === 'dash-dot' ? [8, 3, 2, 3] : []);
    ctx.moveTo(10, canvas.height/2);
    ctx.lineTo(canvas.width - 10, canvas.height/2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Updates the selected style canvas with a new pattern.
   * @param {DashPattern} pattern - The pattern to set.
   * @returns {void}
   */
  function setSelectedStyle(pattern: DashPattern): void {
    const selectedStyle = (document.getElementById('selectedStyle') as HTMLCanvasElement);
    if (!selectedStyle) return;
    
    drawPattern(selectedStyle, pattern);
    selectedStyle.dataset.pattern = pattern;
  }

  /**
   * Initializes a pattern option canvas with click handling.
   * @param {HTMLCanvasElement} canvas - The canvas element to initialize
   * @param {DashPattern} pattern - The pattern to draw.
   * @returns {void}
   */
  function initPatternOption(canvas: HTMLCanvasElement, pattern: DashPattern): void {
    drawPattern(canvas, pattern);
    canvas.dataset.pattern = pattern;
    
    // Handle click on option
    canvas.onclick = function(e) {
      e.stopPropagation();
      setSelectedStyle(pattern);
      (document.getElementById('styleOptions') as HTMLElement)!.style.display = 'none';
      
      // Update selected link if one is selected
      if (selectedLink) {
        selectedLink.dashPattern = pattern;
        isGraphModified = true;
        Graph.graphData(gData);
      }
    };
  }

  /**
   * Initializes the line pattern dropdown functionality.
   * This includes:
   * - Setting up the selected style button
   * - Initializing pattern option canvases
   * - Handling window resize events
   * - Setting up click-outside behavior
   * @returns {void}
   */
  function initLinePatternDropdown(): void {
    // Initialize selected style canvas
    const selectedStyle = document.getElementById('selectedStyle');
    const selectedStyleBtn = document.getElementById('selectedStyleBtn');
    if (selectedStyle && selectedStyleBtn) {
      // Set initial pattern
      setSelectedStyle(DEFAULT_PATTERN);
      
      // Handle click on button
      selectedStyleBtn.onclick = function(e) {
        e.stopPropagation();
        const options = document.getElementById('styleOptions')! as HTMLElement;
        
        if (options.style.display === 'none') {
          // Show options first so we can get their dimensions
          options.style.display = 'block';
          
          // Initialize all option canvases
          document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
            initPatternOption(canvas as HTMLCanvasElement, (canvas as HTMLElement).dataset.pattern! as DashPattern);
          });
        } else {
          options.style.display = 'none';
        }
      };
    }

    // Initialize option canvases
    document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
      initPatternOption(canvas as HTMLCanvasElement, (canvas as HTMLElement).dataset.pattern! as DashPattern);
    });

    // Handle window resize
    window.addEventListener('resize', function() {
      // Redraw all canvases when window is resized
      setSelectedStyle(getCurrentPattern());
      document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
        initPatternOption(canvas as HTMLCanvasElement, (canvas as HTMLElement).dataset.pattern! as DashPattern);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const dropdown = document.querySelector('.line-pattern-dropdown');
      if (dropdown && !dropdown.contains(e.target as globalThis.Node)) {
        document.getElementById('styleOptions')!.style.display = 'none';
      }
    });
  }

  // Make sure we initialize after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initLinePatternDropdown();
    });
  } else {
    initLinePatternDropdown();
  }
});