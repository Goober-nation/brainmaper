import React, { useState, useEffect, useRef } from 'react';
import LeftPanel from './components/panels/LeftPanel';
import MiddlePanel from './components/panels/MiddlePanel';
import RightPanel from './components/panels/RightPanel';
import { useMapStore } from './store/useMapStore';
import './App.css';

export default function App() {
  // UI Layout State (Kept local as it doesn't affect data)
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [middleWidth, setMiddleWidth] = useState(400); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Store hooks
  const { placingMode, setPlacingMode, refreshMapList, switchMap } = useMapStore();

  useEffect(() => {
    refreshMapList();
    const savedId = localStorage.getItem('current_brainmap_id');
    if (savedId) { 
      switchMap(savedId); 
    } else { 
      // We can't call createNewMap directly here without a title, 
      // but we'll let the store handle the initial state.
    }
  }, []);

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
      />

      <MiddlePanel 
        middleWidth={middleWidth} setMiddleWidth={setMiddleWidth} isLeftOpen={isLeftOpen}
      />

      <RightPanel 
        isLeftOpen={isLeftOpen}
      />
    </div>
  );
}
