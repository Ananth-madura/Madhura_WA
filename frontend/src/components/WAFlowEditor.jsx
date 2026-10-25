import WAFlowNodeAdvanced from "./WAFlowNodeAdvanced";
import FlowStarterPicker from "./FlowStarterPicker";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Image, Link, List, Mail, Hash, CalendarDays, Timer, Globe, Database, UserPlus, UserRound, Flag, Braces, ArrowLeft, Plus, Search, X, Undo2, Redo2, Save, Play, GitBranch, CheckCircle2, AlertCircle, ZoomIn, ZoomOut, Maximize2, MousePointer2, Hand, Copy, Trash2, Download, Upload, Map as MapIcon, Grid, Settings2, ChevronRight, MessageSquare, FileText, LayoutGrid, PanelRightClose } from "lucide-react";
import { duplicateFlowNodes, flowLabel, flowPorts, parseFlowImport, removeFlowNodes, setFlowPort } from "../utils/waFlowGraph";
import "./WAFlowEditor.css";

const TILE = 80;
const NODE_ICONS = { start: Play, send_message: Send, send_media: Image, send_template: FileText, send_cta: Link, send_buttons: MessageSquare, send_list: List, interactive_menu: List, condition: GitBranch, business_hours: CalendarDays, contact_lookup: Database, ai_intent: GitBranch, delay: Timer, api_webhook: Globe, crm_lookup: Database, create_lead: UserPlus, handoff: UserRound, end: Flag, set_variable: Braces };
const tileHeight = node => Math.max(TILE, flowPorts(node).length * 24 + 16);
const position = node => ({ x: Number(node.position_x) || 0, y: Number(node.position_y) || 0 });
const outputPoint = (node, index) => ({ x: position(node).x + TILE, y: position(node).y + 20 + index * 24 });
const inputPoint = node => ({ x: position(node).x, y: position(node).y + 40 });
const curve = (a, b) => { const bend = Math.max(60, Math.abs(b.x - a.x) * .45); return `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`; };
const textSummary = node => String(node.config?.text || node.config?.prompt_text || node.config?.url || node.config?.note || "").slice(0, 90);

