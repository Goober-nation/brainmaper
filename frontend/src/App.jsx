import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges,
  addEdge 
} from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:8080/api';

export default function App() {
  const [mapId, setMapId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [question, setQuestion] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Initialize or Fetch the Map
  useEffect(() => {
    const initMap = async () => {
      try {
        const res = await fetch(`${API_BASE}/maps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: "Docker Basics",
            core_material: "Docker is a platform for developers and sysadmins to build, run, and share applications with containers."
          })
        });
        const data = await res.json();
        setMapId(data.map_id);
        loadMap(data.map_id);
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };
    initMap();
  }, []);

  // 2. Load Nodes and Edges from Backend
  const loadMap = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/maps/${id}`);
      const data = await res.json();
      
      const layoutNodes = (data.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        // Use coordinates from DB
        position: { x: n.pos_x || 250, y: n.pos_y || 250 }, 
        data: n.data,
        style: { 
          padding: '15px', 
          border: '2px solid #333', 
          borderRadius: '8px', 
          background: '#fff', 
          color: '#000',
          // DYNAMIC SIZING FIX
          width: 'auto',
          minWidth: '180px',
          maxWidth: '450px',
          height: 'auto',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }
      }));
      
      setNodes(layoutNodes);
      setEdges(data.edges || []);
    } catch (err) {
      console.error("Load map error:", err);
    }
  };

  // 3. PERSISTENCE: Save position when dragging stops
  const onNodeDragStop = useCallback(async (event, node) => {
    try {
      await fetch(`${API_BASE}/nodes/${node.id}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x: node.position.x,
          y: node.position.y
        })
      });
    } catch (err) {
      console.error("Failed to save position:", err);
    }
  }, []);

  // 4. MANUAL CONNECT: Drag edges between nodes
  const onConnect = useCallback(async (params) => {
    try {
      await fetch(`${API_BASE}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_node_id: params.source,
          target_node_id: params.target
        })
      });
      setEdges((eds) => addEdge(params, eds));
    } catch (err) {
      console.error("Connect error:", err);
    }
  }, []);

  // 5. DELETE: Remove edges via keyboard
  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      await fetch(`${API_BASE}/edges/${edge.id}`, { method: 'DELETE' });
    }
  }, []);

  // 6. AI INTERACTION
  const handleAsk = async () => {
    if (!selectedNode || !question) return;
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/nodes/${selectedNode.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      
      if (res.ok) {
        setQuestion("");
        await loadMap(mapId); // Refresh to show new node
      }
    } catch (err) {
      console.error("AI Request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onNodeClick = (event, node) => setSelectedNode(node);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', margin: 0, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '320px', 
        padding: '20px', 
        background: '#f8f9fa', 
        borderRight: '1px solid #dee2e6', 
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Brainmap AI</h2>
        
        <div style={{ marginBottom: '15px', fontSize: '0.85rem', color: '#6c757d' }}>
          Selected Node ID: <br/>
          <code style={{ background: '#e9ecef', padding: '2px 4px' }}>
            {selectedNode ? selectedNode.id.slice(0, 8) : 'None'}
          </code>
        </div>
        
        <textarea 
          rows={6} 
          style={{ 
            width: '100%', 
            padding: '10px', 
            borderRadius: '4px', 
            border: '1px solid #ced4da',
            marginBottom: '10px',
            resize: 'none'
          }}
          placeholder="Ask a question about the selected node..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        
        <button 
          onClick={handleAsk} 
          disabled={!selectedNode || loading} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: selectedNode ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedNode ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          {loading ? "AI is generating..." : "Ask AI"}
        </button>

        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#adb5bd' }}>
          Tip: Drag between dots to connect. <br/>
          Select edge + Delete key to remove.
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#ccc" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}