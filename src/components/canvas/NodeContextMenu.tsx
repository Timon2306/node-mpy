import React, { useEffect, useRef } from 'react';
import { Copy, ClipboardPaste, CopyPlus, Trash2, Sliders, Eraser } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  flowPosition?: { x: number; y: number };
}

interface NodeContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({ menu, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    language,
    copiedNodes,
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    deleteSelectedNode,
    selectNode,
    clearCanvas,
    setInspectorTab,
  } = useFlowStore();

  const isRu = language === 'ru';
  const hasNode = !!menu.nodeId;
  const canPaste = copiedNodes && copiedNodes.length > 0;

  // Close on outside click or escape
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust coordinates if menu would overflow viewport
  const menuWidth = 190;
  const menuHeight = hasNode ? 180 : 90;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const posX = Math.max(10, menu.x + menuWidth > screenW ? screenW - menuWidth - 10 : menu.x);
  const posY = Math.max(10, menu.y + menuHeight > screenH ? screenH - menuHeight - 10 : menu.y);

  return (
    <div
      ref={menuRef}
      style={{ left: posX, top: posY }}
      className="fixed z-50 w-[190px] bg-[#1E222B] border border-[#374151] rounded-lg shadow-2xl py-1 text-xs select-none backdrop-blur-sm animate-in fade-in duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {hasNode ? (
        <>
          {/* Copy */}
          <button
            onClick={() => {
              copySelectedNodes();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-gray-200 hover:bg-[#2A313E] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>{isRu ? 'Копировать' : 'Copy'}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Ctrl+C</span>
          </button>

          {/* Paste */}
          <button
            onClick={() => {
              if (canPaste) {
                pasteNodes(menu.flowPosition);
                onClose();
              }
            }}
            disabled={!canPaste}
            className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
              canPaste
                ? 'text-gray-200 hover:bg-[#2A313E] hover:text-white'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-3.5 h-3.5 text-teal-400" />
              <span>{isRu ? 'Вставить' : 'Paste'}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Ctrl+V</span>
          </button>

          {/* Duplicate */}
          <button
            onClick={() => {
              duplicateSelectedNodes();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-gray-200 hover:bg-[#2A313E] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <CopyPlus className="w-3.5 h-3.5 text-purple-400" />
              <span>{isRu ? 'Дублировать' : 'Duplicate'}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Ctrl+D</span>
          </button>

          <div className="h-[1px] bg-[#374151] my-1" />

          {/* Properties */}
          <button
            onClick={() => {
              if (menu.nodeId) {
                selectNode(menu.nodeId);
                setInspectorTab('properties');
              }
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-gray-200 hover:bg-[#2A313E] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRu ? 'Свойства ноды' : 'Properties'}</span>
            </div>
          </button>

          <div className="h-[1px] bg-[#374151] my-1" />

          {/* Delete */}
          <button
            onClick={() => {
              if (menu.nodeId) {
                selectNode(menu.nodeId);
              }
              deleteSelectedNode();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isRu ? 'Удалить' : 'Delete'}</span>
            </div>
            <span className="text-[10px] text-red-400/70 font-mono">Del</span>
          </button>
        </>
      ) : (
        /* Empty canvas context menu */
        <>
          {/* Paste */}
          <button
            onClick={() => {
              if (canPaste) {
                pasteNodes(menu.flowPosition);
                onClose();
              }
            }}
            disabled={!canPaste}
            className={`w-full flex items-center justify-between px-3 py-1.5 transition-colors ${
              canPaste
                ? 'text-gray-200 hover:bg-[#2A313E] hover:text-white'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-3.5 h-3.5 text-teal-400" />
              <span>{isRu ? 'Вставить ноды' : 'Paste Nodes'}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Ctrl+V</span>
          </button>

          <div className="h-[1px] bg-[#374151] my-1" />

          {/* Clear Canvas */}
          <button
            onClick={() => {
              if (window.confirm(isRu ? 'Очистить холст этой вкладки?' : 'Clear canvas for this tab?')) {
                clearCanvas();
              }
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{isRu ? 'Очистить холст' : 'Clear Canvas'}</span>
          </button>
        </>
      )}
    </div>
  );
};
