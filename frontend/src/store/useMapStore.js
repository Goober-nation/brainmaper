import { create } from 'zustand';

export const API_BASE = '/api';

export const useMapStore = create((set, get) => ({
  // --- State ---
  mapId: null,
  mapList: [],
  nodes: [],
  edges: [],
  selectedNode: null,
  placingMode: null,
  rfInstance: null,

  // --- Basic Setters ---
  setMapId: (id) => set({ mapId: id }),
  setMapList: (list) => set({ mapList: list }),
  setNodes: (nodes) => set((state) => ({ 
    nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes 
  })),
  setEdges: (edges) => set((state) => ({ 
    edges: typeof edges === 'function' ? edges(state.edges) : edges 
  })),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setPlacingMode: (mode) => set({ placingMode: mode }),
  setRfInstance: (instance) => set({ rfInstance: instance }),

  // --- API Actions ---
  refreshMapList: async () => {
    try {
      const res = await fetch(`${API_BASE}/maps`);
      const data = await res.json();
      set({ mapList: data || [] });
    } catch (e) { console.error("Failed to refresh map list", e); }
  },

  createNewMap: async (title = "New Subject", material = "") => {
    try {
      const res = await fetch(`${API_BASE}/maps`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ title, core_material: material }) 
      });
      const data = await res.json();
      get().switchMap(data.map_id);
    } catch (e) { console.error("Failed to create map", e); }
  },

  switchMap: async (id) => {
    localStorage.setItem('current_brainmap_id', id);
    set({ mapId: id, selectedNode: null, placingMode: null });
    await get().loadMap(id);
    await get().refreshMapList();
  },

  loadMap: async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/maps/${id}`);
      const data = await res.json();
      
       const canvasNodes = (data.nodes || []).map(n => ({
           id: n.id, type: n.type, position: { x: n.pos_x, y: n.pos_y },
           style: { width: n.width || 350, height: n.is_collapsed ? 'auto' : (n.height > 0 ? n.height : 200) },
           data: { 
             question: n.data.question, answer: n.data.answer, media_base64: n.data.media_base64, 
             media_name: n.data.media_name, is_collapsed: n.is_collapsed
           }
         }));
        
      set({ nodes: canvasNodes, edges: data.edges || [] });
    } catch (e) { console.error("Failed to load map", e); }
  },

  updateNodeState: async (id, stateUpdates) => {
    const { mapId, nodes } = get();
    if (!mapId) return;

    try {
      const node = nodes.find(n => n.id === id);
      if (!node) return;

      const payload = {
        x: node.position.x, y: node.position.y,
        width: stateUpdates.width || node.style?.width || 300,
        height: stateUpdates.height || node.style?.height || 'auto',
        is_collapsed: stateUpdates.is_collapsed !== undefined ? stateUpdates.is_collapsed : node.data.is_collapsed
      };

      await fetch(`${API_BASE}/maps/${mapId}/nodes/${id}/state`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      
      set({
        nodes: nodes.map(n => {
          if (n.id === id) {
            return {
              ...n, style: { ...n.style, width: payload.width, height: payload.is_collapsed ? 'auto' : payload.height },
              data: { ...n.data, is_collapsed: payload.is_collapsed }
            };
          }
          return n;
        })
      });
    } catch (e) { console.error("Failed to update node state", e); }
  },
}));
