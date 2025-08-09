import { db } from "../../../data/db";
import { Banner, Modal, Button, Input, Empty, Spin } from "@douyinfe/semi-ui";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { databases } from "../../../data/databases";
import { getRecentDiagrams, deleteDiagram } from "../../../api/diagrams";
import { useState, useEffect, useMemo } from "react";
import { IconDeleteStroked, IconSearch } from "@douyinfe/semi-icons";

export default function Open({ selectedDiagramId, setSelectedDiagramId }) {
  const [backendDiagrams, setBackendDiagrams] = useState([]);
  const [useBackend, setUseBackend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const localDiagrams = useLiveQuery(() => db.diagrams.toArray());
  const { t } = useTranslation();

  // Check if backend is available and load diagrams
  useEffect(() => {
    const loadBackendDiagrams = async () => {
      try {
        console.log('Loading diagrams from backend...');
        const diagrams = await getRecentDiagrams(50); // Load up to 50 diagrams
        setBackendDiagrams(diagrams);
        setUseBackend(true);
        console.log('Loaded diagrams from backend:', diagrams);
      } catch (error) {
        console.log('Backend not available, using local storage:', error.message);
        setUseBackend(false);
      } finally {
        setLoading(false);
      }
    };

    loadBackendDiagrams();
  }, []);

  // Use backend diagrams if available, otherwise fall back to local
  const diagrams = useBackend ? backendDiagrams : localDiagrams;

  // Filter diagrams based on search term
  const filteredDiagrams = useMemo(() => {
    if (!diagrams || !searchTerm.trim()) return diagrams;
    
    return diagrams.filter(diagram => {
      const name = diagram.name || diagram.title || "";
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [diagrams, searchTerm]);

  const getDiagramSize = (d) => {
    const size = JSON.stringify(d).length;
    let sizeStr;
    if (size >= 1024 && size < 1024 * 1024)
      sizeStr = (size / 1024).toFixed(1) + "KB";
    else if (size >= 1024 * 1024)
      sizeStr = (size / (1024 * 1024)).toFixed(1) + "MB";
    else sizeStr = size + "B";

    return sizeStr;
  };

  const handleDeleteClick = (e, diagram) => {
    e.stopPropagation(); // Prevent row selection
    setDiagramToDelete(diagram);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!diagramToDelete) return;
    
    setDeleting(true);
    try {
      if (useBackend) {
        // Delete from backend
        await deleteDiagram(diagramToDelete.id);
        // Remove from local state
        setBackendDiagrams(prev => prev.filter(d => d.id !== diagramToDelete.id));
      } else {
        // Delete from local storage
        await db.diagrams.delete(diagramToDelete.id);
      }
      
      // If the deleted diagram was selected, clear selection
      if (selectedDiagramId === diagramToDelete.id) {
        setSelectedDiagramId(null);
      }
      
      console.log('Diagram deleted successfully');
    } catch (error) {
      console.error('Failed to delete diagram:', error);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDiagramToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDiagramToDelete(null);
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading diagrams...</span>
        </div>
      ) : diagrams?.length === 0 ? (
        <Empty
          image={<Empty.Image />}
          description="You have no saved diagrams."
          className="py-12"
        />
      ) : (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Input
              prefix={<IconSearch />}
              placeholder={t("search_diagrams")}
              value={searchTerm}
              onChange={setSearchTerm}
              showClear
              size="large"
              className="w-full"
            />
          </div>

          {/* Diagrams List */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredDiagrams?.length === 0 ? (
              <Empty
                image={<Empty.Image />}
                description={
                  searchTerm.trim() 
                    ? t("no_diagrams_found") 
                    : t("no_diagrams_available")
                }
                className="py-8"
              />
            ) : (
              <div className="space-y-2">
                {filteredDiagrams?.map((d) => {
                  // Handle different data structures from backend vs local storage
                  const name = d.name || d.title;
                  const lastModified = d.lastModified || new Date(d.updatedAt);
                  const databaseType = d.database || d.databaseType;
                  const isSelected = selectedDiagramId === d.id;
                  
                  return (
                    <div
                      key={d.id}
                      className={`
                        relative p-4 rounded-lg border cursor-pointer transition-all duration-200
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }
                      `}
                      onClick={() => setSelectedDiagramId(d.id)}
                    >
                      {/* Main Content */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Title and Icon */}
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <i className="bi bi-file-earmark-text text-white text-sm" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {name}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {lastModified.toLocaleDateString()} at {lastModified.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          {/* Meta Information */}
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                              {databases[databaseType]?.name ?? "Generic"}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="bi bi-hdd text-xs"></i>
                              {getDiagramSize(d)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Delete Button */}
                        <div className="flex-shrink-0 ml-3">
                          <Button
                            type="danger"
                            theme="borderless"
                            size="small"
                            icon={<IconDeleteStroked />}
                            onClick={(e) => handleDeleteClick(e, d)}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                          />
                        </div>
                      </div>
                      
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Results Count */}
          {searchTerm.trim() && filteredDiagrams && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              {filteredDiagrams.length} of {diagrams?.length || 0} diagrams found
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        title={t("delete_diagram")}
        visible={showDeleteModal}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmLoading={deleting}
        okText={t("delete")}
        cancelText={t("cancel")}
        okType="danger"
      >
        <p>{t("are_you_sure_delete_diagram")}</p>
        {diagramToDelete && (
          <p className="mt-2 text-sm text-gray-600">
            <strong>{diagramToDelete.name || diagramToDelete.title}</strong>
          </p>
        )}
      </Modal>
    </div>
  );
}
