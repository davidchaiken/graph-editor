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

  // Add event listeners for modal buttons
  document.getElementById('saveAndClearBtn').addEventListener('click', () => {
    saveGraph();
    clearGraph();
    hideClearConfirmModal();
  });

  document.getElementById('clearWithoutSaveBtn').addEventListener('click', () => {
    clearGraph();
    hideClearConfirmModal();
  });

  document.getElementById('cancelClearBtn').addEventListener('click', hideClearConfirmModal);

  document.getElementById('saveAndLoadBtn').addEventListener('click', () => {
    saveGraph();
    hideLoadConfirmModal();
    loadGraph();
  });

  document.getElementById('loadWithoutSaveBtn').addEventListener('click', () => {
    hideLoadConfirmModal();
    loadGraph();
  });

  document.getElementById('cancelLoadBtn').addEventListener('click', hideLoadConfirmModal);

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
      })
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
        
        ctx.strokeStyle = link.color || '#1f77b4';
        ctx.stroke();
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
        return (link.thickness || 1) * 0.1; // strength is proportional to thickness
      }))
      .d3Force('center', null) // center force is not intuitive when editing
      .d3Force('collision', d3.forceCollide(node => (node.size || 5) + 1))
      .width(window.innerWidth - 250) // Account for sidebar width
      .height(window.innerHeight);

  // Initialize view
  Graph.centerAt(0, 0, 1000);
  Graph.zoom(1.5);

  // Set default color to first palette color
  const defaultColor = document.querySelector('#colorPalette .color-option').dataset.color;
  document.getElementById('colorPicker').value = defaultColor;
  updateColorSelection(defaultColor);

  // Handle window resize
  window.addEventListener('resize', () => {
    Graph
      .width(window.innerWidth - 250)
      .height(window.innerHeight);
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
    saveGraph();
  });
  document.getElementById('loadGraphBtn').addEventListener('click', () => {
    hideGraphError();
    if (isGraphModified) {
      showLoadConfirmModal();
    } else {
      loadGraph();
    }
  });

  document.getElementById('clearGraphBtn').addEventListener('click', () => {
    if (isGraphModified) {
      showClearConfirmModal();
    } else {
      clearGraph();
    }
  });

  // Add keyboard event handler for Delete and Backspace keys
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') &&
        document.activeElement !== document.getElementById('nodeLabel')) {
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
      const uniqueLabel = getUniqueLabel(proposedLabel);

      const newNode = {
        id: nextNodeId++,
        label: uniqueLabel,
        color,
        size,
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

    const uniqueLabel = getUniqueLabel(proposedLabel);

    // Get current viewport dimensions
    const viewportWidth = window.innerWidth - 250; // Account for sidebar
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

    // Mark graph as modified
    isGraphModified = true;

    // Disable Clear button if no nodes remain
    if (gData.nodes.length === 0) {
      document.getElementById('clearGraphBtn').disabled = true;
      document.getElementById('clearGraphBtn').style.opacity = '0.5';
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
          color: document.getElementById('colorPicker').value
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
          handleLinkClick(newLink);
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

  function handleLinkClick(link) {
    selectedLink = link;
    selectedNode = null;
    updateNodePropertiesUI();
    updateLinkPropertiesUI();
    Graph.graphData(gData);
  }

  function updateNodePropertiesUI() {
    const labelInput = document.getElementById('nodeLabel');
    const sizeInput = document.getElementById('nodeSize');
    const deleteBtn = document.getElementById('deleteNodeBtn');

    if (selectedNode) {
      labelInput.value = selectedNode.label || '';
      sizeInput.value = selectedNode.size || 5;
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
    // Create a JSON string from the graph data
    const graphName = document.getElementById('graphName').value || 'graph';
    const graphData = {
      metadata: {
        application: "graph-editor",
        version: "0.1",
        timestamp: new Date().toISOString().split('.')[0] + 'Z', // ISO-8601 without milliseconds, UTC
        name: graphName
      },
      nodes: gData.nodes.map(node => ({
        id: node.id,
        label: node.label,
        color: node.color,
        size: node.size,
        x: node.x,
        y: node.y
      })),
      links: gData.links.map(link => ({
        source: link.source.id,
        target: link.target.id,
        thickness: link.thickness,
        color: link.color
      }))
    };

    const jsonString = JSON.stringify(graphData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link element to trigger the save dialog
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphName}.json`; // Use the graph name
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Reset modification flag after saving
    isGraphModified = false;
  }

  function loadGraph() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const graphData = JSON.parse(event.target.result);
          
          // Validate the loaded data
          if (!graphData.nodes || !graphData.links) {
            showGraphError('Invalid graph data format');
            return;
          }

          // Set the graph name if it exists in the metadata
          if (graphData.metadata && graphData.metadata.name) {
            document.getElementById('graphName').value = graphData.metadata.name;
          } else {
            document.getElementById('graphName').value = ''; // Clear the name if no metadata or no name
          }

          // Check for duplicate node IDs
          const nodeIds = new Set();
          let maxNodeId = 0;
          for (const node of graphData.nodes) {
            if (nodeIds.has(node.id)) {
              showGraphError('Error: Duplicate node ID found in graph');
              return;
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
              fy: nodeData.y   // Fix the node in its loaded position
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
                color: linkData.color
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

          // Reattach event listener to the new node size input
          const sizeInput = document.getElementById('nodeSize');
          sizeInput.addEventListener('input', () => {
            updateNodeSizePreview();
            if (selectedNode) {
              selectedNode.size = parseInt(sizeInput.value);
              Graph.graphData(gData);
            }
          });

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

        } catch (error) {
          showGraphError('Error loading graph: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
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

  function showClearConfirmModal() {
    document.getElementById('clearConfirmModal').style.display = 'flex';
  }

  function hideClearConfirmModal() {
    document.getElementById('clearConfirmModal').style.display = 'none';
  }

  function showLoadConfirmModal() {
    document.getElementById('loadConfirmModal').style.display = 'flex';
  }

  function hideLoadConfirmModal() {
    document.getElementById('loadConfirmModal').style.display = 'none';
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
}); 