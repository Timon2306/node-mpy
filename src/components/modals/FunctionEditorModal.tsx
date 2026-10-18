import React, { useState, useEffect } from 'react';
import { X, Code2, Check } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { translations } from '../../i18n';

export const FunctionEditorModal: React.FC = () => {
  const {
    isFunctionModalOpen,
    setFunctionModalOpen,
    selectedNodeId,
    nodes,
    language,
    updateNodeProperties,
  } = useFlowStore();

  const t = translations[language].modals;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [funcName, setFuncName] = useState('');
  const [params, setParams] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (selectedNode && selectedNode.data.definitionId === 'core:custom_function') {
      setFuncName(selectedNode.data.properties?.func_name || 'my_function');
      setParams(selectedNode.data.properties?.params || 'value');
      setCode(selectedNode.data.properties?.code || '    # Write function body\n    return value');
    }
  }, [selectedNode, isFunctionModalOpen]);

  if (!isFunctionModalOpen || !selectedNode) return null;

  const handleSave = () => {
    if (selectedNodeId) {
      updateNodeProperties(selectedNodeId, {
        func_name: funcName,
        params,
        code,
      });
    }
    setFunctionModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-panel border border-slate-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-border bg-slate-panelHeader">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-200">
              {t.functionEditorTitle}
            </h2>
          </div>
          <button
            onClick={() => setFunctionModalOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                {t.functionNameLabel}
              </label>
              <input
                type="text"
                value={funcName}
                onChange={(e) => setFuncName(e.target.value)}
                className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md px-3 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                {t.functionParamsLabel}
              </label>
              <input
                type="text"
                value={params}
                onChange={(e) => setParams(e.target.value)}
                className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md px-3 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              {t.functionBodyLabel}
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              className="w-full bg-[#14171C] text-gray-200 font-mono text-xs p-3 rounded-md border border-slate-border focus:border-blue-400 focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-border bg-slate-panelHeader">
          <button
            onClick={() => setFunctionModalOpen(false)}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded border border-slate-border hover:bg-slate-hover transition-colors"
          >
            {t.cancelButton}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.saveButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
