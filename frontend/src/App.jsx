import React, { useState, useEffect, useRef } from 'react';
import LeftPanel from './components/panels/LeftPanel';
import MiddlePanel from './components/panels/MiddlePanel';
import RightPanel from './components/panels/RightPanel';
import './App.css';

export const API_BASE = '/api'; //


export default function App() {
  // Global Data State
  const [mapId, setMapId] = useState(null);
  const [mapList, setMapList] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // Cross-Panel Interaction State
  const [selectedNode, setSelectedNode] = useState(null);
  const [placingMode, setPlacingMode] = useState(null); 
  const [rfInstance, setRfInstance] = useState(null);
  const lastActivePos = useRef({ x: 250, y: 250, height: 200 });

  // Layout State
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [middleWidth, setMiddleWidth] = useState(400); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    refreshMapList();
    const savedId = localStorage.getItem('current_brainmap_id');
    if (savedId) { setMapId(savedId); loadMap(savedId); } 
    else { createNewMap("New Workspace", ""); }
  }, []);

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
    setSelectedNode(null); setPlacingMode(null);
    loadMap(id); refreshMapList();
  };

  const loadMap = async (id) => {
    if (!id) return;
    const res = await fetch(`${API_BASE}/maps/${id}`);
    const data = await res.json();
    
    const canvasNodes = (data.nodes || []).map(n => ({
        id: n.id, type: n.type, position: { x: n.pos_x, y: n.pos_y },
        style: { width: n.width || 350, height: n.is_collapsed ? 'auto' : (n.height || 'auto') },
        data: { 
          question: n.data.question, answer: n.data.answer, media_base64: n.data.media_base64, 
          media_name: n.data.media_name, is_collapsed: n.is_collapsed, onUpdateState: updateNodeState
        }
      }));
      
    setNodes(canvasNodes);
    setEdges(data.edges || []);
  };

  const updateNodeState = async (id, stateUpdates) => {
    try {
      const node = nodes.find(n => n.id === id);
      const payload = {
        x: node.position.x, y: node.position.y,
        width: stateUpdates.width || node.style?.width || 300,
        height: stateUpdates.height || node.style?.height || 'auto',
        is_collapsed: stateUpdates.is_collapsed !== undefined ? stateUpdates.is_collapsed : node.data.is_collapsed
      };

      await fetch(`${API_BASE}/maps/${mapId}/nodes/${id}/state`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      
      setNodes(nds => nds.map(n => {
        if (n.id === id) {
          return {
            ...n, style: { ...n.style, width: payload.width, height: payload.is_collapsed ? 'auto' : payload.height },
            data: { ...n.data, is_collapsed: payload.is_collapsed }
          };
        }
        return n;
      }));
    } catch (e) { console.error("Failed to update node state", e); }
  };

  const handlePointerMove = (e) => { if (placingMode) setMousePos({ x: e.clientX, y: e.clientY }); };

  return (
    <div className="app-container" onPointerMove={handlePointerMove}>
      {/* Follow-cursor tooltip for placing nodes/joiners */}
      {placingMode && (
        <div style={{ position: 'absolute', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 9999, background: 'var(--text-muted)', color: 'white', padding: '8px 12px', borderRadius: '20px', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontSize: '0.85rem' }}>
          Click map to place joiner...
        </div>
      )}

      <LeftPanel 
        isLeftOpen={isLeftOpen} setIsLeftOpen={setIsLeftOpen}
        mapList={mapList} mapId={mapId} 
        switchMap={switchMap} createNewMap={createNewMap} 
        refreshMapList={refreshMapList} setNodes={setNodes} setEdges={setEdges} setMapId={setMapId}
      />

      <MiddlePanel 
        mapId={mapId} middleWidth={middleWidth} setMiddleWidth={setMiddleWidth} isLeftOpen={isLeftOpen}
        selectedNode={selectedNode} setSelectedNode={setSelectedNode}
        nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges}
        rfInstance={rfInstance} setRfInstance={setRfInstance}
        lastActivePos={lastActivePos} loadMap={loadMap}
      />

      <RightPanel 
        mapId={mapId} nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges}
        selectedNode={selectedNode} setSelectedNode={setSelectedNode}
        placingMode={placingMode} setPlacingMode={setPlacingMode}
        rfInstance={rfInstance} setRfInstance={setRfInstance}
        lastActivePos={lastActivePos} updateNodeState={updateNodeState} loadMap={loadMap}
      />
    </div>
  );
}
