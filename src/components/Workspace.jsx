import { useState, useEffect, useCallback, createContext } from "react";
import ControlPanel from "./EditorHeader/ControlPanel";
import Canvas from "./EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import SidePanel from "./EditorSidePanel/SidePanel";
import { DB, State } from "../data/constants";
import { db } from "../data/db";
import {
  useLayout,
  useSettings,
  useTransform,
  useDiagram,
  useUndoRedo,
  useAreas,
  useNotes,
  useTypes,
  useTasks,
  useSaveState,
  useEnums,
} from "../hooks";
import FloatingControls from "./FloatingControls";
import { Modal, Tag } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { databases } from "../data/databases";
import { isRtl } from "../i18n/utils/rtl";
import { useSearchParams } from "react-router-dom";
import { get } from "../api/gists";
import { createDiagram, updateDiagram, getDiagram, getRecentDiagrams, healthCheck } from "../api/diagrams";

export const IdContext = createContext({ gistId: "", setGistId: () => {} });

const SIDEPANEL_MIN_WIDTH = 384;

export default function WorkSpace() {
  const [id, setId] = useState(0);
  const [gistId, setGistId] = useState("");
  const [loadedFromGistId, setLoadedFromGistId] = useState("");
  const [title, setTitle] = useState("Untitled Diagram");
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [useBackendStorage, setUseBackendStorage] = useState(false);
  const [resize, setResize] = useState(false);
  const [width, setWidth] = useState(SIDEPANEL_MIN_WIDTH);
  const [lastSaved, setLastSaved] = useState("");
  const [showSelectDbModal, setShowSelectDbModal] = useState(false);
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);
  const [selectedDb, setSelectedDb] = useState("");
  const { layout } = useLayout();
  const { settings } = useSettings();
  const { types, setTypes } = useTypes();
  const { areas, setAreas } = useAreas();
  const { tasks, setTasks } = useTasks();
  const { notes, setNotes } = useNotes();
  const { saveState, setSaveState } = useSaveState();
  const { transform, setTransform } = useTransform();
  const { enums, setEnums } = useEnums();
  const {
    tables,
    relationships,
    setTables,
    setRelationships,
    database,
    setDatabase,
  } = useDiagram();
  const { undoStack, redoStack, setUndoStack, setRedoStack } = useUndoRedo();
  const { t, i18n } = useTranslation();
  let [searchParams, setSearchParams] = useSearchParams();

  // Check backend availability on component mount and periodically
  useEffect(() => {
    const checkBackend = async () => {
      console.log('Checking backend availability...');
      console.log('Current hostname:', window.location.hostname);
      console.log('Current URL:', window.location.href);
      
      // Try health check with retries
      let backendOk = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Health check attempt ${attempt}/3...`);
          const result = await healthCheck();
          console.log('Health check result:', result);
          backendOk = true;
          break;
        } catch (error) {
          console.log(`Health check attempt ${attempt} failed:`, error.message);
          if (attempt < 3) {
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (backendOk) {
        setBackendAvailable(true);
        setUseBackendStorage(true);
        console.log('✅ Backend is available, using database storage');
      } else {
        console.log('❌ Backend not available after 3 attempts, using local storage');
        setBackendAvailable(false);
        setUseBackendStorage(false);
      }
    };
    
    checkBackend();
    
    // Set up periodic health check every 30 seconds if backend is not available
    const interval = setInterval(() => {
      if (!backendAvailable) {
        console.log('Periodic health check...');
        checkBackend();
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [backendAvailable]);

  // Check for openFromDatabase parameter and trigger open modal
  useEffect(() => {
    const openFromDatabase = searchParams.get('openFromDatabase');
    if (openFromDatabase === 'true') {
      // Remove the parameter from URL
      searchParams.delete('openFromDatabase');
      setSearchParams(searchParams);
      
      // Trigger the open modal by dispatching a custom event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openFromDatabase'));
      }, 100); // Small delay to ensure everything is loaded
    }
  }, [searchParams, setSearchParams]);
  const handleResize = (e) => {
    if (!resize) return;
    const w = isRtl(i18n.language) ? window.innerWidth - e.clientX : e.clientX;
    if (w > SIDEPANEL_MIN_WIDTH) setWidth(w);
  };

  const save = useCallback(async () => {
    console.log('Save function called, saveState:', saveState, 'useBackendStorage:', useBackendStorage, 'backendAvailable:', backendAvailable);
    console.log('🔍 STORAGE MODE:', useBackendStorage && backendAvailable ? 'BACKEND DATABASE' : 'LOCAL STORAGE');
    if (saveState !== State.SAVING) return;

    const name = window.name.split(" ");
    const op = name[0];
    const saveAsDiagram = window.name === "" || op === "d" || op === "lt";
    console.log('Save operation:', { name: window.name, op, saveAsDiagram });

    if (saveAsDiagram) {
      searchParams.delete("shareId");
      setSearchParams(searchParams);
      
      try {
        if (useBackendStorage && backendAvailable) {
          console.log('Using backend storage for save');
          // Use backend storage
          const diagramContent = {
            tables: tables,
            relationships: relationships,
            notes: notes,
            areas: areas,
            tasks: tasks,
            transform: transform,
            ...(databases[database].hasEnums && { enums: enums }),
            ...(databases[database].hasTypes && { types: types }),
          };

          if ((id === 0 && window.name === "") || op === "lt") {
            // Create new diagram
            console.log('Creating new diagram with backend');
            const result = await createDiagram(title, database, diagramContent);
            console.log('Diagram created successfully:', result);
            setId(result.id);
            window.name = `d ${result.id}`;
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
          } else {
            // Update existing diagram
            console.log('Updating existing diagram with backend, id:', id);
            try {
              await updateDiagram(id, title, database, diagramContent);
              console.log('Diagram updated successfully');
              setSaveState(State.SAVED);
              setLastSaved(new Date().toLocaleString());
            } catch (error) {
              if (error.response?.status === 404) {
                // Diagram doesn't exist in backend, create it instead
                console.log('Diagram not found in backend, creating new one');
                const result = await createDiagram(title, database, diagramContent);
                console.log('Diagram created successfully:', result);
                setId(result.id);
                window.name = `d ${result.id}`;
                setSaveState(State.SAVED);
                setLastSaved(new Date().toLocaleString());
              } else {
                throw error;
              }
            }
          }
        } else {
          console.log('Using local storage for save (backend not available)');
          // Fallback to local storage
          if ((id === 0 && window.name === "") || op === "lt") {
            await db.diagrams
              .add({
                database: database,
                name: title,
                gistId: gistId ?? "",
                lastModified: new Date(),
                tables: tables,
                references: relationships,
                notes: notes,
                areas: areas,
                todos: tasks,
                pan: transform.pan,
                zoom: transform.zoom,
                loadedFromGistId: loadedFromGistId,
                ...(databases[database].hasEnums && { enums: enums }),
                ...(databases[database].hasTypes && { types: types }),
              })
              .then((id) => {
                setId(id);
                window.name = `d ${id}`;
                setSaveState(State.SAVED);
                setLastSaved(new Date().toLocaleString());
              });
          } else {
            await db.diagrams
              .update(id, {
                database: database,
                name: title,
                lastModified: new Date(),
                tables: tables,
                references: relationships,
                notes: notes,
                areas: areas,
                todos: tasks,
                gistId: gistId ?? "",
                pan: transform.pan,
                zoom: transform.zoom,
                loadedFromGistId: loadedFromGistId,
                ...(databases[database].hasEnums && { enums: enums }),
                ...(databases[database].hasTypes && { types: types }),
              })
              .then(() => {
                setSaveState(State.SAVED);
                setLastSaved(new Date().toLocaleString());
              });
          }
        }
      } catch (error) {
        console.error('Save error:', error);
        console.error('Save error details:', {
          useBackendStorage,
          backendAvailable,
          id,
          windowName: window.name,
          error: error.message
        });
        setSaveState(State.ERROR);
      }
    } else {
      // Templates always use local storage
      await db.templates
        .update(id, {
          database: database,
          title: title,
          tables: tables,
          relationships: relationships,
          notes: notes,
          subjectAreas: areas,
          todos: tasks,
          pan: transform.pan,
          zoom: transform.zoom,
          ...(databases[database].hasEnums && { enums: enums }),
          ...(databases[database].hasTypes && { types: types }),
        })
        .then(() => {
          setSaveState(State.SAVED);
          setLastSaved(new Date().toLocaleString());
        })
        .catch(() => {
          setSaveState(State.ERROR);
        });
    }
  }, [
    searchParams,
    setSearchParams,
    tables,
    relationships,
    notes,
    areas,
    types,
    title,
    id,
    tasks,
    transform,
    setSaveState,
    database,
    enums,
    gistId,
    loadedFromGistId,
    saveState,
    useBackendStorage,
    backendAvailable,
  ]);

  const load = useCallback(async () => {
    // Check for diagramId in URL (backend sharing)
    const diagramId = searchParams.get('diagramId');
    if (diagramId && useBackendStorage && backendAvailable) {
      setIsLoadingDiagram(true);
      try {
        console.log('Loading diagram from backend:', diagramId);
        const diagram = await getDiagram(diagramId);
        
        setDatabase(diagram.databaseType);
        setSelectedDb(diagram.databaseType); // Also set selectedDb to prevent modal from showing
        console.log('Diagram loaded from diagramId, setting selectedDb to:', diagram.databaseType);
        setId(diagram.id);
        setTitle(diagram.title);
        setTables(diagram.content.tables);
        setRelationships(diagram.content.relationships);
        setNotes(diagram.content.notes);
        setAreas(diagram.content.areas);
        setTasks(diagram.content.tasks ?? []);
        setTransform(diagram.content.transform);
        if (databases[diagram.databaseType].hasTypes) {
          setTypes(diagram.content.types ?? []);
        }
        if (databases[diagram.databaseType].hasEnums) {
          setEnums(diagram.content.enums ?? []);
        }
        window.name = `d ${diagram.id}`;
        setIsLoadingDiagram(false);
        return;
      } catch (error) {
        console.error('Failed to load diagram from backend:', error);
        setIsLoadingDiagram(false);
        // Fall back to local storage
      }
    }

    // Check for shareId in URL (legacy Gist sharing)
    const shareId = searchParams.get('shareId');
    if (shareId) {
      setIsLoadingDiagram(true);
      try {
        await loadFromGist(shareId);
        setIsLoadingDiagram(false);
      } catch (error) {
        setIsLoadingDiagram(false);
      }
      return;
    }

    const loadLatestDiagram = async () => {
      setIsLoadingDiagram(true);
      if (useBackendStorage && backendAvailable) {
        // Try to load from backend first
        try {
          console.log('Loading recent diagrams from backend...');
          const recentDiagrams = await getRecentDiagrams(1);
          if (recentDiagrams && recentDiagrams.length > 0) {
            const latestDiagram = recentDiagrams[0];
            console.log('Loading latest diagram from backend:', latestDiagram);
            
            // Load the full diagram data
            const fullDiagram = await getDiagram(latestDiagram.id);
            if (fullDiagram) {
              setDatabase(fullDiagram.databaseType);
              setSelectedDb(fullDiagram.databaseType); // Also set selectedDb to prevent modal from showing
              setId(fullDiagram.id);
              setTitle(fullDiagram.title);
              setTables(fullDiagram.content.tables || []);
              setRelationships(fullDiagram.content.relationships || []);
              setNotes(fullDiagram.content.notes || []);
              setAreas(fullDiagram.content.areas || []);
              setTasks(fullDiagram.content.tasks || []);
              setTransform(fullDiagram.content.transform || { pan: { x: 0, y: 0 }, zoom: 1 });
              if (databases[fullDiagram.databaseType]?.hasTypes) {
                setTypes(fullDiagram.content.types || []);
              }
              if (databases[fullDiagram.databaseType]?.hasEnums) {
                setEnums(fullDiagram.content.enums || []);
              }
                          window.name = `d ${fullDiagram.id}`;
            setIsLoadingDiagram(false);
            return;
          }
        } else {
          console.log('No diagrams found in backend');
          window.name = "";
          setIsLoadingDiagram(false);
          // Only show modal if no database is selected
          if (selectedDb === "") setShowSelectDbModal(true);
          return;
        }
        } catch (error) {
          console.log('Backend load failed, falling back to local storage:', error.message);
        }
      }
      
      // Fallback to local storage
      await db.diagrams
        .orderBy("lastModified")
        .last()
        .then((d) => {
          if (d) {
            if (d.database) {
              setDatabase(d.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(d.id);
            setGistId(d.gistId);
            setLoadedFromGistId(d.loadedFromGistId);
            setTitle(d.name);
            setTables(d.tables);
            setRelationships(d.references);
            setNotes(d.notes);
            setAreas(d.areas);
            setTasks(d.todos ?? []);
            setTransform({ pan: d.pan, zoom: d.zoom });
            if (databases[database].hasTypes) {
              setTypes(d.types ?? []);
            }
            if (databases[database].hasEnums) {
              setEnums(d.enums ?? []);
            }
            window.name = `d ${d.id}`;
          } else {
            window.name = "";
            // Only show modal if no database is selected, not loading a diagram, and no diagramId in URL
            if (selectedDb === "" && !isLoadingDiagram && !searchParams.get('diagramId')) {
              console.log('Showing modal: selectedDb is empty and not loading diagram');
              setShowSelectDbModal(true);
            }
          }
          setIsLoadingDiagram(false);
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadDiagram = async (id) => {
      setIsLoadingDiagram(true);
      if (useBackendStorage && backendAvailable) {
        // Try to load from backend first
        try {
          console.log('Loading diagram from backend, id:', id);
          const diagram = await getDiagram(id);
          if (diagram) {
            setDatabase(diagram.databaseType);
            setSelectedDb(diagram.databaseType); // Also set selectedDb to prevent modal from showing
            setId(diagram.id);
            setTitle(diagram.title);
            setTables(diagram.content.tables || []);
            setRelationships(diagram.content.relationships || []);
            setNotes(diagram.content.notes || []);
            setAreas(diagram.content.areas || []);
            setTasks(diagram.content.tasks || []);
            setTransform(diagram.content.transform || { pan: { x: 0, y: 0 }, zoom: 1 });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[diagram.databaseType]?.hasTypes) {
              setTypes(diagram.content.types || []);
            }
            if (databases[diagram.databaseType]?.hasEnums) {
              setEnums(diagram.content.enums || []);
            }
            window.name = `d ${diagram.id}`;
            setIsLoadingDiagram(false);
            console.log('Diagram loaded successfully from backend');
            return;
          }
        } catch (error) {
          console.log('Backend load failed, falling back to local storage:', error.message);
        }
      }
      
      // Fallback to local storage
      await db.diagrams
        .get(id)
        .then((diagram) => {
          if (diagram) {
            if (diagram.database) {
              setDatabase(diagram.database);
              setSelectedDb(diagram.database); // Also set selectedDb to prevent modal from showing
            } else {
              setDatabase(DB.GENERIC);
              setSelectedDb(DB.GENERIC); // Also set selectedDb to prevent modal from showing
            }
            setId(diagram.id);
            setGistId(diagram.gistId);
            setLoadedFromGistId(diagram.loadedFromGistId);
            setTitle(diagram.name);
            setTables(diagram.tables);
            setRelationships(diagram.references);
            setAreas(diagram.areas);
            setNotes(diagram.notes);
            setTasks(diagram.todos ?? []);
            setTransform({
              pan: diagram.pan,
              zoom: diagram.zoom,
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              setTypes(diagram.types ?? []);
            }
            if (databases[database].hasEnums) {
              setEnums(diagram.enums ?? []);
            }
            window.name = `d ${diagram.id}`;
          } else {
            window.name = "";
          }
          setIsLoadingDiagram(false);
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadTemplate = async (id) => {
      await db.templates
        .get(id)
        .then((diagram) => {
          if (diagram) {
            if (diagram.database) {
              setDatabase(diagram.database);
              setSelectedDb(diagram.database); // Also set selectedDb to prevent modal from showing
            } else {
              setDatabase(DB.GENERIC);
              setSelectedDb(DB.GENERIC); // Also set selectedDb to prevent modal from showing
            }
            setId(diagram.id);
            setTitle(diagram.title);
            setTables(diagram.tables);
            setRelationships(diagram.relationships);
            setAreas(diagram.subjectAreas);
            setTasks(diagram.todos ?? []);
            setNotes(diagram.notes);
            setTransform({
              zoom: 1,
              pan: { x: 0, y: 0 },
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              setTypes(diagram.types ?? []);
            }
            if (databases[database].hasEnums) {
              setEnums(diagram.enums ?? []);
            }
          } else {
            // Only show modal if no database is selected, not loading a diagram, and no diagramId in URL
            if (selectedDb === "" && !isLoadingDiagram && !searchParams.get('diagramId')) {
              console.log('Showing modal: selectedDb is empty and not loading diagram');
              setShowSelectDbModal(true);
            }
          }
        })
        .catch((error) => {
          console.log(error);
          setIsLoadingDiagram(false);
          // Only show modal if no database is selected, not loading a diagram, and no diagramId in URL
          if (selectedDb === "" && !isLoadingDiagram && !searchParams.get('diagramId')) setShowSelectDbModal(true);
        });
    };

    const loadFromGist = async (shareId) => {
      try {
        const res = await get(shareId);
        const diagramSrc = res.data.files["share.json"].content;
        const d = JSON.parse(diagramSrc);
        setGistId(shareId);
        setUndoStack([]);
        setRedoStack([]);
        setLoadedFromGistId(shareId);
        setDatabase(d.database);
        setSelectedDb(d.database); // Also set selectedDb to prevent modal from showing
        setTitle(d.title);
        setTables(d.tables);
        setRelationships(d.relationships);
        setNotes(d.notes);
        setAreas(d.subjectAreas);
        setTransform(d.transform);
        if (databases[d.database].hasTypes) {
          setTypes(d.types ?? []);
        }
        if (databases[d.database].hasEnums) {
          setEnums(d.enums ?? []);
        }
      } catch (e) {
        console.log(e);
        setSaveState(State.FAILED_TO_LOAD);
      }
    };



    if (window.name === "") {
      await loadLatestDiagram();
    } else {
      const name = window.name.split(" ");
      const op = name[0];
      const id = parseInt(name[1]);
      switch (op) {
        case "d": {
          await loadDiagram(id);
          break;
        }
        case "t":
        case "lt": {
          await loadTemplate(id);
          break;
        }
        default:
          break;
      }
    }
  }, [
    setTransform,
    setRedoStack,
    setUndoStack,
    setRelationships,
    setTables,
    setAreas,
    setNotes,
    setTypes,
    setTasks,
    setDatabase,
    database,
    setEnums,
    selectedDb,
    setSaveState,
    searchParams,
    useBackendStorage,
    backendAvailable,
  ]);

  useEffect(() => {
    if (
      tables?.length === 0 &&
      areas?.length === 0 &&
      notes?.length === 0 &&
      types?.length === 0 &&
      tasks?.length === 0
    )
      return;

    if (settings.autosave) {
      setSaveState(State.SAVING);
    }
  }, [
    undoStack,
    redoStack,
    settings.autosave,
    tables?.length,
    areas?.length,
    notes?.length,
    types?.length,
    relationships?.length,
    tasks?.length,
    transform.zoom,
    title,
    gistId,
    setSaveState,
  ]);

  useEffect(() => {
    save();
  }, [saveState, save]);

  useEffect(() => {
    document.title = "Editor | drawDB";

    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col overflow-hidden theme">
      <IdContext.Provider value={{ gistId, setGistId }}>
        <ControlPanel
          diagramId={id}
          setDiagramId={setId}
          title={title}
          setTitle={setTitle}
          lastSaved={lastSaved}
          setLastSaved={setLastSaved}
          useBackendStorage={useBackendStorage}
          backendAvailable={backendAvailable}
        />
      </IdContext.Provider>
      <div
        className="flex h-full overflow-y-auto"
        onPointerUp={(e) => e.isPrimary && setResize(false)}
        onPointerLeave={(e) => e.isPrimary && setResize(false)}
        onPointerMove={(e) => e.isPrimary && handleResize(e)}
        onPointerDown={(e) => {
          // Required for onPointerLeave to trigger when a touch pointer leaves
          // https://stackoverflow.com/a/70976017/1137077
          e.target.releasePointerCapture(e.pointerId);
        }}
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        {layout.sidebar && (
          <SidePanel resize={resize} setResize={setResize} width={width} />
        )}
        <div className="relative w-full h-full overflow-hidden">
          <CanvasContextProvider className="h-full w-full">
            <Canvas saveState={saveState} setSaveState={setSaveState} />
          </CanvasContextProvider>
          {!(layout.sidebar || layout.toolbar || layout.header) && (
            <div className="fixed right-5 bottom-4">
              <FloatingControls />
            </div>
          )}
        </div>
      </div>
      <Modal
        centered
        size="medium"
        closable={false}
        hasCancel={false}
        title={t("pick_db")}
        okText={t("confirm")}
        visible={showSelectDbModal && !isLoadingDiagram && !searchParams.get('diagramId')}
        onOk={() => {
          if (selectedDb === "") return;
          setDatabase(selectedDb);
          setShowSelectDbModal(false);
        }}
        okButtonProps={{ disabled: selectedDb === "" }}
      >
        <div className="grid grid-cols-3 gap-4 place-content-center">
          {Object.values(databases).map((x) => (
            <div
              key={x.name}
              onClick={() => setSelectedDb(x.label)}
              className={`space-y-3 p-3 rounded-md border-2 select-none ${
                settings.mode === "dark"
                  ? "bg-zinc-700 hover:bg-zinc-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              } ${selectedDb === x.label ? "border-zinc-400" : "border-transparent"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{x.name}</div>
                {x.beta && (
                  <Tag size="small" color="light-blue">
                    Beta
                  </Tag>
                )}
              </div>
              {x.image && (
                <img
                  src={x.image}
                  className="h-8"
                  style={{
                    filter:
                      "opacity(0.4) drop-shadow(0 0 0 white) drop-shadow(0 0 0 white)",
                  }}
                />
              )}
              <div className="text-xs">{x.description}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
