import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, Handle, Position } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import 'reactflow/dist/style.css';

const API_BASE = 'http://localhost:8080/api';

// ==========================================
// 🎨 CUSTOM NODES
// ==========================================

const QANode = ({ data, selected }) => {
  const isImage = data.media_base64 && data.media_base64.startsWith('data:image');
  const isPDF = data.media_base64 && data.media_base64.startsWith('data:application/pdf');

  return (
    <div style={{ padding: '15px', border: `2px solid ${selected ? '#007bff' : '#333'}`, borderRadius: '8px', background: '#fff', color: '#000', width: '300px', boxShadow: selected ? '0 0 10px rgba(0,123,255,0.5)' : '0 2px 5px rgba(0,0,0,0.1)' }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      
      {/* Attached Media Banner */}
      {data.media_base64 && (
        <div style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isImage ? '🖼️ ' : '📄 '} {data.media_name || 'Attached Document'}
          </div>
          {isImage && <img src={data.media_base64} alt="attached" style={{ width: '100%', borderRadius: '4px', maxHeight: '150px', objectFit: 'cover' }} />}
        </div>
      )}

      {/* Question */}
      {data.question && (
        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px', color: '#2c3e50' }}>
          Q: {data.question}
        </div>
      )}

      {(data.question || data.media_base64) && !data.is_loading && <hr style={{ border: 'none', borderTop: '1px solid #e9ecef', margin: '10px 0' }} />}

      {/* Answer with MARKDOWN support */}
      {data.is_loading ? (
        <div style={{ color: '#007bff', fontStyle: 'italic', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="spinner">⏳</span> AI is processing...
        </div>
      ) : (
        <div className="markdown-body" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
          <ReactMarkdown>{data.answer}</ReactMarkdown>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

const JoinerNode = ({ selected }) => (
  <div style={{ width: '24px', height: '24px', background: selected ? '#007bff' : '#6c757d', borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
    <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none' }} />
  </div>
);

// ==========================================
// 🚀 MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [mapId, setMapId] = useState(null);
  const [mapList, setMapList] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [question, setQuestion] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Media State
  const [selectedMedia, setSelectedMedia] = useState(null); 
  const [selectedMediaName, setSelectedMediaName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null); // ID of the map with open menu
  
  const [rfInstance, setRfInstance] = useState(null);
  const [placingMode, setPlacingMode] = useState(null); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const nodeTypes = useMemo(() => ({ q_and_a: QANode, joiner: JoinerNode }), []);

  // Fix screen sliding and initialize
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';

    refreshMapList();
    const savedId = localStorage.getItem('current_brainmap_id');
    if (savedId) { setMapId(savedId); loadMap(savedId); } 
    else { createNewMap("New Workspace", ""); }
  }, []);

  // Update Window Title
  useEffect(() => {
    const currentMap = mapList.find(m => m.id === mapId);
    document.title = currentMap ? `${currentMap.title} - Brainmaper` : 'Brainmaper';
  }, [mapId, mapList]);

  const refreshMapList = async () => {
    try {
      const res = await fetch(`${API_BASE}/maps`);
      const data = await res.json();
      setMapList(data || []);
    } catch (e) { console.error(e); }
  };

  const createNewMap = async (title = "New Subject", material = "") => {
    const res = await fetch(`${API_BASE}/maps`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, core_material: material }) });
    const data = await res.json();
    switchMap(data.map_id);
  };

  const switchMap = (id) => {
    localStorage.setItem('current_brainmap_id', id);
    setMapId(id);
    setSelectedNode(null); setPlacingMode(null); clearMedia(); setQuestion("");
    loadMap(id); refreshMapList();
  };

  const deleteMap = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this entire map?")) return;
    
    await fetch(`${API_BASE}/maps/${id}`, { method: 'DELETE' });
    setMenuOpen(null);
    if (mapId === id) {
      localStorage.removeItem('current_brainmap_id');
      setMapId(null);
      setNodes([]); setEdges([]);
    }
    refreshMapList();
  };

  const loadMap = async (id) => {
    if (!id) return;
    const res = await fetch(`${API_BASE}/maps/${id}`);
    const data = await res.json();
    
    const canvasNodes = (data.nodes || []).map(n => ({
        id: n.id, type: n.type || 'q_and_a', position: { x: n.pos_x, y: n.pos_y },
        data: n.data // Contains question, answer, media_base64, and media_name
      }));
      
    setNodes(canvasNodes);
    setEdges(data.edges || []);
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedMediaName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setSelectedMedia(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const clearMedia = () => {
    setSelectedMedia(null);
    setSelectedMediaName("");
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
  };

  const handlePointerMove = (e) => { if (placingMode) setMousePos({ x: e.clientX, y: e.clientY }); };

  const onPaneClick = useCallback(async (event) => {
    if (!placingMode || !rfInstance) return;
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    const mode = placingMode;
    setPlacingMode(null);

    if (mode === 'qa') { await submitQuestion(position.x, position.y); } 
    else if (mode === 'joiner') { await placeJoiner(position.x, position.y); }
  }, [placingMode, rfInstance, question, selectedNode, mapId, selectedMedia, selectedMediaName]);

  const submitQuestion = async (x, y) => {
    setLoading(true);
    
    // Capturing these variables immediately to prevent state drift
    const cachedQuestion = question || "Analyze document.";
    const cachedMedia = selectedMedia;
    const cachedMediaName = selectedMediaName;

    // Optimistic UI placement
    const tempId = `temp-${Date.now()}`;
    const tempNode = {
      id: tempId, type: 'q_and_a', position: { x, y },
      data: { question: cachedQuestion, media_base64: cachedMedia, media_name: cachedMediaName, is_loading: true }
    };
    setNodes(nds => [...nds, tempNode]);
    
    if (selectedNode) {
      setEdges(eds => [...eds, { id: `e-${selectedNode.id}-${tempId}`, source: selectedNode.id, target: tempId }]);
    }

    try {
        const payload = { 
          parent_node_id: selectedNode ? selectedNode.id : null, 
          question: cachedQuestion, 
          pos_x: x, pos_y: y, 
          media_base64: cachedMedia || "",
          media_name: cachedMediaName || ""
        };
        const res = await fetch(`${API_BASE}/maps/${mapId}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (res.ok) { 
            const newNode = await res.json();
            setQuestion(""); clearMedia(); // Hard clear the inputs
            await loadMap(mapId); 
            setSelectedNode({ id: newNode.id }); 
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const placeJoiner = async (x, y) => {
    const res = await fetch(`${API_BASE}/maps/${mapId}/joiner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pos_x: x, pos_y: y }) });
    if (res.ok) { await loadMap(mapId); }
  };

  // Basic Flow Handlers
  const onNodeDragStop = useCallback(async (_, node) => {
    await fetch(`${API_BASE}/nodes/${node.id}/position`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: node.position.x, y: node.position.y }) });
  }, []);

  const onConnect = useCallback(async (params) => {
    await fetch(`${API_BASE}/edges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_node_id: params.source, target_node_id: params.target }) });
    setEdges((eds) => addEdge(params, eds));
  }, []);

  const handleDeleteNode = async () => {
    if (!selectedNode || !window.confirm("Delete this node?")) return;
    const res = await fetch(`${API_BASE}/nodes/${selectedNode.id}`, { method: 'DELETE' });
    if (res.ok) { setSelectedNode(null); loadMap(mapId); }
  };

  const onEdgesDelete = useCallback(async (deletedEdges) => {
    for (const edge of deletedEdges) { await fetch(`${API_BASE}/edges/${edge.id}`, { method: 'DELETE' }); }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }} onPointerMove={handlePointerMove} onClick={() => setMenuOpen(null)}>
      
      {placingMode && (
        <div style={{ position: 'absolute', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 9999, background: placingMode === 'qa' ? 'rgba(0, 123, 255, 0.9)' : 'rgba(108, 117, 125, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '20px', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '0.85rem', fontWeight: 'bold' }}>
          Click canvas to place {placingMode === 'qa' ? 'node' : 'joiner'}...
        </div>
      )}

      {/* LEFT SIDEBAR */}
      <div style={{ width: '240px', background: '#2c3e50', color: 'white', padding: '15px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>Your Maps</h4>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {mapList.map(m => (
            <div key={m.id} onClick={() => switchMap(m.id)} style={{ padding: '8px', cursor: 'pointer', background: mapId === m.id ? '#34495e' : 'transparent', borderRadius: '4px', marginBottom: '5px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
              
              {/* Map Options Menu */}
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0 5px' }}>⋮</button>
                {menuOpen === m.id && (
                  <div style={{ position: 'absolute', top: '20px', right: '0', background: 'white', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 100 }}>
                    <button onClick={(e) => deleteMap(e, m.id)} style={{ display: 'block', width: '100px', padding: '8px', border: 'none', background: 'transparent', color: '#dc3545', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}>Delete Map</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { const t = prompt("Map Name?"); if(t) createNewMap(t); }} style={{ width: '100%', padding: '10px', background: '#27ae60', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ New Map</button>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, position: 'relative', cursor: placingMode ? 'crosshair' : 'default' }}>
        {mapId ? (
            <ReactFlow 
                nodes={nodes} edges={edges} nodeTypes={nodeTypes}
                onInit={setRfInstance}
                onNodesChange={changes => setNodes((nds) => applyNodeChanges(changes, nds))} 
                onEdgesChange={changes => setEdges((eds) => applyEdgeChanges(changes, eds))} 
                onConnect={onConnect} onEdgesDelete={onEdgesDelete} onNodeDragStop={onNodeDragStop} 
                onNodeClick={(_, n) => { if(!placingMode) setSelectedNode(n); }} 
                onPaneClick={onPaneClick}
                fitView
            >
            <Background color="#ccc" gap={20} /><Controls />
            </ReactFlow>
        ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', background: '#f8f9fa' }}>
                <h2>Select or Create a Map</h2>
            </div>
        )}
      </div>

      {/* RIGHT SIDEBAR (Unplaced Panel Removed) */}
      {mapId && (
        <div style={{ width: '320px', background: '#f8f9fa', borderLeft: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0 }}>Controls</h3>
                
                <div style={{ marginBottom: '15px', fontSize: '0.85rem', color: '#6c757d', display: 'flex', justifyContent: 'space-between' }}>
                <div>Selected: <code style={{ background: '#e9ecef', padding: '2px 4px' }}>{selectedNode ? selectedNode.id.slice(0, 8) : 'None'}</code></div>
                {selectedNode && <button onClick={() => setSelectedNode(null)} style={{fontSize: '0.7rem', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px'}}>Clear Selection</button>}
                </div>

                <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#495057', display: 'block', marginBottom: '8px' }}>Attach Document or Image</label>
                    <input type="file" accept="image/png, image/jpeg, image/webp, application/pdf" onChange={handleMediaUpload} style={{ marginBottom: '10px', fontSize: '0.8rem', width: '100%' }} id="file-upload"/>
                    
                    {selectedMedia && (
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                        {selectedMedia.startsWith('data:image') ? (
                            <img src={selectedMedia} alt="Preview" style={{ width: '100%', borderRadius: '4px', border: '1px solid #ced4da' }} />
                        ) : (
                            <div style={{ padding: '20px', background: '#e9ecef', border: '1px solid #ced4da', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem', color: '#495057', fontWeight: 'bold' }}>
                            📄 {selectedMediaName} Ready
                            </div>
                        )}
                        <button onClick={clearMedia} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(220,53,69,0.9)', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }} title="Remove File">✕</button>
                    </div>
                    )}

                    <textarea rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question..." style={{ width: '100%', marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                    
                    {!placingMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button onClick={() => setPlacingMode('qa')} disabled={(!question && !selectedMedia) || loading} style={{ width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: (question || selectedMedia) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                            {loading ? "Thinking..." : "Ask & Place Node"}
                        </button>
                        <button onClick={() => setPlacingMode('joiner')} style={{ width: '100%', padding: '8px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Place Joiner Point
                        </button>
                        </div>
                    ) : (
                        <button onClick={() => setPlacingMode(null)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Cancel Placement</button>
                    )}
                </div>

                <button onClick={handleDeleteNode} disabled={!selectedNode} style={{ width: '100%', padding: '10px', background: 'transparent', color: selectedNode ? '#dc3545' : '#adb5bd', border: `1px solid ${selectedNode ? '#dc3545' : '#adb5bd'}`, borderRadius: '4px', cursor: selectedNode ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 'bold' }}>Delete Selected Node</button>
            </div>
        </div>
      )}
    </div>
  );
}