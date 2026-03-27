import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:8080/api';

export default function App() {
  const [mapId, setMapId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [question, setQuestion] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);

  // 1. Quick Bootstrapper: Create a map on first load if none exists
  useEffect(() => {
    const initMap = async () => {
      const res = await fetch(`${API_BASE}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Docker Basics",
          core_material: "Docker is a platform designed to help developers build, share, and run modern applications. We handle the tedious setup, so you can focus on the code."
        })
      });
      const data = await res.json();
      setMapId(data.map_id);
      loadMap(data.map_id);
    };
    initMap();
  }, []);

  // 2. Fetch Graph Data
  const loadMap = async (id) => {
    const res = await fetch(`${API_BASE}/maps/${id}`);
    const data = await res.json();
    
    // Add layout coordinates so they don't stack on top of each other
    const layoutNodes = (data.nodes || []).map((n, i) => ({
      ...n,
      position: { x: 250, y: i * 150 }, // Simple vertical cascade for now
      style: { padding: 10, border: '1px solid #333', borderRadius: 5, background: '#fff', color: '#000', width: 250 }
    }));
    
    setNodes(layoutNodes);
    setEdges(data.edges || []);
  };

  // 3. Ask a Question
  const handleAsk = async () => {
    if (!selectedNode || !question) return;
    
    await fetch(`${API_BASE}/nodes/${selectedNode.id}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    
    setQuestion("");
    loadMap(mapId); // Refresh the graph
  };

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onNodeClick = (event, node) => setSelectedNode(node);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', margin: 0, padding: 0 }}>
      {/* Sidebar for questioning */}
      <div style={{ width: '300px', padding: '20px', background: '#f4f4f4', borderRight: '1px solid #ccc', color: '#333' }}>
        <h3 style={{ marginTop: 0 }}>Brainmap Controls</h3>
        <p style={{ fontSize: '0.9em', color: '#666' }}>Selected Node: {selectedNode ? selectedNode.id.slice(0, 8) : 'None'}</p>
        
        <textarea 
          rows={5} 
          style={{ width: '100%', marginBottom: '10px', padding: '8px', boxSizing: 'border-box' }}
          placeholder="Ask a question about this node..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!selectedNode}
        />
        <button 
          onClick={handleAsk} 
          disabled={!selectedNode} 
          style={{ width: '100%', padding: '10px', cursor: selectedNode ? 'pointer' : 'not-allowed' }}
        >
          Ask AI
        </button>
      </div>

      {/* React Flow Canvas */}
      <div style={{ flex: 1, background: '#fff' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
