import { Banner, Button, Input, Spin, Toast } from "@douyinfe/semi-ui";
import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IdContext } from "../../Workspace";
import { IconLink } from "@douyinfe/semi-icons";
import {
  useAreas,
  useDiagram,
  useEnums,
  useNotes,
  useTransform,
  useTypes,
} from "../../../hooks";
import { databases } from "../../../data/databases";
import { MODAL } from "../../../data/constants";
import { createDiagram, updateDiagram, deleteDiagram } from "../../../api/diagrams";

export default function Share({ title, setModal, diagramId, setDiagramId }) {
  const { t } = useTranslation();
  const { gistId, setGistId } = useContext(IdContext);
  const [loading, setLoading] = useState(true);
  const { tables, relationships, database } = useDiagram();
  const { notes } = useNotes();
  const { areas } = useAreas();
  const { types } = useTypes();
  const { enums } = useEnums();
  const { transform } = useTransform();
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  const diagramContent = useCallback(() => {
    return {
      tables: tables,
      relationships: relationships,
      notes: notes,
      areas: areas,
      tasks: [], // Add tasks if you have them
      transform: transform,
      ...(databases[database].hasTypes && { types: types }),
      ...(databases[database].hasEnums && { enums: enums }),
    };
  }, [
    areas,
    notes,
    tables,
    relationships,
    database,
    enums,
    types,
    transform,
  ]);

  const generateShareUrl = useCallback((id) => {
    return window.location.origin + window.location.pathname + "?diagramId=" + id;
  }, []);

  const unshare = useCallback(async () => {
    try {
      if (diagramId) {
        await deleteDiagram(diagramId);
        setDiagramId(null);
      }
      if (gistId) {
        // Keep gist fallback for backward compatibility
        setGistId("");
      }
      setModal(MODAL.NONE);
    } catch (e) {
      console.error(e);
      setError(e);
    }
  }, [diagramId, setDiagramId, gistId, setGistId, setModal]);

  useEffect(() => {
    const updateOrGenerateLink = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (diagramId) {
          try {
            // Try to update existing diagram
            await updateDiagram(diagramId, title, database, diagramContent());
            setShareUrl(generateShareUrl(diagramId));
          } catch (updateError) {
            // If update fails (404), create a new diagram
            console.log('Update failed, creating new diagram:', updateError.message);
            const result = await createDiagram(title, database, diagramContent());
            setDiagramId(result.id);
            setShareUrl(generateShareUrl(result.id));
          }
        } else {
          // Create new diagram
          const result = await createDiagram(title, database, diagramContent());
          setDiagramId(result.id);
          setShareUrl(generateShareUrl(result.id));
        }
      } catch (e) {
        console.error('Error saving to database:', e);
        setError(e);
      } finally {
        setLoading(false);
      }
    };
    updateOrGenerateLink();
  }, [diagramId, title, database, diagramContent, setDiagramId, generateShareUrl]);

  const copyLink = () => {
    const urlToCopy = shareUrl || (gistId ? window.location.origin + window.location.pathname + "?shareId=" + gistId : "");
    if (!urlToCopy) {
      Toast.error(t("no_share_link_available"));
      return;
    }
    
    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => {
        Toast.success(t("copied_to_clipboard"));
      })
      .catch(() => {
        Toast.error(t("oops_smth_went_wrong"));
      });
  };

  if (loading)
    return (
      <div className="text-blue-500 text-center">
        <Spin size="large" />
        <div className="mt-2">{t("generating_share_link")}</div>
      </div>
    );

  if (error) {
    return (
      <div>
        <Banner
          type="danger"
          description={error.message || t("oops_smth_went_wrong")}
        />
        <div className="mt-4 flex gap-2">
          <Button onClick={() => setModal(MODAL.NONE)}>
            {t("close")}
          </Button>
          <Button type="primary" onClick={() => window.location.reload()}>
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">{t("share_link")}</div>
        <div className="flex gap-2">
          <Input
            value={shareUrl || (gistId ? window.location.origin + window.location.pathname + "?shareId=" + gistId : "")}
            readOnly
            suffix={<IconLink />}
          />
          <Button onClick={copyLink}>{t("copy")}</Button>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button onClick={() => setModal(MODAL.NONE)}>
          {t("close")}
        </Button>
        <Button type="danger" onClick={unshare}>
          {t("unshare")}
        </Button>
      </div>
    </div>
  );
}
