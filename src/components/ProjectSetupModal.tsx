"use client";

import { useState, useEffect } from "react";
import { generateWorkflowId, useWorkflowStore } from "@/store/workflowStore";
import { AIProvider } from "@/types";

interface ProjectSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string, directoryPath: string, generationsPath: string | null) => void;
  mode: "new" | "settings";
}

export function ProjectSetupModal({
  isOpen,
  onClose,
  onSave,
  mode,
}: ProjectSetupModalProps) {
  const { workflowName, saveDirectoryPath, generationsPath, provider, setProvider } = useWorkflowStore();

  const [name, setName] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [genPath, setGenPath] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("googleai");
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowsingWorkflow, setIsBrowsingWorkflow] = useState(false);
  const [isBrowsingGen, setIsBrowsingGen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when opening in settings mode
  useEffect(() => {
    // Fetch models whenever the modal opens to ensure we have the latest list
    if (isOpen) {
      useWorkflowStore.getState().fetchModels();
    }

    if (isOpen && mode === "settings") {
      setName(workflowName || "");
      setDirectoryPath(saveDirectoryPath || "");
      setGenPath(generationsPath || "");
      setSelectedProvider(provider);
    } else if (isOpen && mode === "new") {
      setName("");
      setDirectoryPath("");
      setGenPath("");
    }
  }, [isOpen, mode, workflowName, saveDirectoryPath, generationsPath]);

  const handleBrowse = async (target: "workflow" | "generations") => {
    const setIsBrowsing = target === "workflow" ? setIsBrowsingWorkflow : setIsBrowsingGen;
    const setPath = target === "workflow" ? setDirectoryPath : setGenPath;

    setIsBrowsing(true);
    setError(null);

    try {
      const response = await fetch("/api/browse-directory");
      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to open directory picker");
        return;
      }

      if (result.cancelled) {
        return;
      }

      if (result.path) {
        setPath(result.path);
      }
    } catch (err) {
      setError(
        `Failed to open directory picker: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!directoryPath.trim()) {
      setError("Workflow directory is required");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Validate workflow directory exists
      const response = await fetch(
        `/api/workflow?path=${encodeURIComponent(directoryPath.trim())}`
      );
      const result = await response.json();

      if (!result.exists) {
        setError("Workflow directory does not exist");
        setIsValidating(false);
        return;
      }

      if (!result.isDirectory) {
        setError("Workflow path is not a directory");
        setIsValidating(false);
        return;
      }

      // Validate generations directory if provided
      if (genPath.trim()) {
        const genResponse = await fetch(
          `/api/workflow?path=${encodeURIComponent(genPath.trim())}`
        );
        const genResult = await genResponse.json();

        if (!genResult.exists) {
          setError("Generations directory does not exist");
          setIsValidating(false);
          return;
        }

        if (!genResult.isDirectory) {
          setError("Generations path is not a directory");
          setIsValidating(false);
          return;
        }
      }

      const id = mode === "new" ? generateWorkflowId() : useWorkflowStore.getState().workflowId || generateWorkflowId();
      onSave(id, name.trim(), directoryPath.trim(), genPath.trim() || null);
      setProvider(selectedProvider);
      setIsValidating(false);
    } catch (err) {
      setError(
        `Failed to validate directories: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isValidating && !isBrowsingWorkflow && !isBrowsingGen) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isBrowsing = isBrowsingWorkflow || isBrowsingGen;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div
        className="bg-neutral-800 rounded-lg p-6 w-[480px] border border-neutral-700 shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          {mode === "new" ? "New Project" : "Project Settings"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Workflow Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                placeholder="/Users/username/projects"
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => handleBrowse("workflow")}
                disabled={isBrowsing}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-sm rounded transition-colors"
              >
                {isBrowsingWorkflow ? "..." : "Browse"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Where the workflow JSON file will be saved
            </p>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              Generations Directory
              <span className="text-neutral-500 ml-1">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={genPath}
                onChange={(e) => setGenPath(e.target.value)}
                placeholder="/Users/username/generations"
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-600 rounded text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => handleBrowse("generations")}
                disabled={isBrowsing}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-sm rounded transition-colors"
              >
                {isBrowsingGen ? "..." : "Browse"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Generated images will be automatically saved here
            </p>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div
                onClick={() => setSelectedProvider("googleai")}
                className={`p-3 rounded border cursor-pointer transition-colors ${selectedProvider === "googleai"
                  ? "bg-neutral-700 border-blue-500 ring-1 ring-blue-500"
                  : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${selectedProvider === "googleai" ? "bg-blue-500" : "bg-neutral-600"}`} />
                  <span className="text-sm font-medium text-neutral-100">Google AI</span>
                </div>
                <div className="text-[10px] text-neutral-400 space-y-1 pl-5">
                  <div>• Code Execution</div>
                  <div>• Context Caching</div>
                  <div>• File Search</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedProvider("vertexai")}
                className={`p-3 rounded border cursor-pointer transition-colors ${selectedProvider === "vertexai"
                  ? "bg-neutral-700 border-blue-500 ring-1 ring-blue-500"
                  : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${selectedProvider === "vertexai" ? "bg-blue-500" : "bg-neutral-600"}`} />
                  <span className="text-sm font-medium text-neutral-100">Vertex AI</span>
                </div>
                <div className="text-[10px] text-neutral-400 space-y-1 pl-5">
                  <div>• Vertex Search</div>
                  <div>• Enterprise</div>
                  <div>• Private</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedProvider("openai")}
                className={`p-3 rounded border cursor-pointer transition-colors ${selectedProvider === "openai"
                  ? "bg-neutral-700 border-blue-500 ring-1 ring-blue-500"
                  : "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${selectedProvider === "openai" ? "bg-green-500" : "bg-neutral-600"}`} />
                  <span className="text-sm font-medium text-neutral-100">OpenAI</span>
                </div>
                <div className="text-[10px] text-neutral-400 space-y-1 pl-5">
                  <div>• GPT Models</div>
                  <div>• DALL-E</div>
                  <div>• Extensive Tools</div>
                </div>
              </div>
            </div>

            {selectedProvider === "vertexai" && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-neutral-500 uppercase font-semibold mb-1">Region</label>
                    <select className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-500">
                      <option value="us-central1">us-central1 (Iowa)</option>
                      <option value="europe-west4">europe-west4 (Netherlands)</option>
                      <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-800/30 rounded">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[11px] text-blue-200/80">
                    Vertex AI requires configured Google Cloud credentials (ADC) and the Vertex AI API enabled in your project.
                  </p>
                </div>
              </div>
            )}

            {/* Model List with Icons & Favorites */}
            <div className="mt-4 border-t border-neutral-700 pt-3">
              <label className="block text-xs text-neutral-500 uppercase font-semibold mb-2">
                Available Models & Capabilities
              </label>
              <div className="bg-neutral-900/50 rounded border border-neutral-700 max-h-[160px] overflow-y-auto">
                {/* Empty State / Loading would go here if needed */}
                {useWorkflowStore.getState().availableModels
                  .filter(m => m.provider === selectedProvider)
                  .map(m => {
                    const isFav = useWorkflowStore.getState().favoriteModelIds.includes(m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-2 hover:bg-neutral-800/50 border-b border-neutral-800 last:border-0 group">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-neutral-300 font-medium truncate" title={m.id}>{m.label}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {/* Icons */}
                            {m.capabilities?.supportsImageInput && <span title="Image Input/Output">🖼️</span>}
                            {m.capabilities?.supportsVideo && <span title="Video Generation">🎥</span>}
                            {m.capabilities?.supportsCodeExecution && <span title="Code Execution">💻</span>}
                            {m.capabilities?.supportsGoogleSearch && <span title="Google Search">🔍</span>}
                            {m.label.toLowerCase().includes('flash') && <span title="Flash / Fast Model">⚡</span>}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useWorkflowStore.getState().toggleFavoriteModel(m.id);
                          }}
                          className={`p-1 rounded hover:bg-neutral-700 transition-colors ${isFav ? 'text-yellow-500' : 'text-neutral-600 hover:text-neutral-400'}`}
                          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <svg className="w-4 h-4" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                {useWorkflowStore.getState().availableModels.filter(m => m.provider === selectedProvider).length === 0 && (
                  <div className="p-4 text-center text-xs text-neutral-500">
                    No models found for this provider.
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating || isBrowsing}
            className="px-4 py-2 text-sm bg-white text-neutral-900 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isValidating ? "Validating..." : mode === "new" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
