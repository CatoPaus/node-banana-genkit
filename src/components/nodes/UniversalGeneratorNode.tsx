"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore, saveUniversalGeneratorDefaults } from "@/store/workflowStore";
import { UniversalGeneratorNodeData, AspectRatio, Resolution, ModelType, ModelInfo } from "@/types";


type UniversalGeneratorNodeType = Node<UniversalGeneratorNodeData, "universalGenerator">;

export function UniversalGeneratorNode({ id, data, selected }: NodeProps<UniversalGeneratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const provider = useWorkflowStore((state) => state.provider);

  // Access store state
  const availableModels = useWorkflowStore((state) => state.availableModels);
  const favoriteModelIds = useWorkflowStore((state) => state.favoriteModelIds);
  const fetchModels = useWorkflowStore((state) => state.fetchModels);

  const handleAspectRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const aspectRatio = e.target.value as AspectRatio;
      updateNodeData(id, { aspectRatio });
      saveUniversalGeneratorDefaults({ aspectRatio });
    },
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const resolution = e.target.value as Resolution;
      updateNodeData(id, { resolution });
      saveUniversalGeneratorDefaults({ resolution });
    },
    [id, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const model = e.target.value as ModelType;
      updateNodeData(id, { model });
      saveUniversalGeneratorDefaults({ model });
    },
    [id, updateNodeData]
  );

  const handleGoogleSearchToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const useGoogleSearch = e.target.checked;
      updateNodeData(id, { useGoogleSearch });
      saveUniversalGeneratorDefaults({ useGoogleSearch });
    },
    [id, updateNodeData]
  );

  const handleClearImage = useCallback(() => {
    updateNodeData(id, { outputImage: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const [showInfo, setShowInfo] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (availableModels.length === 0) {
      setLoadingModels(true);
      fetchModels().finally(() => setLoadingModels(false));
    }
  }, [availableModels.length, fetchModels]);

  // Filter and Sort Models
  const filteredModels = availableModels
    .filter(m => m.provider === provider)
    .sort((a, b) => {
      const isAFav = favoriteModelIds.includes(a.id);
      const isBFav = favoriteModelIds.includes(b.id);
      if (isAFav && !isBFav) return -1;
      if (!isAFav && isBFav) return 1;
      return a.label.localeCompare(b.label);
    });

  const currentModel = availableModels.find(m => m.id === nodeData.model);
  // console.log("Selected Model:", currentModel);

  // Default capabilities if model not waiting loaded yet or legacy
  const capabilities = currentModel?.capabilities || {
    supportsImageInput: true,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsGoogleSearch: true,
  };

  const isNanoBananaPro = nodeData.model === "nano-banana-pro" || nodeData.model.includes("ultra") || nodeData.model.includes("pro"); // Heuristic for "Auto-Pro" UI


  return (
    <BaseNode
      id={id}
      title="Universal Generator"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Image input - accepts multiple connections */}
      {capabilities.supportsImageInput && (
        <Handle
          type="target"
          position={Position.Left}
          id="image"
          style={{ top: "35%", opacity: 1 }}
          data-handletype="image"
          isConnectable={true}
        />
      )}
      {!capabilities.supportsImageInput && (
        <div className="absolute left-[-4px] top-[35%] w-[8px] h-[8px] rounded-full bg-neutral-600 opacity-30 cursor-not-allowed" title="Image input disabled for this model" />
      )}
      {/* Text input - single connection */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "65%" }}
        data-handletype="text"
      />
      {/* Image output */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Preview area */}
        {(nodeData.output || nodeData.image || nodeData.outputImage) ? (
          <div className="relative w-full flex-1 min-h-0 bg-neutral-900 rounded overflow-hidden group">
            {/* Render Image or Video */}
            {(() => {
              const url = (nodeData.output || nodeData.image || nodeData.outputImage) as string;
              // Check for video extension or Veo API URL
              const isVideo = url.toLowerCase().endsWith('.mp4') || url.includes('/files/') || url.includes('generativelanguage.googleapis.com');

              if (isVideo) {
                return (
                  <video
                    src={url}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    loop
                    playsInline
                  />
                );
              }
              return (
                <img
                  src={url}
                  alt="Generated"
                  className="w-full h-full object-contain"
                />
              );
            })()}

            {/* Loading overlay */}
            {nodeData.status === "loading" && (
              <div className="absolute inset-0 bg-neutral-900/80 rounded flex flex-col items-center justify-center gap-2 z-10">
                <svg
                  className="w-8 h-8 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {nodeData.operationId && (
                  <div className="text-[10px] text-neutral-300 animate-pulse font-medium">
                    Creating Video...<br />
                    <span className="text-[9px] opacity-70 font-normal">(Takes ~1-2 mins)</span>
                  </div>
                )}
              </div>
            )}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handleRegenerate}
                disabled={isRunning}
                className="w-6 h-6 bg-neutral-900/80 hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Regenerate"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleClearImage}
                className="w-6 h-6 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Clear"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-[112px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center">
            {nodeData.status === "loading" ? (
              <svg
                className="w-4 h-4 animate-spin text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : nodeData.status === "error" ? (
              <span className="text-[10px] text-red-400 text-center px-2">
                {nodeData.error || "Failed"}
              </span>
            ) : (
              <span className="text-neutral-500 text-[10px]">
                Run to generate
              </span>
            )}
          </div>
        )}

        {/* Model Selection */}
        <select
          value={nodeData.model}
          onChange={(e) => {
            const model = e.target.value as ModelType;
            updateNodeData(id, { model });
            saveUniversalGeneratorDefaults({ model });
          }}
          disabled={loadingModels}
          className="w-full bg-neutral-900/50 border border-neutral-700 rounded p-1.5 text-[10px] text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600 disabled:opacity-50"
        >
          {loadingModels ? (
            <option>Loading models...</option>
          ) : (
            <>
              {filteredModels.length > 0 ? (
                <>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {favoriteModelIds.includes(m.id) ? '★ ' : ''}{m.label}
                    </option>
                  ))}
                </>
              ) : (
                <option value={nodeData.model}>{nodeData.model} (Current)</option>
              )}
            </>
          )}
        </select>

        {/* Info Toggle */}
        <div className="flex justify-end px-1">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showInfo ? 'Hide Info' : 'Model Info'}
          </button>
        </div>

        {/* Info Panel */}
        {showInfo && capabilities && (
          <div className="bg-neutral-900/80 p-2 rounded text-[10px] text-neutral-400 space-y-1 border border-neutral-700">
            <div className="font-bold text-neutral-300">Effective Capabilities:</div>
            <div>• Image Input: {capabilities.supportsImageInput ? 'Yes' : 'No'}</div>
            <div>• Aspect Ratio: {capabilities.supportsAspectRatio ? 'Yes' : 'No'}</div>
            {capabilities.options && capabilities.options.length > 0 && (
              <div className="mt-1">
                <div>• Options:</div>
                <ul className="pl-2">
                  {capabilities.options.map(o => (
                    <li key={o.key}>- {o.key} ({o.type})</li>
                  ))}
                </ul>
              </div>
            )}
            {capabilities.raw && (
              <>
                <div className="font-bold text-neutral-300 mt-2">Raw Metadata (Genkit):</div>
                <pre className="text-[9px] overflow-hidden whitespace-pre-wrap font-mono bg-black/20 p-1 rounded">
                  {JSON.stringify(capabilities.raw, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}

        {/* Dynamic Options based on Schema */}
        {capabilities.options && capabilities.options.length > 0 && (
          <div className="flex flex-col gap-2">
            {capabilities.options.map((option) => {
              if (option.type === 'enum' && option.values) {
                return (
                  <div key={option.key} className="flex flex-col gap-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold flex items-center gap-1">
                      {option.label}
                      {option.description && (
                        <span className="group relative cursor-help">
                          <svg className="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-neutral-300 text-[9px] rounded w-32 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {option.description}
                          </span>
                        </span>
                      )}
                    </label>
                    <select
                      value={(nodeData as any)[option.key] || ""}
                      onChange={(e) => {
                        updateNodeData(id, { [option.key]: e.target.value });
                        saveUniversalGeneratorDefaults({ [option.key]: e.target.value });
                      }}
                      className="w-full bg-neutral-900/50 border border-neutral-700 rounded p-1.5 text-[10px] text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    >
                      <option value="">Default</option>
                      {option.values.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              // Add other types as needed (number, boolean, etc.) but for now enum covers imageSize/aspectRatio
              if (option.type === 'number') {
                return (
                  <div key={option.key} className="flex flex-col gap-1">
                    <label className="text-[9px] text-neutral-500 uppercase font-semibold flex items-center gap-1">
                      {option.label}
                      {option.description && (
                        <span className="group relative cursor-help">
                          <svg className="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-neutral-300 text-[9px] rounded w-32 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {option.description}
                          </span>
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min={option.min}
                      max={option.max}
                      placeholder={option.min !== undefined && option.max !== undefined ? `${option.min} - ${option.max}` : "Default"}
                      value={(nodeData as any)[option.key] || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateNodeData(id, { [option.key]: val });
                        saveUniversalGeneratorDefaults({ [option.key]: val });
                      }}
                      className="w-full bg-neutral-900/50 border border-neutral-700 rounded p-1.5 text-[10px] text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    />
                  </div>
                );
              }
              if (option.type === 'boolean') {
                return (
                  <div key={option.key} className="flex items-center gap-2" title={option.description}>
                    <input
                      type="checkbox"
                      id={`${option.key}-${id}`}
                      checked={!!(nodeData as any)[option.key]}
                      onChange={(e) => {
                        const val = e.target.checked;
                        updateNodeData(id, { [option.key]: val });
                        saveUniversalGeneratorDefaults({ [option.key]: val });
                      }}
                      className="rounded bg-neutral-900 border-neutral-700 text-yellow-500 focus:ring-yellow-500/20"
                    />
                    <label htmlFor={`${option.key}-${id}`} className="text-[10px] text-neutral-400 select-none cursor-pointer uppercase font-semibold">
                      {option.label}
                    </label>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}



        {/* Google Search Toggle - Pro models only */}
        {isNanoBananaPro && capabilities.supportsGoogleSearch && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id={`google-search-${id}`}
              checked={nodeData.useGoogleSearch}
              onChange={(e) => {
                const useGoogleSearch = e.target.checked;
                updateNodeData(id, { useGoogleSearch });
                saveUniversalGeneratorDefaults({ useGoogleSearch });
              }}
              className="rounded bg-neutral-900 border-neutral-700 text-yellow-500 focus:ring-yellow-500/20"
            />
            <label htmlFor={`google-search-${id}`} className="text-[10px] text-neutral-400 select-none cursor-pointer">
              Use Google Search
            </label>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
