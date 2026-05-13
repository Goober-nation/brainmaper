import React, { useState } from 'react';
import { useMapStore, API_BASE } from '../../store/useMapStore';

export default function LeftPanel({ isLeftOpen, setIsLeftOpen }) {
  const [menuOpen, setMenuOpen] = useState(null);
  
  const { 
    mapList, mapId, switchMap, createNewMap, refreshMapList, setMapId, setNodes, setEdges 
  } = useMapStore();

  const deleteMap = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this entire map?")) return;
    await fetch(`${API_BASE}/maps/${id}`, { method: 'DELETE' });
    setMenuOpen(null);
    if (mapId === id) {
      localStorage.removeItem('current_brainmap_id');
      setMapId(null); setNodes([]); setEdges([]);
    }
    refreshMapList();
  };

  return (
    <div style={{ width: isLeftOpen ? '240px' : '50px', background: 'var(--node-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease-in-out' }} onClick={() => setMenuOpen(null)}>
      <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: isLeftOpen ? 'space-between' : 'center', alignItems: 'center' }}>
        {isLeftOpen && <h4 style={{ margin: 0 }}>Workspaces</h4>}
        <button onClick={() => setIsLeftOpen(!isLeftOpen)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.2rem' }}>
            {isLeftOpen ? '◀' : '▶'}
        </button>
      </div>
      
      {isLeftOpen && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {mapList.map(m => (
              <div key={m.id} onClick={() => switchMap(m.id)} style={{ padding: '10px', cursor: 'pointer', background: mapId === m.id ? 'rgba(14, 165, 233, 0.2)' : 'transparent', border: `1px solid ${mapId === m.id ? 'var(--accent-blue)' : 'transparent'}`, borderRadius: '6px', marginBottom: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                <div style={{ position: 'relative' }}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>⋮</button>
                  {menuOpen === m.id && (
                    <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'var(--node-bg)', border: '1px solid var(--border-color)', borderRadius: '4px', zIndex: 100 }}>
                      <button onClick={(e) => deleteMap(e, m.id)} style={{ padding: '10px', border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '15px', borderTop: '1px solid var(--border-color)' }}>
            <button onClick={() => { const t = prompt("Map Name?"); if(t) createNewMap(t); }} style={{ width: '100%', padding: '10px', background: 'var(--success)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ New Map</button>
          </div>
        </>
      )}
    </div>
  );
}
