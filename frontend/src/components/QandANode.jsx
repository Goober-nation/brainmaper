import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMapStore } from '../store/useMapStore';

export default function QandANode({ id, data, selected, style }) {
  const [isCollapsed, setIsCollapsed] = useState(data.is_collapsed || false);
  const updateNodeState = useMapStore(state => state.updateNodeState);
  
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    updateNodeState(id, { is_collapsed: newState });
  };
  
  const copyToClipboard = (text) => navigator.clipboard.writeText(text);
  const isImage = data.media_base64 && data.media_base64.startsWith('data:image');
  
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`} style={{ ...style, height: isCollapsed ? 'auto' : (style?.height || 'auto') }}>
      <NodeResizer 
        color="var(--accent-light)" 
        isVisible={selected && !isCollapsed} 
        minWidth={250} 
        minHeight={100}
        onResizeEnd={(e, params) => {
           updateNodeState(id, { width: params.width, height: params.height, is_collapsed: isCollapsed });
        }}
      />
      
      <Handle type="target" position={Position.Top} />
      
      <div className="node-header">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '10px' }}>
          {data.question || "Core Idea"}
        </span>
        <button onClick={toggleCollapse} className="fold-btn" title="Toggle fold">
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      <div className="node-content">
        {isCollapsed ? (
            <div className="collapsed-text">
                {data.answer.replace(/[#*`_>]/g, '') /* Strip basic markdown for preview */}
            </div>
        ) : (
            <>
                {data.media_base64 && (
                    <div style={{ marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>
                        {isImage ? '🖼️ ' : '📄 '} {data.media_name || 'Attached Document'}
                    </div>
                    {isImage && <img src={data.media_base64} alt="attached" style={{ width: '100%', borderRadius: '4px' }} />}
                    </div>
                )}

                {data.is_loading ? (
                    <div style={{ color: 'var(--accent-light)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⏳ AI is processing...
                    </div>
                ) : (
                    <ReactMarkdown
                    components={{
                        code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        return !inline && match ? (
                            <div className="code-block-wrapper">
                            <button className="copy-btn" onClick={() => copyToClipboard(codeString)}>Copy</button>
                            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                                {codeString}
                            </SyntaxHighlighter>
                            </div>
                        ) : (
                            <code className={className} {...props}>{children}</code>
                        );
                        }
                    }}
                    >
                    {data.answer}
                    </ReactMarkdown>
                )}
            </>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
