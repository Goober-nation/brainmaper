import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  Controls
} from 'reactflow';
import 'reactflow/dist/style.css'; // <-- CRITICAL: This unfreezes the canvas

import QandANode from '../QandANode';
import JoinerNode from '../JoinerNode';

export default function MiddlePanel({
  nodes, setNodes,
  edges, setEdges,
  setSelectedNode,
  setRfInstance,
  lastActivePos
}) {

  // 1. Register your custom node designs
  const nodeTypes = useMemo(() => ({
    q_and_a: QandANode,
    core: QandANode,
    joiner: JoinerNode
  }), []);

  // 2. Map Movement Handlers (Allows dragging nodes)
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  // 3. Optional: Allow users to draw lines between nodes
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // 4. Save the new position to the database when the user lets go of the mouse
  const onNodeDragStop = (_, node) => {
    if (node.data && node.data.onUpdateState) {
      // The updateNodeState function in App.jsx will automatically read the new X/Y
      node.data.onUpdateState(node.id, {}); 
    }
  };

  // 5. Track which node is selected for the Right Panel chat
  const onNodeClick = (_, node) => {
    setSelectedNode(node);
    if (lastActivePos) {
      lastActivePos.current = { 
        x: node.position.x, 
        y: node.position.y, 
        height: node.style?.height || 200 
      };
    }
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  return (
    <div style={{ flexGrow: 1, height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={setRfInstance}
        fitView
      >
        <Background color="var(--border-color)" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}