import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:8080/api';

export default function App() {
  const [mapId, setMapId] = useState(null);
  const [mapList, setMapList] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [unplacedNodes, setUnplacedNodes] = useState([]);
  
  const [question, setQuestion] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Placement State
  const [rfInstance, setRfInstance] = useState(null);
  const [placingMode, setPlacingMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    refreshMapList();
    const savedId = localStorage.getItem('current_brainmap_id');
    if (savedId) {
      setMapId(savedId);
      loadMap(savedId);
    } else {
      // Create empty map instead of forcing a core node
      createNewMap("New Workspace", "");
    }
  }, []);

  const refreshMapList = async () => {
    try {
      const res = await fetch(`${API_BASE}/maps`);
      const data = await res.json();
      setMapList(data || []);
    } catch (e) { console.error("Map list failed", e); }
  };

  const createNewMap = async (title = "New Subject", material = "") => {
    try {
      const res = await fetch(`${API_BASE}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, core_material: material })
      });
      const data = await res.json();
      switchMap(data.map_id);
    } catch (e) { console.error(e); }
  };

  const switchMap = (id) => {
    localStorage.setItem('current_brainmap_id', id);
    setMapId(id);
    setSelectedNode(null);
    setPlacingMode(false);
    loadMap(id);
    refreshMapList();
  };

  const loadMap = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/maps/${id}`);
      const data = await res.json();
      
      const allNodes = data.nodes || [];
      
      // Separate canvas nodes from unplaced nodes
      const canvasNodes = allNodes
        .filter(n => !n.is_unplaced)
        .map(n => ({
          id: n.id, type: n.type, position: { x: n.pos_x || 250, y: n.pos_y || 250 },
          data: n.data,
          style: { padding: '15px', border: '2px solid #333', borderRadius: '8px', background: '#fff', color: '#000', width: 'auto', minWidth: '180px', maxWidth: '450px', height: 'auto', whiteSpace: 'pre-wrap', fontSize: '14px' }
        }));
        
      setNodes(canvasNodes);
      setUnplacedNodes(allNodes.filter(n => n.is_unplaced));
      setEdges(data.edges || []);
    } catch (e) { console.error(e); }
  };

  // --- PLACEMENT LOGIC ---
  const startPlacing = () => {
    if (!question.trim()) return;
    setPlacingMode(true);
  };

  const handlePointerMove = (e) => {
    if (placingMode) setMousePos({ x: e.clientX, y: e.clientY });
  };

  const onPaneClick = useCallback(async (event) => {
    if (!placingMode || !rfInstance) return;
    
    // Calculate exact drop position
    const position = rfInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    setPlacingMode(false);
    await submitQuestion(position.x, position.y, false);
  }, [placingMode, rfInstance, question, selectedNode, mapId]);

  const submitQuestion = async (x, y, isUnplaced) => {
    setLoading(true);
    try {
        const payload = {
            parent_node_id: selectedNode ? selectedNode.id : null,
            question: question,
            pos_x: x,
            pos_y: y,
            is_unplaced: isUnplaced
        };

        const res = await fetch(`${API_BASE}/maps/${mapId}/ask`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (res.ok) { 
            const newNode = await res.json();
            setQuestion(""); 
            await loadMap(mapId); 
            if(!isUnplaced) setSelectedNode({ id: newNode.id }); 
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  // --- EXISTING LOGIC ---
  const onNodeDragStop = useCallback(async (_, node) => {
    await fetch(`${API_BASE}/nodes/${node.id}/position`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: node.position.x, y: node.position.y }) 
    });
  }, []);

  const onConnect = useCallback(async (params) => {
    await fetch(`${API_BASE}/edges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_node_id: params.source, target_node_id: params.target }) });
    setEdges((eds) => addEdge(params, eds));
  }, []);

  const handleDeleteNode = async () => {
    if (!selectedNode || !window.confirm("Delete this node?")) return;
    try {
      const res = await fetch(`${API_BASE}/nodes/${selectedNode.id}`, { method: 'DELETE' });
      if (res.ok) { setSelectedNode(null); loadMap(mapId); }
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }} onPointerMove={handlePointerMove}>
      
      {/* FLOATING PLACEMENT BADGE */}
      {placingMode && (
        <div style={{ position: 'absolute', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 9999, background: 'rgba(0, 123, 255, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '20px', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '0.85rem', fontWeight: 'bold' }}>
          Click canvas to place "{question.substring(0, 15)}..."
        </div>
      )}

      {/* LEFT SIDEBAR: MAPS */}
      <div style={{ width: '200px', background: '#2c3e50', color: 'white', padding: '15px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>Your Maps</h4>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {mapList.map(m => (
            <div key={m.id} onClick={() => switchMap(m.id)} style={{ padding: '8px', cursor: 'pointer', background: mapId === m.id ? '#34495e' : 'transparent', borderRadius: '4px', marginBottom: '5px', fontSize: '0.85rem' }}>
              {m.title}
            </div>
          ))}
        </div>
        <button onClick={() => { const t = prompt("Map Name?"); if(t) createNewMap(t); }} style={{ width: '100%', padding: '10px', background: '#27ae60', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ New Map</button>
      </div>

      {/* CENTER: CANVAS */}
      <div style={{ flex: 1, position: 'relative', cursor: placingMode ? 'crosshair' : 'default' }}>
        <ReactFlow 
            nodes={nodes} edges={edges} 
            onInit={setRfInstance}
            onNodesChange={changes => setNodes((nds) => applyNodeChanges(changes, nds))} onEdgesChange={changes => setEdges((eds) => applyEdgeChanges(changes, eds))} 
            onConnect={onConnect} onNodeDragStop={onNodeDragStop} 
            onNodeClick={(_, n) => { if(!placingMode) setSelectedNode(n); }} 
            onPaneClick={onPaneClick}
            fitView
        >
          <Background color="#ccc" gap={20} /><Controls />
        </ReactFlow>
      </div>

      {/* RIGHT SIDEBAR: CONTROLS & UNPLACED */}
      <div style={{ width: '320px', background: '#f8f9fa', borderLeft: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        
        {/* Top Half: Controls */}
        <div style={{ padding: '20px', borderBottom: '2px solid #dee2e6' }}>
            <h3 style={{ marginTop: 0 }}>Controls</h3>
            <div style={{ marginBottom: '15px', fontSize: '0.85rem', color: '#6c757d' }}>
            Selected: <code style={{ background: '#e9ecef', padding: '2px 4px' }}>{selectedNode ? selectedNode.id.slice(0, 8) : 'None'}</code>
            {selectedNode && <button onClick={() => setSelectedNode(null)} style={{marginLeft: '10px', fontSize: '0.7rem', cursor: 'pointer'}}>Deselect</button>}
            </div>

            <textarea rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask anything..." style={{ width: '100%', marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} />
            
            {!placingMode ? (
                <button onClick={startPlacing} disabled={!question || loading} style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: question ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                    {loading ? "Thinking..." : "Place on Canvas"}
                </button>
            ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => submitQuestion(0, 0, true)} style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Send to Sidebar
                    </button>
                    <button onClick={() => setPlacingMode(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Cancel
                    </button>
                </div>
            )}

            <button onClick={handleDeleteNode} disabled={!selectedNode} style={{ width: '100%', padding: '8px', marginTop: '15px', background: 'transparent', color: selectedNode ? '#dc3545' : '#adb5bd', border: `1px solid ${selectedNode ? '#dc3545' : '#adb5bd'}`, borderRadius: '4px', cursor: selectedNode ? 'pointer' : 'not-allowed', fontSize: '0.8rem' }}>Delete Selected Node</button>
        </div>

        {/* Bottom Half: Unplaced Sidebar */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', background: '#e9ecef' }}>
            <h4 style={{ marginTop: 0, color: '#495057' }}>Unplaced Answers</h4>
            {unplacedNodes.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#6c757d' }}>No floating thoughts yet.</p>
            ) : (
                unplacedNodes.map(n => (
                    <div key={n.id} style={{ background: 'white', padding: '10px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #ccc', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <strong>{n.data.label.split('\n')[0]}</strong>
                        <p style={{ margin: '5px 0 0 0', color: '#555', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.data.label.split('\nA: ')[1]}
                        </p>
                    </div>
                ))
            )}
        </div>

      </div>
    </div>
  );
}