export default function WAFlowEditor({ nodes, categories, selectedKey, onSelect, onInspect, onChange, onTransientChange, onCommit, onAdd, canvasRef, zoom, pan, setZoom, setPan, onFit, onLayout, onUndo, onRedo, canUndo, canRedo, name, setName, dirty, saving, loading, onSave, onPublish, onExit, issues, entry, panelRequest, settings, inspector, preview, onStartPreview, logs, notice, onDismissNotice, loadError, onRetry, onTest, flowId, onVersions, metadata, onImportMetadata }) {
  const [panel, setPanel] = useState(()=>flowId?null:"library");
  const [librarySearch, setLibrarySearch] = useState("");
  const [outlineSearch, setOutlineSearch] = useState("");
  const [selection, setSelection] = useState([]);
  const [mode, setMode] = useState("select");
  const [snap, setSnap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [connection, setConnection] = useState(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [edge, setEdge] = useState(null);
  const [rubber, setRubber] = useState(null);
  const [message, setMessage] = useState("");
  const gesture = useRef(null), clipboard = useRef([]), importInput = useRef(null), searchInput = useRef(null), panelRef = useRef(null), worldRef = useRef(null);
  const errors = issues.filter(issue => issue.severity === "error");
  const byKey = useMemo(() => new Map(nodes.map(node => [node.node_key, node])), [nodes]);
  const selectedNode = byKey.get(selectedKey);
  const allTypes = useMemo(() => new Set(categories.flatMap(category => category.items.map(item => ["collect_number", "collect_email", "collect_date"].includes(item.type) ? "collect_input" : item.type))), [categories]);
  useEffect(() => { setSelection(current => current.filter(key => byKey.has(key))); }, [byKey]);
  useEffect(() => { if (edge && (!byKey.has(edge.source.node_key) || !byKey.has(edge.target.node_key))) setEdge(null); if (connection && !byKey.has(connection.source)) setConnection(null); }, [byKey, edge, connection]);
  useEffect(() => { if (panel === "library") searchInput.current?.focus(); }, [panel]);
  useEffect(() => { if (panelRequest) setPanel(panelRequest.panel); }, [panelRequest]);
  useEffect(() => { if (selectedKey && byKey.has(selectedKey)) setSelection(current => current.includes(selectedKey) ? current : [selectedKey]); }, [selectedKey, byKey]);

  const bounds = useMemo(() => {
    const x = nodes.map(node => position(node).x), y = nodes.map(node => position(node).y);
    const minX = Math.min(0, ...x) - 40, minY = Math.min(0, ...y) - 40;
    return { x: minX, y: minY, width: Math.max(500, Math.max(...x, 0) - minX + 240), height: Math.max(350, Math.max(...y, 0) - minY + 240) };
  }, [nodes]);
  const edges = nodes.flatMap(node => flowPorts(node).flatMap((port, index) => byKey.has(port.target) ? [{ source: node, port, index, target: byKey.get(port.target), id: `${node.node_key}:${port.id}` }] : []));
  const worldPoint = event => { const rect = canvasRef.current.getBoundingClientRect(); return { x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom }; };
  const inspect = key => { onInspect(key); setPanel("inspector"); setEdge(null); };
  const focus = key => { const node = byKey.get(key); if (!node) return; onSelect(key); setSelection([key]); const rect = canvasRef.current.getBoundingClientRect(); setPan({ x: rect.width / 2 - (position(node).x + 40) * zoom, y: rect.height / 2 - (position(node).y + 40) * zoom }); inspect(key); };
  const changeTarget = (sourceKey, port, target) => { onChange(nodes.map(node => node.node_key === sourceKey ? setFlowPort(node, port, target) : node)); setConnection(null); };
  const deleteSelection = () => { const keys = new Set(selection.filter(key => key !== entry && key !== "start")); if (!keys.size) { setMessage("The entry step is preserved. Select another step to remove it."); return; } onChange(removeFlowNodes(nodes, keys)); setSelection([]); onSelect(null); };
  const duplicate = () => { const copies = duplicateFlowNodes(nodes, nodes.filter(node => selection.includes(node.node_key) && node.node_key !== entry && node.node_key !== "start")); if (!copies.length) return; onChange([...nodes, ...copies]); setSelection(copies.map(node => node.node_key)); onSelect(copies[0].node_key); };
  const capture = event => canvasRef.current.setPointerCapture(event.pointerId);
  const beginNode = (event, node) => {
    if (event.button !== 0 || event.target.closest("button:not(.fe-node-open)")) return;
    event.stopPropagation();
    if (connection) { if (connection.source !== node.node_key) changeTarget(connection.source, connection.port, node.node_key); return; }
    const keys = event.shiftKey ? selection.includes(node.node_key) ? selection.filter(key => key !== node.node_key) : [...selection, node.node_key] : selection.includes(node.node_key) ? selection : [node.node_key];
    setSelection(keys); onSelect(node.node_key);
    gesture.current = { kind: "node", start: worldPoint(event), before: nodes, keys, key: node.node_key, moved: false };
    capture(event);
  };
  const beginCanvas = event => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target.closest("button, .fe-node, .fe-edge-editor, .fe-minimap, .fe-canvas-tools, .fe-connection-hint")) return;
    canvasRef.current.focus();
    setEdge(null);
    if (connection) { setConnection(null); return; }
    const p = worldPoint(event);
    if (mode === "pan" || event.button === 1 || event.altKey) gesture.current = { kind: "pan", screen: { x: event.clientX, y: event.clientY }, before: pan };
    else { gesture.current = { kind: "box", start: p, additive: event.shiftKey, keys: selection }; setRubber({ x: p.x, y: p.y, width: 0, height: 0 }); }
    capture(event);
  };
  const move = event => {
    const p = worldPoint(event); setPointer(p);
    const current = gesture.current; if (!current) return;
    if (current.kind === "pan") { setPan({ x: current.before.x + event.clientX - current.screen.x, y: current.before.y + event.clientY - current.screen.y }); return; }
    const dx = p.x - current.start.x, dy = p.y - current.start.y;
    if (current.kind === "node") {
      if (!current.moved && Math.hypot(dx, dy) < 3 / zoom) return;
      current.moved = true;
      const shiftX = snap ? Math.round(dx / 20) * 20 : dx, shiftY = snap ? Math.round(dy / 20) * 20 : dy;
      onTransientChange(current.before.map(node => current.keys.includes(node.node_key) ? { ...node, position_x: position(node).x + shiftX, position_y: position(node).y + shiftY } : node));
    } else {
      const box = { x: Math.min(p.x, current.start.x), y: Math.min(p.y, current.start.y), width: Math.abs(dx), height: Math.abs(dy) };
      setRubber(box);
      const inside = nodes.filter(node => position(node).x + TILE >= box.x && position(node).x <= box.x + box.width && position(node).y + tileHeight(node) >= box.y && position(node).y <= box.y + box.height).map(node => node.node_key);
      setSelection([...new Set([...(current.additive ? current.keys : []), ...inside])]);
    }
  };
  const end = event => {
    const current = gesture.current;
    if (current?.kind === "node") { if (current.moved) onCommit(current.before); else if (!event.shiftKey) inspect(current.key); }
    if (current?.kind === "box" && rubber?.width < 3 && rubber?.height < 3) { setSelection([]); onSelect(null); }
    gesture.current = null; setRubber(null);
    if (canvasRef.current.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
  };
  const keyDown = event => {
    if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Escape") { setConnection(null); setEdge(null); setPanel(null); return; }
    if (!event.target.closest(".fe-canvas")) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selection.length) { event.preventDefault(); event.stopPropagation(); const amount = event.shiftKey ? 40 : 8; const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0; const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0; onChange(nodes.map(node => selection.includes(node.node_key) ? { ...node, position_x: position(node).x + dx, position_y: position(node).y + dy } : node)); return; }
    if (mod && ["c", "v", "d", "a"].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      if (event.key.toLowerCase() === "a") setSelection(nodes.map(node => node.node_key));
      if (event.key.toLowerCase() === "c") { clipboard.current = nodes.filter(node => selection.includes(node.node_key) && node.node_key !== entry && node.node_key !== "start"); setMessage(`${clipboard.current.length} steps copied within this editor.`); }
      if (event.key.toLowerCase() === "d") duplicate();
      if (event.key.toLowerCase() === "v" && clipboard.current.length) { const copies = duplicateFlowNodes(nodes, clipboard.current); onChange([...nodes, ...copies]); setSelection(copies.map(node => node.node_key)); onSelect(copies[0].node_key); }
    }
    if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (edge) { changeTarget(edge.source.node_key, edge.port, ""); setEdge(null); } else deleteSelection(); }
  };
  const addItem = item => {
    const source = connection && byKey.get(connection.source);
    const rect = canvasRef.current.getBoundingClientRect();
    onAdd(item, { x: source ? position(source).x + 280 : (rect.width / 2 - pan.x) / zoom, y: source ? position(source).y : (rect.height / 2 - pan.y) / zoom }, connection);
    setConnection(null); setPanel("inspector");
  };
  const exportGraph = () => {
    const blob = new Blob([JSON.stringify({ format: "madhura-flow", version: 1, name, ...metadata, entry_node_key: entry, nodes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `${(name || "conversation-flow").replace(/[^a-z0-9_-]/gi, "_")}.json`; link.click(); URL.revokeObjectURL(url); setMessage("Flow JSON exported. It contains the step configurations currently on the canvas.");
  };
  const importGraph = async event => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Choose a JSON file smaller than 2 MB.");
      const imported = parseFlowImport(await file.text(), allTypes);
      if (!window.confirm(`Replace this canvas with ${imported.nodes.length} imported steps? You can undo the graph replacement.`)) return;
      onChange(imported.nodes); onImportMetadata(imported); setSelection([]); onSelect(null); setMessage("Flow imported as an unsaved draft. Review settings and checks before publishing."); setTimeout(() => onFit(imported.nodes), 50);
    } catch (error) { setMessage(`Import failed: ${error.message}`); }
  };
  const openPanel = next => { if (next === "preview" && panel !== "preview") onStartPreview(); setPanel(current => current === next ? null : next); setEdge(null); };
  return <div className="fe-editor" onKeyDownCapture={keyDown}>
    <header className="fe-header">
      <button className="fe-icon-button" onClick={onExit} title="Return to flows" aria-label="Return to flows"><ArrowLeft size={19} /></button>
      <div className="fe-document"><span>Conversation flow</span><input aria-label="Flow name" value={name} onChange={event => setName(event.target.value)} placeholder="Untitled conversation" maxLength={150} /></div>
      <span className="fe-save-state" role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : flowId ? "Saved" : "Draft"}</span>
      <div className="fe-header-actions"><button className="fe-icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={17} /></button><button className="fe-icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 size={17} /></button><button className="fe-button fe-secondary" disabled={saving || loading || !!loadError} onClick={onSave}><Save size={15} /><span>Save draft</span></button><button className="fe-button fe-primary" disabled={saving || loading || !!loadError} onClick={onPublish}><Play size={14} />Publish</button></div>
    </header>
    <nav className="fe-toolbar" aria-label="Workflow tools" inert={loading ? true : undefined}>
      <div className="fe-toolbar-group"><button className={panel === "library" ? "is-active" : ""} onClick={() => openPanel("library")}><Plus size={16} />Add step</button><button className={panel === "settings" ? "is-active" : ""} onClick={() => openPanel("settings")}><Settings2 size={15} />Flow settings</button><button className={panel === "outline" ? "is-active" : ""} onClick={() => openPanel("outline")}><GitBranch size={15} />Steps <span>{nodes.length}</span></button></div>
      <div className="fe-toolbar-group fe-toolbar-end"><button className={panel === "checks" ? "is-active" : ""} onClick={() => openPanel("checks")}>{errors.length ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}<span>{errors.length ? `${errors.length} to fix` : "Checks"}</span></button><button onClick={() => openPanel("preview")}><MessageSquare size={15} /><span>Preview</span></button><details className="fe-more"><summary aria-label="More workflow actions">More <ChevronRight size={13} /></summary><div onClick={event => { if (event.target.closest("button")) event.currentTarget.parentElement.removeAttribute("open"); }}><button onClick={exportGraph}><Download size={15} />Export JSON</button><button onClick={() => importInput.current.click()}><Upload size={15} />Import JSON</button><button onClick={onTest}><Play size={15} />Test on phone</button>{flowId && <button onClick={onVersions}><FileText size={15} />Version history</button>}<button onClick={() => openPanel("logs")}><FileText size={15} />Simulation log</button></div></details><input ref={importInput} type="file" accept=".json,application/json" hidden onChange={importGraph} /></div>
    </nav>
    {(notice || message || loadError) && <div className={`fe-notice ${notice?.type === "error" || loadError || message.startsWith("Import failed") ? "is-error" : ""}`} role={notice?.type === "error" || loadError ? "alert" : "status"}><span>{loadError || notice?.message || message}</span>{loadError ? <button onClick={onRetry}>Retry loading</button> : <button aria-label="Dismiss notice" onClick={() => { setMessage(""); onDismissNotice(); }}><X size={16} /></button>}</div>}
    <div className="fe-workspace">
      {loading && <div className="fe-loading-overlay" role="status"><span>Loading conversation?</span><small>Fetching the saved graph and step configurations.</small></div>}
      <div className={`fe-canvas ${mode === "pan" ? "is-panning" : ""}`} ref={canvasRef} tabIndex={0} role="region" aria-label="Flow canvas. Drag to select, Alt drag to pan. Select a step to configure it." onDragOver={event => { if (event.dataTransfer.types.includes("application/x-madhura-step")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDrop={event => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-madhura-step"); const item = categories.flatMap(category => category.items).find(candidate => candidate.type === type); if (item) { onAdd(item, worldPoint(event), connection); setConnection(null); setPanel("inspector"); } }} onPointerDown={beginCanvas} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={event => { if (!event.target.closest(".fe-node, button, .fe-minimap")) openPanel("library"); }} style={{ backgroundSize: `${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}>
        <div className="fe-canvas-caption"><span>{name || "Untitled conversation"}</span><small>{nodes.length} steps · {edges.length} connections</small></div>
        <svg className="fe-wires" aria-label="Workflow connections"><g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>{edges.map(wire => <g key={wire.id} className={`fe-wire ${edge?.id === wire.id ? "is-selected" : ""}`}><path d={curve(outputPoint(wire.source, wire.index), inputPoint(wire.target))} /><path className="fe-wire-hit" d={curve(outputPoint(wire.source, wire.index), inputPoint(wire.target))} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setEdge(wire); setConnection(null); }} aria-label={`${flowLabel(wire.source)} ${wire.port.label} to ${flowLabel(wire.target)}`} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter") setEdge(wire); }} /></g>)}{connection && byKey.has(connection.source) && <path className="fe-wire-pending" d={curve(outputPoint(byKey.get(connection.source), connection.index), pointer)} />}</g></svg>
        <div ref={worldRef} className="fe-world" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
          {nodes.map(node => { const meta = categories.flatMap(category => category.items.map(item => ({ ...item, Icon: category.icon }))).find(item => item.type === node.node_type); const Icon = node.node_type === "collect_input" ? ({ email: Mail, number: Hash, date: CalendarDays }[node.config?.validation_type] || MessageSquare) : (NODE_ICONS[node.node_type] || meta?.Icon || GitBranch); const ports = flowPorts(node); const nodeIssues = issues.filter(issue => issue.nodeKey === node.node_key); return <div className={`fe-node ${selection.includes(node.node_key) ? "is-selected" : ""} ${connection && connection.source !== node.node_key ? "is-target" : ""}`} key={node.node_key} style={{ left: position(node).x, top: position(node).y, "--node-color": ["navy", "green", "blue", "amber"].includes(node.config?._editor?.color) ? `var(--node-${node.config._editor.color})` : "var(--node-navy)" }} onPointerDown={event => beginNode(event, node)}>
            <div className="fe-node-tile" style={{ height: tileHeight(node) }}><button className="fe-node-open" aria-label={`Configure ${flowLabel(node)}`} onPointerDown={event => beginNode(event, node)} onClick={event => { if (event.detail === 0) inspect(node.node_key); }}><Icon size={28} strokeWidth={1.6} /></button>{node.node_key === entry && <span className="fe-entry-mark">Entry</span>}{nodeIssues.length > 0 && <button className="fe-node-issue" aria-label={`${nodeIssues.length} issues for ${flowLabel(node)}`} onClick={() => { onSelect(node.node_key); setPanel("checks"); }}><AlertCircle size={14} /></button>}
              {node.node_key !== entry && <button className="fe-port fe-input-port" aria-label={`Connect to ${flowLabel(node)}`} title="Connect incoming route" onClick={() => { if (connection && connection.source !== node.node_key) changeTarget(connection.source, connection.port, node.node_key); else setMessage("Choose an output port on another step, then select this input."); }} />}
              {ports.map((port, index) => <div className="fe-output" key={port.id} style={{ top: 8 + index * 24 }}><button className={`fe-port ${port.target ? "is-connected" : ""}`} aria-label={`Connect ${port.label} from ${flowLabel(node)}`} title={`${port.label}${port.target ? ` → ${port.target}` : " · Connect or add a step"}`} onClick={() => { setConnection({ source: node.node_key, port, index }); setPointer(outputPoint(node, index)); setEdge(null); }} /><span>{ports.length > 1 ? port.label : ""}</span></div>)}
            </div>
            <button className="fe-node-label" onPointerDown={event => event.stopPropagation()} onClick={() => inspect(node.node_key)}>{flowLabel(node)}</button><span className="fe-node-summary">{textSummary(node) || meta?.label || node.node_type.replaceAll("_", " ")}</span>{typeof node.config?._editor?.note === "string" && node.config._editor.note && <span className="fe-node-note">{node.config._editor.note}</span>}
          </div>; })}
          {nodes.length === 1 && flowPorts(nodes[0]).length > 0 && !flowPorts(nodes[0])[0].target && <button className="fe-add-first" style={{ left: position(nodes[0]).x + 220, top: position(nodes[0]).y + 16 }} onClick={() => { setConnection({ source: nodes[0].node_key, port: flowPorts(nodes[0])[0], index: 0 }); setPanel("library"); }}><Plus size={20} /><span>Add the first step<small>Choose what happens after the trigger</small></span></button>}
          {rubber && <div className="fe-selection-box" style={{ left: rubber.x, top: rubber.y, width: rubber.width, height: rubber.height }} />}
        </div>
        {connection && <div className="fe-connection-hint"><span>Connect <strong>{connection.port.label}</strong> to a step</span><button onClick={() => setPanel("library")}><Plus size={14} />Add connected step</button><button aria-label="Cancel connection" onClick={() => setConnection(null)}><X size={15} /></button></div>}
        {selection.length > 1 && <div className="fe-multiselect"><span>{selection.length} selected</span><button onClick={duplicate}><Copy size={14} />Duplicate</button><button onClick={deleteSelection}><Trash2 size={14} />Delete</button></div>}
        {edge && <div className="fe-edge-editor"><div><strong>Connection</strong><button aria-label="Close connection editor" onClick={() => setEdge(null)}><X size={15} /></button></div><p>{flowLabel(edge.source)} · {edge.port.label}</p><label>Destination<select value={flowPorts(byKey.get(edge.source.node_key) || edge.source).find(port => port.id === edge.port.id)?.target || ""} onChange={event => { changeTarget(edge.source.node_key, edge.port, event.target.value); setEdge(null); }}>{nodes.filter(node => node.node_key !== edge.source.node_key).map(node => <option key={node.node_key} value={node.node_key}>{flowLabel(node)} ({node.node_key})</option>)}</select></label><button className="fe-remove-link" onClick={() => { changeTarget(edge.source.node_key, edge.port, ""); setEdge(null); }}><Trash2 size={14} />Remove connection</button></div>}
        <div className="fe-canvas-tools"><div><button className={mode === "select" ? "is-active" : ""} onClick={() => setMode("select")} title="Select steps" aria-label="Select steps"><MousePointer2 size={17} /></button><button className={mode === "pan" ? "is-active" : ""} onClick={() => setMode("pan")} title="Pan canvas" aria-label="Pan canvas"><Hand size={17} /></button></div><div><button onClick={() => setZoom(value => Math.max(.25, value - .1))} aria-label="Zoom out"><ZoomOut size={16} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(2, value + .1))} aria-label="Zoom in"><ZoomIn size={16} /></button><button onClick={() => onFit()} title="Fit graph" aria-label="Fit graph"><Maximize2 size={16} /></button></div><div><button className={snap ? "is-active" : ""} onClick={() => setSnap(!snap)} title="Snap to grid" aria-label="Snap to grid" aria-pressed={snap}><Grid size={16} /></button><button onClick={onLayout} title="Arrange steps" aria-label="Arrange steps"><LayoutGrid size={16} /></button><button className={minimap ? "is-active" : ""} onClick={() => setMinimap(!minimap)} title="Toggle minimap" aria-label="Toggle minimap" aria-pressed={minimap}><MapIcon size={16} /></button></div></div>
        {minimap && <div className="fe-minimap"><span>Workflow map</span><svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} aria-label="Workflow map. Select a step to center it.">{edges.map(wire => <path key={wire.id} d={curve(outputPoint(wire.source, wire.index), inputPoint(wire.target))} />)}{nodes.map(node => <rect key={node.node_key} x={position(node).x} y={position(node).y} width={TILE} height={tileHeight(node)} className={selection.includes(node.node_key) ? "is-selected" : ""} onClick={() => focus(node.node_key)} role="button" tabIndex={0} aria-label={`Center ${flowLabel(node)}`} onKeyDown={event => { if (event.key === "Enter") focus(node.node_key); }} />)}</svg></div>}
        <p className="fe-canvas-help">Drag to select · Alt drag to pan · Click a port to connect</p>
      </div>
      {panel && <aside className="fe-panel flow-studio-inspector" ref={panelRef} aria-label={`${panel} panel`}><header><div><span>{panel === "library" ? "Build your conversation" : panel === "inspector" ? "Step configuration" : "Conversation flow"}</span><h2>{{ library: "Add a step", outline: "Workflow steps", settings: "Flow settings", checks: "Validation checks", preview: "Conversation preview", logs: "Simulation log", inspector: selectedNode ? flowLabel(selectedNode) : "Select a step" }[panel]}</h2></div><button className="fe-icon-button" onClick={() => setPanel(null)} aria-label="Close panel"><PanelRightClose size={18} /></button></header><div className="fe-panel-content">
        {panel === "library" && <><FlowStarterPicker onChoose={flow=>{if(nodes.length>1&&!window.confirm("Replace the current draft with this starter?"))return;onChange(flow.nodes);onImportMetadata(flow);setPanel("settings");}}/><label className="fe-search"><Search size={16} /><input ref={searchInput} value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} placeholder="Search messages, logic, actions…" /></label>{connection && <p className="fe-panel-explanation">The new step will connect to <strong>{connection.port.label}</strong>.</p>}{categories.filter(category => category.id !== "triggers").map(category => { const items = category.items.filter(item => `${item.label} ${item.desc}`.toLowerCase().includes(librarySearch.toLowerCase())); return items.length ? <section className="fe-library-group" key={category.id}><h3>{category.name.toLowerCase()}</h3>{items.map(item => <button key={item.type} draggable title="Drag onto the canvas or click to add" onDragStart={event => { event.dataTransfer.setData("application/x-madhura-step", item.type); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addItem(item)}><category.icon size={18} /><span><strong>{item.label}</strong><small>{item.desc}</small></span><Plus size={14} /></button>)}</section> : null; })}{!categories.some(category => category.id !== "triggers" && category.items.some(item => `${item.label} ${item.desc}`.toLowerCase().includes(librarySearch.toLowerCase()))) && <p className="fe-empty">No matching steps. Try “message” or “condition”.</p>}</>}
        {panel === "outline" && <><label className="fe-search"><Search size={16} /><input value={outlineSearch} onChange={event => setOutlineSearch(event.target.value)} placeholder="Find a step by name or key?" aria-label="Find a step" /></label>{nodes.filter(node => `${flowLabel(node)} ${node.node_key}`.toLowerCase().includes(outlineSearch.toLowerCase())).map((node, index) => <button className="fe-outline-row" key={node.node_key} onClick={() => focus(node.node_key)}><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{flowLabel(node)}</strong><small>{node.node_key}{node.node_key === entry ? " · Entry" : ""}</small></span><ChevronRight size={14} /></button>)}{!nodes.some(node => `${flowLabel(node)} ${node.node_key}`.toLowerCase().includes(outlineSearch.toLowerCase())) && <p className="fe-empty">No matching steps. Try a different name or key.</p>}</>}
        {panel === "settings" && settings}
        {panel === "checks" && <><p className="fe-panel-explanation">{errors.length} blocking issues · {issues.length - errors.length} warnings. Check each branch and preview the conversation before publishing.</p>{issues.length ? issues.map((issue, index) => <button className={`fe-check ${issue.severity === "error" ? "is-error" : ""}`} key={index} disabled={!issue.nodeKey} onClick={() => focus(issue.nodeKey)}><AlertCircle size={16} /><span><strong>{issue.severity === "error" ? "Fix required" : "Review"}</strong>{issue.text}</span><ChevronRight size={14} /></button>) : <div className="fe-empty"><CheckCircle2 size={28} /><p>No graph issues found. Preview the conversation to review its behavior.</p></div>}</>}
        {panel === "preview" && <div className="fe-preview">{preview}</div>}
        {panel === "logs" && logs}
        {panel === "inspector" && <>{selectedNode && <section className="fe-step-appearance"><label>Display name<input value={selectedNode.config?._editor?.label || ""} placeholder={selectedNode.node_type.replaceAll("_", " ")} maxLength={80} onChange={event => onChange(nodes.map(node => node.node_key === selectedKey ? { ...node, config: { ...node.config, _editor: { ...node.config?._editor, label: event.target.value } } } : node), true)} /></label><details><summary>Appearance & notes</summary><label>Canvas note<textarea rows={2} value={selectedNode.config?._editor?.note || ""} maxLength={300} onChange={event => onChange(nodes.map(node => node.node_key === selectedKey ? { ...node, config: { ...node.config, _editor: { ...node.config?._editor, note: event.target.value } } } : node), true)} /></label><label>Step color<select value={selectedNode.config?._editor?.color || "navy"} onChange={event => onChange(nodes.map(node => node.node_key === selectedKey ? { ...node, config: { ...node.config, _editor: { ...node.config?._editor, color: event.target.value } } } : node))}><option value="navy">Navy</option><option value="green">Green</option><option value="blue">Blue</option><option value="amber">Amber</option></select></label></details></section>}{inspector}{selectedNode && <>
          <section className="fe-route-settings"><h3>Connections</h3>{flowPorts(selectedNode).length ? flowPorts(selectedNode).map((port, index) => <div key={port.id}><label>{port.label}<select value={port.target || ""} onChange={event => changeTarget(selectedKey, port, event.target.value)}><option value="">Not connected</option>{nodes.filter(node => node.node_key !== selectedKey).map(node => <option key={node.node_key} value={node.node_key}>{flowLabel(node)} ({node.node_key})</option>)}</select></label><button type="button" onClick={() => { setConnection({ source: selectedKey, port, index }); setPanel("library"); }}><Plus size={13} />Add connected step</button></div>) : <p>This step ends the conversation or needs reply options configured above.</p>}</section>
          <WAFlowNodeAdvanced key={selectedKey} node={selectedNode} nodes={nodes} onApply={candidate => onChange(nodes.map(node => node.node_key === selectedKey ? candidate : node))} />
        </>}<section className="fe-step-actions"><button disabled={!selectedNode || selectedKey === entry} onClick={duplicate}><Copy size={14} />Duplicate step</button><button disabled={!selectedNode || selectedKey === entry} onClick={deleteSelection}><Trash2 size={14} />Delete step</button></section></>}
      </div></aside>}
    </div>
  </div>;
}
