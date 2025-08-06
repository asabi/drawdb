import { db } from "../../../data/db";
import { Banner, Modal, Button } from "@douyinfe/semi-ui";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { databases } from "../../../data/databases";
import { getRecentDiagrams, deleteDiagram } from "../../../api/diagrams";
import { useState, useEffect } from "react";
import { IconDeleteStroked } from "@douyinfe/semi-icons";

export default function Open({ selectedDiagramId, setSelectedDiagramId }) {
  const [backendDiagrams, setBackendDiagrams] = useState([]);
  const [useBackend, setUseBackend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
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
        <Banner
          fullMode={false}
          type="info"
          bordered
          icon={null}
          closeIcon={null}
          description={<div>Loading diagrams...</div>}
        />
      ) : diagrams?.length === 0 ? (
        <Banner
          fullMode={false}
          type="info"
          bordered
          icon={null}
          closeIcon={null}
          description={<div>You have no saved diagrams.</div>}
        />
      ) : (
        <div className="max-h-[360px]">
          <table className="w-full text-left border-separate border-spacing-x-0">
            <thead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("last_modified")}</th>
                <th>{t("size")}</th>
                <th>{t("type")}</th>
                <th className="w-12"></th> {/* Delete button column */}
              </tr>
            </thead>
            <tbody>
              {diagrams?.map((d) => {
                // Handle different data structures from backend vs local storage
                const name = d.name || d.title;
                const lastModified = d.lastModified || new Date(d.updatedAt);
                const databaseType = d.database || d.databaseType;
                
                return (
                  <tr
                    key={d.id}
                    className={`${
                      selectedDiagramId === d.id
                        ? "bg-blue-300/30"
                        : "hover-1"
                    }`}
                    onClick={() => {
                      setSelectedDiagramId(d.id);
                    }}
                  >
                    <td className="py-1">
                      <i className="bi bi-file-earmark-text text-[16px] me-1 opacity-60" />
                      {name}
                    </td>
                    <td className="py-1">
                      {lastModified.toLocaleDateString() +
                        " " +
                        lastModified.toLocaleTimeString()}
                    </td>
                    <td className="py-1">{getDiagramSize(d)}</td>
                    <td className="py-1">
                      {databases[databaseType]?.name ?? "Generic"}
                    </td>
                    <td className="py-1">
                      <Button
                        type="danger"
                        theme="borderless"
                        size="small"
                        icon={<IconDeleteStroked />}
                        onClick={(e) => handleDeleteClick(e, d)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
