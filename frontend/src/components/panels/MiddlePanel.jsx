import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMapStore, API_BASE } from '../../store/useMapStore';

export default function MiddlePanel({ middleWidth, setMiddleWidth, isLeftOpen }) {
  const [question, setQuestion] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null); 
  const [selectedMediaName, setSelectedMediaName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef(null);
  const chatScrollRef = useRef(null);

  const { 
    mapId, selectedNode, setSelectedNode, nodes, setNodes, edges, setEdges, 
    rfInstance, loadMap 
  } = useMapStore();

  const startResize = useCallback((e) => {
    e.preventDefault();
    const handleMouseMove = (mouseEvent) => {
      const leftWidth = isLeftOpen ? 240 : 50;
      const newWidth = mouseEvent.clientX - leftWidth;
      if (newWidth > 250 && newWidth < window.innerWidth * 0.6) setMiddleWidth(newWidth);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isLeftOpen, setMiddleWidth]);

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
    setSelectedMedia(null); setSelectedMediaName("");
    if (document.getElementById('file-upload')) document.getElementById('file-upload').value = '';
  };

  const handleInput = (e) => {
    setQuestion(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`; 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && (question.trim() || selectedMedia)) submitChat();
    }
  };

  const submitChat = async () => {
    if (!question.trim() && !selectedMedia) return;
    setLoading(true);

    const cachedQuestion = question;
    const cachedMedia = selectedMedia;
    const cachedMediaName = selectedMediaName;

    let targetX = 0; let targetY = 0;

    if (selectedNode) {
      const sn = nodes.find(n => n.id === selectedNode.id);
      if (sn) {
        targetX = sn.position.x;
        const currentHeight = sn.style.height === 'auto' ? 200 : (sn.style.height || 200);
        targetY = sn.position.y + currentHeight + 80;
      }
    } else {
      const leftPanelW = isLeftOpen ? 240 : 50;
      const mapWidthOffset = leftPanelW + middleWidth;
      const center = rfInstance.screenToFlowPosition({ 
        x: mapWidthOffset + (window.innerWidth - mapWidthOffset) / 2, 
        y: window.innerHeight / 2 
      });
      targetX = center.x;
      targetY = center.y;
    }

    const tempId = `temp-${Date.now()}`;
    const tempNode = {
      id: tempId, type: 'q_and_a', position: { x: targetX, y: targetY }, style: { width: 350, height: 'auto' },
      data: { question: cachedQuestion, media_base64: cachedMedia, media_name: cachedMediaName, is_loading: true }
    };
    
    setNodes(nds => [...(Array.isArray(nds) ? nds : []), tempNode]);
    if (selectedNode) setEdges(eds => [...(Array.isArray(eds) ? eds : []), { id: `e-${selectedNode.id}-${tempId}`, source: selectedNode.id, target: tempId }]);
    
    setQuestion(""); clearMedia();
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 100);

    try {
        const payload = { 
          parent_node_id: selectedNode ? selectedNode.id : null, 
          question: cachedQuestion, pos_x: targetX, pos_y: targetY, 
          media_base64: cachedMedia || "", media_name: cachedMediaName || ""
        };
        const res = await fetch(`${API_BASE}/maps/${mapId}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (res.ok) { 
            const newNode = await res.json();
            await loadMap(mapId); 
            setSelectedNode({ id: newNode.id }); 
            setNodes(nds => nds.map(n => ({ ...n, selected: n.id === newNode.id })));
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  if (!mapId) return null;

  return (
    <>
      <div style={{ width: `${middleWidth}px`, background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--node-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>{selectedNode ? 'Focus: Node Interaction' : 'Global Workspace Chat'}</span>
            {selectedNode && <button onClick={() => { setSelectedNode(null); setNodes(nds => nds.map(n => ({ ...n, selected: false }))); }} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.7rem'}}>Clear Context</button>}
        </div>

        <div ref={chatScrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {selectedNode ? (
                <>
                    {selectedNode.data?.question && <div className="chat-bubble user"><strong>Q:</strong> {selectedNode.data.question}</div>}
                    {selectedNode.data?.answer && (
                      <div className="chat-bubble ai">
                          <ReactMarkdown
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                return !inline && match ? (
                                  <div className="code-block-wrapper">
                                    <button className="copy-btn" onClick={() => navigator.clipboard.writeText(codeString)}>Copy</button>
                                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{codeString}</SyntaxHighlighter>
                                  </div>
                                ) : ( <code className={className} {...props}>{children}</code> );
                              }
                            }}
                          >{selectedNode.data.answer}</ReactMarkdown>
                      </div>
                    )}
                </>
            ) : (
                <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                    Select a node to view its context,<br/>or send a message to drop a new standalone thought.
                </div>
            )}
        </div>

        <div style={{ padding: '15px', background: 'var(--node-bg)', borderTop: '1px solid var(--border-color)' }}>
            {selectedMedia && (
              <div style={{ position: 'relative', marginBottom: '10px', display: 'inline-block' }}>
                  {selectedMedia.startsWith('data:image') ? (
                      <img src={selectedMedia} alt="Preview" style={{ height: '60px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                  ) : (
                      <div style={{ padding: '10px 15px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}>📄 {selectedMediaName}</div>
                  )}
                  <button onClick={clearMedia} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', width: '20px', height: '20px', fontSize: '10px' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <textarea 
                    ref={inputRef} rows={1} value={question} onInput={handleInput} onKeyDown={handleKeyDown}
                    placeholder={selectedNode ? "Ask a follow up question..." : "Start a new thought branch..."} 
                    style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-main)', resize: 'none', overflowY: 'auto', boxSizing: 'border-box' }} 
                />
                <label htmlFor="file-upload" style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>📎</label>
                <input type="file" id="file-upload" accept="image/*, application/pdf" onChange={handleMediaUpload} style={{ display: 'none' }} />
              </div>
              <button 
                onClick={submitChat} disabled={loading || (!question.trim() && !selectedMedia)} 
                style={{ padding: '12px 20px', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: (question.trim() || selectedMedia) && !loading ? 'pointer' : 'not-allowed', fontWeight: 'bold', height: '42px' }}
              >
                {loading ? '...' : 'Send'}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '5px' }}>Shift + Enter for newline</div>
        </div>
      </div>
      <div className="resizer-handle" onMouseDown={startResize}></div>
    </>
  );
}
