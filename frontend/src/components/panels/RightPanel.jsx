import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
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
    (changes) => setNodes((nds) => applyNodeChanges(changes, Array.isArray(nds) ? nds : [])),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, Array.isArray(eds) ? eds : [])),
    [setEdges]
  );

  // 3. Optional: Allow users to draw lines between nodes
  const onConnect = useCallback(async (params) => {
    const { mapId, loadMap } = useMapStore.getState();
    if (!mapId) return;
    try {
      const res = await fetch('/api/edges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_id: mapId, source_node_id: params.source, target_node_id: params.target })
      });
      if (!res.ok) throw new Error('Could not save connection');
      await loadMap(mapId);
    } catch (err) { console.error(err); }
  }, []);

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
        nodes={Array.isArray(nodes) ? nodes : []}
        edges={Array.isArray(edges) ? edges : []}
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
