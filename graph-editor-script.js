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

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize slider backgrounds
  updateNodeSizePreview();
  updateLinkThicknessPreview();

  // Set initial opacity for Delete Node button
  document.getElementById('deleteNodeBtn').style.opacity = '0.5';
  
  // Set initial state for Clear button
  document.getElementById('clearGraphBtn').disabled = true;
  document.getElementById('clearGraphBtn').style.opacity = '0.5';

  // Track if graph has been modified
  let isGraphModified = false;

  // Track the current operation (clear or load)
  let modalFunction = null;

  // Add this variable at the top level with other state variables
  let isFirstSave = true;

  function executeOrConfirm(graphFunction) {
    hideGraphError();
    if (isGraphModified) {
      modalFunction = graphFunction;
      showConfirmModal();
    } else {
      graphFunction();
    }
  }

  function hideConfirmModalAndExecute() {
    hideConfirmModal();
    if (modalFunction) {
      modalFunction();
      modalFunction = null;
    }
  }

  // Add event listeners for modal buttons
  document.getElementById('saveAndProceedBtn').addEventListener('click', () => {
    const graphName = document.getElementById('graphName').value || 'graph';
    saveGraphFileToDisk(graphName);
    hideConfirmModalAndExecute();
  });

  document.getElementById('proceedWithoutSaveBtn').addEventListener('click', hideConfirmModalAndExecute);

  document.getElementById('cancelBtn').addEventListener('click', hideConfirmModal);

  // Add help icon event listener
  document.getElementById('helpIcon').addEventListener('click', () => {
    window.open('https://github.com/davidchaiken/graph-editor/blob/main/README.md', '_blank');
  });

  // Add global event listener for node size slider
  document.getElementById('nodeSize').addEventListener('input', () => {
    updateNodeSizePreview();
  });

  // Graph data
  const gData = {
    nodes: [],
    links: []
  };

  // Initialize graph
  const Graph = ForceGraph()
    (document.getElementById('graph'))
      .graphData(gData)
      .nodeId('id')
      .nodeLabel('label')
      .nodeColor('color')
      .nodeVal('size')
      .linkWidth('thickness')
      .linkColor('color')
      .linkLabel(link => link.label || '')  // Use a function to handle undefined labels
      .linkCanvasObject((link, ctx, globalScale) => {
        const source = link.source;
        const target = link.target;
        
        // Draw link
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        
        // Set line style based on selection
        if (link === selectedLink) {
          // Glow effect for selected links
          ctx.shadowBlur = 15;
          ctx.shadowColor = link.color || '#1f77b4';
          ctx.lineWidth = (link.thickness || 1) * 0.75;
        } else {
          // Normal style for unselected links
          ctx.shadowBlur = 0;
          ctx.lineWidth = (link.thickness || 1) * 0.5;
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
        
        ctx.strokeStyle = link.color || '#1f77b4';
        ctx.stroke();

        // Draw link label if it exists
        if (link.label) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          
          // Calculate angle for text rotation
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          
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
      .onNodeClick((node, event) => handleNodeClickForLink(node, event))
      .onNodeRightClick(handleNodeRightClick)
      .onLinkClick(handleLinkClick)
      .onBackgroundClick(() => {
        selectedNode = null;
        selectedLink = null;
        // Only update the UI to reflect the cleared selection
        const deleteNodeBtn = document.getElementById('deleteNodeBtn');
        const deleteLinkBtn = document.getElementById('deleteLinkBtn');
        deleteNodeBtn.disabled = true;
        deleteNodeBtn.style.opacity = '0.5';
        deleteLinkBtn.disabled = true;
        deleteLinkBtn.style.opacity = '0.5';
        // Clear link label input
        document.getElementById('linkLabel').value = '';
        Graph.graphData(gData);
      })
      .onNodeDragEnd(node => {
        node.fx = node.x;
        node.fy = node.y;
        isGraphModified = true;
        Graph.d3Force('center', null); // the user is taking control of the positions of nodes
      })
      .nodeCanvasObject((node, ctx, globalScale) => {
        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size || 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || '#1f77b4';
        ctx.fill();

        // Add glow effect if node is selected
        if (node === selectedNode) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = node.color || '#1f77b4';
          // Draw a slightly larger circle for the glow
          ctx.beginPath();
          ctx.arc(node.x, node.y, (node.size || 5) * 1.2, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || '#1f77b4';
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
        ctx.fillText(label, node.x, node.y + (node.size || 5) + fontSize);

        // Draw X mark if node is marked
        if (node.exed) {
          const size = node.size || 5;
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
      .d3Force('link', d3.forceLink().distance(link => {
        // distance is determined by the color of the nodes and the link
        const baseDistance = 100;
        if (link.source.color === link.target.color) {
          if (link.source.color == link.color) {
            return baseDistance * 0.5; // node + link color makes nodes a lot more attractive
          } else {
            return baseDistance * 0.75; // node color makes nodes more attractive
          }
        }
        return baseDistance;
      }).strength(link => {
        switch (link.dashPattern) {
          case 'dotted':
            return (link.thickness || 1) * 0.02;
          case 'dashed':
            return (link.thickness || 1) * 0.04;
          case 'long-dashed':
            return (link.thickness || 1) * 0.06;
          case 'dash-dot':
            return (link.thickness || 1) * 0.08;
          default:
            return (link.thickness || 1) * 0.1;
        }
      }))
      .d3Force('center', null) // center force is not intuitive when editing
      .d3Force('collision', d3.forceCollide(node => (node.size || 5) + 1))
      .width(document.getElementById('graph').offsetWidth)
      .height(document.getElementById('graph').offsetHeight);

  // Initialize view
  Graph.centerAt(0, 0, 1000);
  Graph.zoom(1.5);

  // Set default color to first palette color
  const defaultColor = document.querySelector('#colorPalette .color-option').dataset.color;
  document.getElementById('colorPicker').value = defaultColor;
  updateColorSelection(defaultColor);

  // Handle window resize
  window.addEventListener('resize', () => {
    const graphElement = document.getElementById('graph');
    Graph
      .width(graphElement.offsetWidth)
      .height(graphElement.offsetHeight);
  });

  // State variables
  let selectedNode = null;
  let selectedLink = null;
  let isCreatingLink = true;
  let nextNodeId = 1; // maximum node id + 1
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Track mouse position
  document.getElementById('graph').addEventListener('mousemove', (event) => {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const graphCoords = Graph.screen2GraphCoords(x, y);
    lastMouseX = graphCoords.x;
    lastMouseY = graphCoords.y;
  });

  // Event handlers
  document.getElementById('addNodeBtn').addEventListener('click', addNode);
  document.getElementById('deleteNodeBtn').addEventListener('click', deleteNode);
  document.getElementById('deleteLinkBtn').addEventListener('click', deleteLink);
  document.getElementById('addLinksToggle').addEventListener('change', toggleLinkCreation);
  document.getElementById('nodeSize').addEventListener('input', updateNodeSizePreview);
  document.getElementById('linkThickness').addEventListener('input', updateLinkThicknessPreview);
  document.getElementById('autoLayoutBtn').addEventListener('click', () => {
    hideGraphError();
    Graph.d3Force('center', d3.forceCenter(0, 0).strength(0.1)); // move towards origin
    startAutoLayout();
  });
  document.getElementById('saveGraphBtn').addEventListener('click', () => {
    hideGraphError();
    showSaveGraphModal();
  });
  document.getElementById('loadGraphBtn').addEventListener('click', () => {
    executeOrConfirm(loadGraph);
  });

  document.getElementById('clearGraphBtn').addEventListener('click', () => {
    executeOrConfirm(clearGraph);
  });

  // Add keyboard event handler for Delete and Backspace keys
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') &&
        document.activeElement !== document.getElementById('nodeLabel') &&
        document.activeElement !== document.getElementById('linkLabel')) {
      if (selectedLink) {
        deleteLink();
      } else if (selectedNode) {
        deleteNode();
      }
    }
  });

  // Add keyboard event handler for n key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'n' &&
        document.activeElement !== document.getElementById('nodeLabel') &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {

      // Create a new node at the current mouse position
      const proposedLabel = document.getElementById('nodeLabel').value || 'Node ' + (gData.nodes.length + 1);
      const size = parseInt(document.getElementById('nodeSize').value);
      const color = document.getElementById('colorPicker').value;
      const exed = document.getElementById('nodeExed').checked;
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'x' &&
        document.activeElement !== document.getElementById('nodeLabel') &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
      
      const exedInput = document.getElementById('nodeExed');
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
  document.querySelectorAll('#colorPalette .color-option').forEach(option => {
    option.addEventListener('click', () => {
      const color = option.dataset.color;
      document.getElementById('colorPicker').value = color;
      applyColor(color);
      updateColorSelection(color);
    });
  });

  // Color input change handler
  document.getElementById('colorPicker').addEventListener('input', (e) => {
    const color = e.target.value;
    applyColor(color);
    updateColorSelection(color);
  });

  // Add event listener for link label changes
  document.getElementById('linkLabel').addEventListener('input', (e) => {
    if (selectedLink) {
      selectedLink.label = e.target.value;
      isGraphModified = true;
      // Force immediate update of the graph
      Graph.graphData(gData);
      Graph.d3ReheatSimulation();
    }
  });

  // Add event listener for link thickness changes
  document.getElementById('linkThickness').addEventListener('input', (e) => {
    if (selectedLink) {
      selectedLink.thickness = parseInt(e.target.value);
      isGraphModified = true;
      Graph.graphData(gData);
    }
  });

  // Helper function to apply color to selected entity
  function applyColor(color) {
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
  function updateColorSelection(color) {
    const palette = document.getElementById('colorPalette');
    
    // Check if the color is in our palette
    const isPaletteColor = Array.from(palette.querySelectorAll('.color-option'))
      .some(option => option.dataset.color === color);
    
    // Update palette selection
    palette.querySelectorAll('.color-option').forEach(option => {
      option.classList.toggle('selected', option.dataset.color === color);
    });
    
    // Update color picker value
    document.getElementById('colorPicker').value = color;

    // Update X checkbox color
    const xMark = document.querySelector('.x-mark');
    if (xMark) {
      xMark.style.backgroundColor = color;
    }
  }

  // Helper function to get contrasting text color
  function getContrastColor(hexColor) {
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
  function getUniqueLabel(proposedLabel) {
    // Check if the label already exists
    const existingLabels = new Set(gData.nodes.map(node => node.label));
    if (!existingLabels.has(proposedLabel)) {
      return proposedLabel;
    }

    // Check if label ends with a number
    const numberMatch = proposedLabel.match(/(.*?)(\d+)$/);
    
    if (numberMatch) {
      // Label ends with a number
      const baseLabel = numberMatch[1].trim();
      const number = parseInt(numberMatch[2]);
      
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

  function addNode() {
    const proposedLabel = document.getElementById('nodeLabel').value || 'Node ' + (gData.nodes.length + 1);
    const size = parseInt(document.getElementById('nodeSize').value);
    const color = document.getElementById('colorPicker').value;
    const exed = document.getElementById('nodeExed').checked;

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
      // Place new node slightly offset from the last node
      const offset = 100; // Distance between nodes
      const angle = Math.random() * 2 * Math.PI; // Random angle
      x = lastNode.x + offset * Math.cos(angle);
      y = lastNode.y + offset * Math.sin(angle);
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

  function deleteNode() {
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
      document.getElementById('clearGraphBtn').disabled = true;
      document.getElementById('clearGraphBtn').style.opacity = '0.5';
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
    sizeInput.addEventListener('input', () => {
      updateNodeSizePreview();
    });
    updateNodeSizePreview();
  }

  function deleteLink() {
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
      sourceNode.fx = sourceNode.x;
      sourceNode.fy = sourceNode.y;
    }
    
    if (!targetHasLinks) {
      targetNode.fx = targetNode.x;
      targetNode.fy = targetNode.y;
    }

    // Clear selection
    selectedLink = null;
    selectedNode = null;

    // Update UI and graph
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);
  }

  function toggleLinkCreation(event) {
    isCreatingLink = event.target.checked;
    
    if (isCreatingLink) {
      Graph.onNodeClick((node, event) => handleNodeClickForLink(node, event));
    } else {
      Graph.onNodeClick((node, event) => handleNodeClick(node));
    }
  }

  // Helper function to get the current pattern from the selected style canvas
  function getCurrentPattern() {
    const selectedStyle = document.getElementById('selectedStyle');
    return selectedStyle ? selectedStyle.dataset.pattern || 'solid' : 'solid';
  }

  function handleNodeClickForLink(node, event) {
    if (!isCreatingLink) {
      handleNodeClick(node);
      return;
    }

    if (selectedNode && selectedNode !== node) {
      // Check if a link already exists between these nodes
      const existingLink = gData.links.find(link => 
        (link.source.id === selectedNode.id && link.target.id === node.id) ||
        (link.source.id === node.id && link.target.id === selectedNode.id)
      );

      if (!existingLink) {
        // Create new link with current properties from the Link tool
        const newLink = {
          source: selectedNode.id,
          target: node.id,
          thickness: parseInt(document.getElementById('linkThickness').value),
          color: document.getElementById('colorPicker').value,
          label: document.getElementById('linkLabel').value || undefined,
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

  function handleNodeClick(node) {
    selectedNode = node;
    selectedLink = null;
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);
    Graph.d3Force('center', null); // the user is taking control of the positions of nodes

    // Enable Clear button if this is the first node
    if (gData.nodes.length === 1) {
      document.getElementById('clearGraphBtn').disabled = false;
      document.getElementById('clearGraphBtn').style.opacity = '1';
    }
  }

  function handleNodeRightClick(node) {
    // Release node from its fixed position and let the simulation take over
    node.fx = null;
    node.fy = null;
    Graph.graphData(gData);
  }

  function handleLinkClick(link, event) {
    if (event) {
      event.stopPropagation();
    }
    selectedLink = link;
    selectedNode = null;
    
    // Update UI to reflect link selection
    const deleteNodeBtn = document.getElementById('deleteNodeBtn');
    const deleteLinkBtn = document.getElementById('deleteLinkBtn');
    deleteNodeBtn.disabled = true;
    deleteNodeBtn.style.opacity = '0.5';
    deleteLinkBtn.disabled = false;
    deleteLinkBtn.style.opacity = '1';
    
    // Update link label input
    document.getElementById('linkLabel').value = link.label || '';
    
    // Update link dash pattern
    setSelectedStyle(link.dashPattern || 'solid');
    
    // Update link thickness slider
    const thicknessSlider = document.getElementById('linkThickness');
    thicknessSlider.value = link.thickness;
    updateLinkThicknessPreview();
    
    // Update color palette
    updateColorSelection(link.color);

    // Force graph update to show label
    Graph.graphData(gData);
    Graph.d3ReheatSimulation();
  }

  function updateNodePropertiesUI() {
    const labelInput = document.getElementById('nodeLabel');
    const sizeInput = document.getElementById('nodeSize');
    const exedInput = document.getElementById('nodeExed');
    const deleteBtn = document.getElementById('deleteNodeBtn');

    if (selectedNode) {
      labelInput.value = selectedNode.label || '';
      sizeInput.value = selectedNode.size || 5;
      exedInput.checked = selectedNode.exed || false;
      updateColorSelection(selectedNode.color || '#1f77b4');
      
      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      
      labelInput.addEventListener('input', () => {
        if (selectedNode) {
          selectedNode.label = labelInput.value;
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });
      
      // Update slider background in real-time
      sizeInput.addEventListener('input', () => {
        if (selectedNode) {
          selectedNode.size = parseInt(sizeInput.value);
          isGraphModified = true;
          Graph.graphData(gData);
        }
        updateNodeSizePreview();
      });

      // Update X mark in real-time
      exedInput.addEventListener('change', () => {
        if (selectedNode) {
          selectedNode.exed = exedInput.checked;
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });

      // Update slider background when node is selected
      updateNodeSizePreview();
    } else {
      labelInput.value = '';
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.5';
      
      const newLabelInput = labelInput.cloneNode(true);
      labelInput.parentNode.replaceChild(newLabelInput, labelInput);

      // Update slider background when node is deselected
      updateNodeSizePreview();
    }
  }

  function updateLinkPropertiesUI() {
    const thicknessInput = document.getElementById('linkThickness');
    const deleteBtn = document.getElementById('deleteLinkBtn');

    if (selectedLink) {
      thicknessInput.value = selectedLink.thickness || 1;
      updateColorSelection(selectedLink.color || '#1f77b4');
      
      deleteBtn.disabled = false;
      deleteBtn.style.opacity = '1';
      
      thicknessInput.addEventListener('input', () => {
        if (selectedLink) {
          selectedLink.thickness = parseInt(thicknessInput.value);
          isGraphModified = true;
          Graph.graphData(gData);
        }
      });

      // Update slider background when link is selected
      updateLinkThicknessPreview();
    } else {
      // Don't reset the thickness value when no link is selected
      deleteBtn.disabled = true;
      deleteBtn.style.opacity = '0.5';

      // Update slider background when link is deselected
      updateLinkThicknessPreview();
    }
  }

  function updateNodeSizePreview() {
    const size = document.getElementById('nodeSize').value;
    const sizeInput = document.getElementById('nodeSize');
    const min = sizeInput.min;
    const max = sizeInput.max;
    const percent = ((size - min) / (max - min)) * 100;
    sizeInput.style.setProperty('--value-percent', `${percent}%`);
  }

  function updateLinkThicknessPreview() {
    const thickness = document.getElementById('linkThickness').value;
    const thicknessInput = document.getElementById('linkThickness');
    const min = thicknessInput.min;
    const max = thicknessInput.max;
    const percent = ((thickness - min) / (max - min)) * 100;
    thicknessInput.style.setProperty('--value-percent', `${percent}%`);
  }

  function startAutoLayout() {
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

  function saveGraph() {
    // Show the save graph modal
    showSaveGraphModal();
  }

  function updateSaveSelectedButtonState() {
    const saveGraphFile = document.getElementById('saveGraphFile');
    const saveImageFile = document.getElementById('saveImageFile');
    const savePdfFile = document.getElementById('savePdfFile');
    const saveSelectedBtn = document.getElementById('saveSelectedBtn');
    
    if (!saveGraphFile || !saveImageFile || !savePdfFile || !saveSelectedBtn) {
      return;
    }
    
    const states = {
      saveGraphFile: saveGraphFile.checked,
      saveImageFile: saveImageFile.checked,
      savePdfFile: savePdfFile.checked
    };
    
    // Disable button if no options are checked
    const shouldDisable = !(states.saveGraphFile || states.saveImageFile || states.savePdfFile);
    saveSelectedBtn.disabled = shouldDisable;
    saveSelectedBtn.style.opacity = shouldDisable ? '0.5' : '1';
  }

  function showSaveGraphModal() {
    const modal = document.getElementById('saveGraphModal');
    modal.style.display = 'flex';
    
    // Set JSON save option as checked by default only on first save
    const saveGraphFile = document.getElementById('saveGraphFile');
    if (saveGraphFile && isFirstSave) {
      saveGraphFile.checked = true;
      isFirstSave = false;
    }
    
    // Add event listeners for the checkboxes
    const checkboxes = ['saveGraphFile', 'saveImageFile', 'savePdfFile'];
    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        // Remove any existing listeners
        checkbox.removeEventListener('change', updateSaveSelectedButtonState);
        // Add the new listener
        checkbox.addEventListener('change', function() {
          updateSaveSelectedButtonState();
        });
      }
    });
    
    // Set initial button state
    updateSaveSelectedButtonState();
  }

  function hideSaveGraphModal() {
    document.getElementById('saveGraphModal').style.display = 'none';
  }

  // Add event listeners for save graph modal buttons
  document.getElementById('saveSelectedBtn').addEventListener('click', handleSaveSelected);
  document.getElementById('cancelSaveBtn').addEventListener('click', hideSaveGraphModal);

  function handleSaveSelected() {
    const saveGraphFile = document.getElementById('saveGraphFile').checked;
    const saveImageFile = document.getElementById('saveImageFile').checked;
    const savePdfFile = document.getElementById('savePdfFile').checked;

    if (!saveGraphFile && !saveImageFile && !savePdfFile) {
      showGraphError('Please select at least one save option');
      return;
    }

    const graphName = document.getElementById('graphName').value || 'graph';

    if (saveGraphFile) {
      saveGraphFileToDisk(graphName);
      isGraphModified = false; // Only clear the modified flag if saving as JSON
    }

    if (saveImageFile) {
      saveGraphAsImage(graphName);
    }

    if (savePdfFile) {
      saveGraphAsPdf(graphName);
    }

    hideSaveGraphModal();
  }

  function saveGraphFileToDisk(graphName) {
    const graphData = {
      metadata: {
        application: "graph-editor",
        version: "0.1",
        timestamp: new Date().toISOString().split('.')[0] + 'Z',  // Keep UTC for metadata
        name: graphName
      },
      nodes: gData.nodes.map(node => {
        const nodeData = {
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

  function saveGraphAsImage(graphName) {
    // Get the graph container
    const graphContainer = document.getElementById('graph');
    
    // Store and remove the pattern canvases
    const styleOptions = document.getElementById('styleOptions');
    const patternCanvases = Array.from(styleOptions.querySelectorAll('canvas'));
    patternCanvases.forEach(canvas => canvas.remove());
    
    // Use html2canvas to capture the graph
    html2canvas(graphContainer, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      // Restore the pattern canvases
      patternCanvases.forEach(canvas => styleOptions.appendChild(canvas));
      
      // Generate date stamp in local time
      const now = new Date();
      const dateStamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      // Convert canvas to blob
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
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

  function saveGraphAsPdf(graphName) {
    // Get the graph container
    const graphContainer = document.getElementById('graph');
    
    // Store and remove the pattern canvases
    const styleOptions = document.getElementById('styleOptions');
    const patternCanvases = Array.from(styleOptions.querySelectorAll('canvas'));
    patternCanvases.forEach(canvas => canvas.remove());
    
    // Use html2canvas to capture the graph
    html2canvas(graphContainer, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      willReadFrequently: true
    }).then(canvas => {
      // Restore the pattern canvases
      patternCanvases.forEach(canvas => styleOptions.appendChild(canvas));
      
      // Generate date stamp in local time
      const now = new Date();
      const dateStamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      // Create PDF using the global jspdf object
      const { jsPDF } = window.jspdf;
      
      // Calculate dimensions to fit on A4 landscape with some padding
      const a4Width = 297; // A4 width in mm
      const a4Height = 210; // A4 height in mm
      const padding = 10; // padding in mm
      
      // Calculate scale to fit the canvas on A4 while maintaining aspect ratio
      const scale = Math.min(
        (a4Width - padding * 2) / canvas.width,
        (a4Height - padding * 2) / canvas.height
      );
      
      // Calculate dimensions after scaling
      const scaledWidth = canvas.width * scale;
      const scaledHeight = canvas.height * scale;
      
      // Calculate centering offsets
      const xOffset = (a4Width - scaledWidth) / 2;
      const yOffset = (a4Height - scaledHeight) / 2;
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
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

  function loadGraph() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.graph,.json';  // Accept both .graph and .json for backward compatibility
    
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const graphData = JSON.parse(event.target.result);
          processGraphData(graphData);
        } catch (error) {
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
  function processGraphData(graphData) {
    // Validate the loaded data
    if (!graphData.nodes || !graphData.links) {
      throw new Error('Invalid graph data format');
    }

    // Set the graph name if it exists in the metadata
    if (graphData.metadata && graphData.metadata.name) {
      document.getElementById('graphName').value = graphData.metadata.name;
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
    graphData.nodes.forEach(nodeData => {
      gData.nodes.push({
        id: nodeData.id,
        label: nodeData.label,
        color: nodeData.color,
        size: nodeData.size,
        x: nodeData.x,
        y: nodeData.y,
        fx: nodeData.x,  // Fix the node in its loaded position
        fy: nodeData.y,  // Fix the node in its loaded position
        exed: nodeData.exed || false
      });
    });

    // Load links
    graphData.links.forEach(linkData => {
      const sourceNode = gData.nodes.find(n => n.id === linkData.source);
      const targetNode = gData.nodes.find(n => n.id === linkData.target);
      
      if (sourceNode && targetNode) {
        gData.links.push({
          source: sourceNode,
          target: targetNode,
          thickness: linkData.thickness,
          color: linkData.color,
          label: linkData.label,
          dashPattern: linkData.dashPattern
        });
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
      document.getElementById('clearGraphBtn').disabled = false;
      document.getElementById('clearGraphBtn').style.opacity = '1';
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

  function showGraphError(message) {
    const errorDiv = document.getElementById('graphError');
    const messageSpan = document.getElementById('errorMessage');
    messageSpan.textContent = message;
    errorDiv.style.display = 'block';
  }

  function hideGraphError() {
    const errorDiv = document.getElementById('graphError');
    errorDiv.style.display = 'none';
  }

  function showConfirmModal() {
    document.getElementById('confirmModal').style.display = 'flex';
  }

  function hideConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
  }

  function clearGraph() {
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
    document.getElementById('nodeLabel').value = '';
    
    // Reset graph name
    document.getElementById('graphName').value = '';
    
    // Disable Clear button
    document.getElementById('clearGraphBtn').disabled = true;
    document.getElementById('clearGraphBtn').style.opacity = '0.5';
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
  function dismissHelpBanner() {
    const banner = document.getElementById('helpBanner');
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
   * @param {string} pattern - The pattern to draw. Must be one of: 'solid', 'dotted', 'dashed', 'long-dashed', 'dash-dot'
   * @returns {void}
   */
  function drawPattern(canvas, pattern) {
    const ctx = canvas.getContext('2d');
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
   * @param {string} pattern - The pattern to set. Must be one of: 'solid', 'dotted', 'dashed', 'long-dashed', 'dash-dot'
   * @returns {void}
   */
  function setSelectedStyle(pattern) {
    const selectedStyle = document.getElementById('selectedStyle');
    if (!selectedStyle) return;
    
    drawPattern(selectedStyle, pattern);
    selectedStyle.dataset.pattern = pattern;
  }

  /**
   * Initializes a pattern option canvas with click handling.
   * @param {HTMLCanvasElement} canvas - The canvas element to initialize
   * @param {string} pattern - The pattern to draw. Must be one of: 'solid', 'dotted', 'dashed', 'long-dashed', 'dash-dot'
   * @returns {void}
   */
  function initPatternOption(canvas, pattern) {
    drawPattern(canvas, pattern);
    canvas.dataset.pattern = pattern;
    
    // Handle click on option
    canvas.onclick = function(e) {
      e.stopPropagation();
      setSelectedStyle(pattern);
      document.getElementById('styleOptions').style.display = 'none';
      
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
  function initLinePatternDropdown() {
    // Initialize selected style canvas
    const selectedStyle = document.getElementById('selectedStyle');
    const selectedStyleBtn = document.getElementById('selectedStyleBtn');
    if (selectedStyle && selectedStyleBtn) {
      // Set initial pattern
      setSelectedStyle('solid');
      
      // Handle click on button
      selectedStyleBtn.onclick = function(e) {
        e.stopPropagation();
        const options = document.getElementById('styleOptions');
        
        if (options.style.display === 'none') {
          // Show options first so we can get their dimensions
          options.style.display = 'block';
          
          // Initialize all option canvases
          document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
            initPatternOption(canvas, canvas.dataset.pattern);
          });
        } else {
          options.style.display = 'none';
        }
      };
    }

    // Initialize option canvases
    document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
      initPatternOption(canvas, canvas.dataset.pattern);
    });

    // Handle window resize
    window.addEventListener('resize', function() {
      // Redraw all canvases when window is resized
      setSelectedStyle(getCurrentPattern());
      document.querySelectorAll('#styleOptions canvas').forEach(canvas => {
        initPatternOption(canvas, canvas.dataset.pattern);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const dropdown = document.querySelector('.line-pattern-dropdown');
      if (!dropdown.contains(e.target)) {
        document.getElementById('styleOptions').style.display = 'none';
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