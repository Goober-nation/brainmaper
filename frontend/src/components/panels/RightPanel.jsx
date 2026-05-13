import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  Controls
} from 'reactflow';
import 'reactflow/dist/style.css';

import QandANode from '../QandANode';
import JoinerNode from '../JoinerNode';
import { useMapStore } from '../../store/useMapStore';

export default function RightPanel() {
  const { 
    nodes, setNodes, 
    edges, setEdges, 
    setSelectedNode, 
    setRfInstance 
  } = useMapStore();

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
    // Use the store's action directly instead of a function passed in data
    useMapStore.getState().updateNodeState(node.id, {}); 
  };

  // 5. Track which node is selected for the Right Panel chat
  const onNodeClick = (_, node) => {
    setSelectedNode(node);
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
