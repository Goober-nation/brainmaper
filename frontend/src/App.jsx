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

  // 1. PERSISTENCE LOGIC: Load existing or create new
  useEffect(() => {
    const initOrLoadMap = async () => {
      const savedMapId = localStorage.getItem('current_brainmap_id');

      if (savedMapId) {
        setMapId(savedMapId);
        loadMap(savedMapId);
      } else {
        createNewMap();
      }
    };
    initOrLoadMap();
  }, []);

  const createNewMap = async () => {
    try {
      const res = await fetch(`${API_BASE}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Docker Basics",
          core_material: "Docker uses containers to wrap software in a complete filesystem..."
        })
      });
      const data = await res.json();
      localStorage.setItem('current_brainmap_id', data.map_id);
      setMapId(data.map_id);
      loadMap(data.map_id);
    } catch (err) {
      console.error("Failed to create new map:", err);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("This will permanently hide the current map and start a new one. Continue?")) {
      localStorage.removeItem('current_brainmap_id');
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      createNewMap();
    }
  };

  // 2. DATA FETCHING
  const loadMap = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/maps/${id}`);
      const data = await res.json();
      
    const layoutNodes = (data.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.pos_x || 250, y: n.pos_y || 250 }, 
      data: n.data,
      style: { 
        padding: '15px', 
        border: '2px solid #333', 
        borderRadius: '8px', 
        background: '#fff', 
        color: '#000',
        width: 'auto',        // Let it grow horizontally to maxWidth
        height: 'auto',       // ALLOW VERTICAL EXPANSION
        minWidth: '200px',
        maxWidth: '500px',    
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap', // Preserves the AI's formatting and line breaks
        fontSize: '14px',
        textAlign: 'center'
      }
    }));
      
      setNodes(layoutNodes);
      setEdges(data.edges || []);
    } catch (err) {
      console.error("Load map error:", err);
    }
  };

  // 3. PERSISTENCE: Save position
  const onNodeDragStop = useCallback(async (event, node) => {
    try {
      await fetch(`${API_BASE}/nodes/${node.id}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: node.position.x, y: node.position.y })
      });
    } catch (err) {
      console.error("Position sync failed:", err);
    }
  }, []);

  // 4. EDGE LOGIC
  const onConnect = useCallback(async (params) => {
    await fetch(`${API_BASE}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_node_id: params.source, target_node_id: params.target })
    });
    setEdges((eds) => addEdge(params, eds));
  }, []);

  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) {
      await fetch(`${API_BASE}/edges/${edge.id}`, { method: 'DELETE' });
    }
  }, []);

  // 5. NODE ACTIONS
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
        const newNode = await res.json(); // Backend returns the new node object
        setQuestion("");
        
        // Refresh map
        await loadMap(mapId);
        
        // AUTO-SELECT the new node
        setSelectedNode({ id: newNode.id }); 
      }
    } catch (err) {
      console.error("AI Request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode || !window.confirm("Delete this node?")) return;
    try {
      const res = await fetch(`${API_BASE}/nodes/${selectedNode.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedNode(null);
        loadMap(mapId);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onNodeClick = (event, node) => setSelectedNode(node);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', margin: 0 }}>
      {/* SIDEBAR */}
      <div style={{ 
        width: '320px', padding: '20px', background: '#f8f9fa', 
        borderRight: '1px solid #dee2e6', zIndex: 10, display: 'flex', flexDirection: 'column'
      }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Brainmap AI</h2>
        <button 
          onClick={handleClearAll}
          style={{ 
            background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', 
            fontSize: '0.8rem', textAlign: 'left', padding: 0, marginBottom: '20px', textDecoration: 'underline'
          }}
        >
          Start New Map
        </button>
        
        <div style={{ marginBottom: '15px', fontSize: '0.85rem', color: '#6c757d' }}>
          Selected: <code style={{ background: '#e9ecef', padding: '2px 4px' }}>
            {selectedNode ? selectedNode.id.slice(0, 8) : 'None'}
          </code>
        </div>
        
        <textarea 
          rows={6} 
          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', marginBottom: '10px' }}
          placeholder="Ask a question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        
        <button 
          onClick={handleAsk} 
          disabled={!selectedNode || loading} 
          style={{ 
            width: '100%', padding: '12px', background: selectedNode ? '#007bff' : '#6c757d',
            color: 'white', border: 'none', borderRadius: '4px', cursor: selectedNode ? 'pointer' : 'not-allowed',
            fontWeight: 'bold', marginBottom: '10px'
          }}
        >
          {loading ? "Thinking..." : "Ask AI"}
        </button>

        <button 
          onClick={handleDeleteNode}
          disabled={!selectedNode}
          style={{ 
            width: '100%', padding: '10px', background: 'none', 
            color: selectedNode ? '#dc3545' : '#adb5bd', border: `1px solid ${selectedNode ? '#dc3545' : '#adb5bd'}`,
            borderRadius: '4px', cursor: selectedNode ? 'pointer' : 'not-allowed', fontSize: '0.85rem'
          }}
        >
          Delete Selected Node
        </button>

        <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: '#adb5bd' }}>
          • Drag dots to connect manually<br/>
          • Select edge + Delete key to remove
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow 
          nodes={nodes} edges={edges} 
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick}
          fitView
        >
          <Background color="#ccc" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}