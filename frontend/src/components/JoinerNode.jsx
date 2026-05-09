import React from 'react';
import { Handle, Position } from 'reactflow';

export default function JoinerNode({ selected }) {
  return (
    <div style={{ 
      width: '16px', 
      height: '16px', 
      background: selected ? 'var(--accent-light)' : 'var(--border-color)', 
      borderRadius: '50%', 
      boxShadow: selected ? '0 0 10px rgba(56, 189, 248, 0.5)' : 'none',
      position: 'relative'
    }}>
      {/* Invisible Handles pushed perfectly center to avoid disrupting visual borders */}
      <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none', minWidth: 0, minHeight: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none', minWidth: 0, minHeight: 0, width: 1, height: 1 }} />
    </div>
  );
}