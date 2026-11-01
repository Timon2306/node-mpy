import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  Connection,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertCircle, X } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { NodeMpyNode } from './NodeMpyNode';
import { NodeContextMenu, ContextMenuState } from './NodeContextMenu';
import { arePortsCompatible } from '../../types/ports';
import { LibraryRegistry } from '../../registry/registryLoader';

const nodeTypes = {
  nodeMpy: NodeMpyNode,
  nodeTeal: NodeMpyNode,
};

function FlowCanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    selectAllNodes,
    deleteSelectedNode,
    draggedDefinitionId,
    setDraggedDefinitionId,
    pushHistory,
    undo,
    redo,
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    connectionToast,
    setConnectionToast,
  } = useFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  useEffect(() => {
    const fit = () => fitView({ padding: 0.2, duration: 200 });
    window.addEventListener('nodempy-fit', fit);
    return () => window.removeEventListener('nodempy-fit', fit);
  }, [fitView]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 300, y: 200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement)?.isContentEditable;

      if (isInput) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if ((isCtrlOrCmd && e.key.toLowerCase() === 'y') || (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllNodes();
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
        copySelectedNodes();
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const flowPos = screenToFlowPosition(lastMousePos.current);
        pasteNodes(flowPos);
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedNodes();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedNode();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectAllNodes, copySelectedNodes, pasteNodes, duplicateSelectedNodes, deleteSelectedNode, screenToFlowPosition]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const sourceDef = LibraryRegistry.getNodeDefinition(sourceNode.data.definitionId);
      const targetDef = LibraryRegistry.getNodeDefinition(targetNode.data.definitionId);
      if (!sourceDef || !targetDef) return false;

      const sourcePort = sourceDef.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetDef.inputs.find((p) => p.id === connection.targetHandle);
      if (!sourcePort || !targetPort) return false;

      return arePortsCompatible(sourcePort.type, targetPort.type);
    },
    [nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const definitionId =
        event.dataTransfer.getData('application/node-mpy-definition') ||
        event.dataTransfer.getData('application/node-teal-definition') ||
        event.dataTransfer.getData('text/plain') ||
        event.dataTransfer.getData('text') ||
        draggedDefinitionId;

      if (!definitionId) return;

      const rawPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const position = {
        x: Math.round(rawPosition.x / 16) * 16,
        y: Math.round(rawPosition.y / 16) * 16,
      };

      addNode(definitionId, position);
      setDraggedDefinitionId(null);
    },
    [addNode, screenToFlowPosition, draggedDefinitionId, setDraggedDefinitionId]
  );

  const onNodeContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent, node: any) => {
      event.preventDefault();
      const target = nodes.find((n) => n.id === node.id);
      if (!target?.selected) {
        selectNode(node.id);
      }
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        flowPosition,
      });
    },
    [nodes, selectNode, screenToFlowPosition]
  );

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowPosition,
      });
    },
    [screenToFlowPosition]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative outline-none select-none"
      tabIndex={0}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStart={() => pushHistory()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_event, node) => selectNode(node.id)}
        onPaneClick={() => {
          selectNode(null);
          setContextMenu(null);
        }}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onNodesDelete={deleteSelectedNode}
        deleteKeyCode={null}
        selectionOnDrag={true}
        panOnDrag={[1, 2]}
        selectionMode={SelectionMode.Partial}
        panActivationKeyCode="Space"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid={true}
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'default',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.5}
          color="#2B3240"
        />
        <MiniMap
          nodeColor={(n: any) => n.data?.color || '#3B82F6'}
          maskColor="rgba(24, 27, 32, 0.75)"
          className="bg-slate-panel border border-slate-border rounded-md"
        />
      </ReactFlow>

      {connectionToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2.5 bg-[#251717] border border-red-500/60 text-red-200 text-xs rounded-lg shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-lg pointer-events-auto">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="leading-snug flex-1">{connectionToast}</span>
          <button
            onClick={() => setConnectionToast(null)}
            className="text-red-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {contextMenu && (
        <NodeContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export const FlowCanvas = () => {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
};
