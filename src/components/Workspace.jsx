import { useState, useEffect, useCallback, createContext, useRef, useMemo } from "react";
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
import { socketService } from "../api/socket";

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
  const [isReloading, setIsReloading] = useState(false);
  const [isUpdatingFromCollaboration, setIsUpdatingFromCollaboration] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [recentDatabaseSwitch, setRecentDatabaseSwitch] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const { layout } = useLayout();
  const { settings, isLoaded } = useSettings();
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

  // Track last-saved content signature to prevent redundant autosaves
  const lastSavedSignatureRef = useRef("");
  const autosaveTimerRef = useRef(null);

  const contentSignature = useMemo(() => {
    try {
      return JSON.stringify({
        title,
        tables,
        relationships,
        notes,
        areas,
        tasks,
        transform,
        database,
      });
    } catch (err) {
      return "";
    }
  }, [title, tables, relationships, notes, areas, tasks, transform, database]);

  // Determine if the current diagram has been persisted at least once
  const isPersisted = (() => {
    const hasId = (typeof id === 'string' && id.length > 0) || (typeof id === 'number' && id > 0);
    return hasId;
  })();

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

  // Socket.IO real-time collaboration setup
  useEffect(() => {
    // Connect to Socket.IO when backend is available
    if (backendAvailable && useBackendStorage) {
      console.log('Setting up Socket.IO for real-time collaboration...');
      socketService.connect();
      
                        // Set up diagram update listener
                  socketService.onDiagramUpdate((data) => {
                    const currentSocketId = socketService.getConnectionStatus().socketId;
                    console.log('📡 Received real-time update for diagram:', data.diagramId);
                    console.log('📡 Update from client:', data.updatedBy);
                    console.log('📡 Current client socket ID:', currentSocketId);
                    console.log('📡 Full update data:', data);
                    
                    // Only process if the update is from another client (not from ourselves)
                    if (data.updatedBy && data.updatedBy !== currentSocketId) {
                      console.log('✅ Update is from another user');
                      console.log('🔧 Auto-update setting value:', settings.autoUpdateOnCollaboration);
                      console.log('🔧 Auto-update setting type:', typeof settings.autoUpdateOnCollaboration);
                      console.log('🔧 Settings loaded:', isLoaded);
                      console.log('🔧 Full settings object:', settings);
                      
                      // Check if auto-update is enabled (explicit boolean check)
                      // Only proceed if settings are loaded
                      const shouldAutoUpdate = isLoaded && settings.autoUpdateOnCollaboration === true;
                      console.log('🔧 Should auto-update:', shouldAutoUpdate);
                      console.log('🔧 Settings loaded check:', isLoaded);
                      
                      if (shouldAutoUpdate) {
                        console.log('🔄 Auto-update enabled, updating automatically');
                        
                        // Show updating indicator
                        setIsUpdatingFromCollaboration(true);
                        
                        // Auto-update the diagram
                        const updateDiagram = async () => {
                          try {
                            // Set reloading flag to prevent Socket.IO emissions
                            setIsReloading(true);
                            console.log('🔄 Setting isReloading flag to prevent Socket.IO emissions');
                            
                            // Force reload the diagram from backend
                            console.log('🔄 Auto-updating diagram...');
                            
                            if (useBackendStorage && backendAvailable) {
                              console.log('🔄 Loading from backend...');
                              const diagram = await getDiagram(data.diagramId);
                              if (diagram) {
                                console.log('✅ Diagram auto-updated from backend:', diagram.id);
                                setDatabase(diagram.databaseType);
                                setSelectedDb(diagram.databaseType);
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
                                console.log('✅ Diagram auto-updated successfully');
                              }
                            } else {
                              console.log('❌ Backend not available, cannot auto-update');
                            }
                          } catch (error) {
                            console.error('❌ Error auto-updating diagram:', error);
                          } finally {
                            // Clear reloading flag after a short delay to allow state updates to complete
                            setTimeout(() => {
                              setIsReloading(false);
                              console.log('🔄 Cleared isReloading flag');
                            }, 1000);
                            
                            // Hide updating indicator after a brief delay
                            setTimeout(() => {
                              setIsUpdatingFromCollaboration(false);
                            }, 2000);
                          }
                        };
                        
                        updateDiagram();
                      } else {
                        console.log('📋 Auto-update disabled, showing notification');
                        
                        // Show notification to user (manual update)
                        Modal.info({
                          title: t('diagram_updated'),
                          content: t('diagram_updated_by_another_user'),
                          okText: t('reload'),
                          cancelText: t('cancel'),
                          onOk: async () => {
                            // Reload the diagram
                            console.log('🔄 Reload button clicked');
                            console.log('📋 Update diagram ID:', data.diagramId);
                            console.log('📋 Current diagram ID:', id);
                            console.log('📋 Window name:', window.name);
                            
                            try {
                              // Set reloading flag to prevent Socket.IO emissions
                              setIsReloading(true);
                              console.log('🔄 Setting isReloading flag to prevent Socket.IO emissions');
                              
                              // Force reload the diagram from backend
                              console.log('🔄 Attempting to reload diagram...');
                              
                              if (useBackendStorage && backendAvailable) {
                                console.log('🔄 Loading from backend...');
                                const diagram = await getDiagram(data.diagramId);
                                if (diagram) {
                                  console.log('✅ Diagram loaded from backend:', diagram.id);
                                  setDatabase(diagram.databaseType);
                                  setSelectedDb(diagram.databaseType);
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
                                  console.log('✅ Diagram reloaded successfully');
                                }
                              } else {
                                console.log('❌ Backend not available, cannot reload');
                              }
                            } catch (error) {
                              console.error('❌ Error reloading diagram:', error);
                            } finally {
                              // Clear reloading flag after a short delay to allow state updates to complete
                              setTimeout(() => {
                                setIsReloading(false);
                                console.log('🔄 Cleared isReloading flag');
                              }, 1000);
                            }
                          }
                        });
                      }
                    } else {
                      console.log('❌ Update is from current user or missing updatedBy, ignoring notification');
                    }
                  });

      // Cleanup on unmount
      return () => {
        socketService.offDiagramUpdate();
        socketService.disconnect();
      };
    }
  }, [backendAvailable, useBackendStorage]);

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
    console.log('Save operation:', { name: window.name, op, saveAsDiagram, currentId: id });

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

          const isTemplateSave = op === 'lt';
          const hasNoDiagramId = id === 0 || id === '' || id === null || typeof id === 'undefined';
          const isNewDiagram = hasNoDiagramId || window.name === '';
          console.log('Save path decision:', { isTemplateSave, hasNoDiagramId, isNewDiagram, id, windowName: window.name });

          if (isTemplateSave || isNewDiagram) {
            // Create new diagram
            console.log('Creating new diagram with backend');
            const result = await createDiagram(title, database, diagramContent);
            console.log('✅ Diagram created successfully:', result);
            setId(result.id);
            window.name = `d ${result.id}`;
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
            console.log('🔒 Save state set to SAVED after creating new diagram');
            // Record last saved signature
            lastSavedSignatureRef.current = contentSignature;
            // Ensure autosave is enabled for subsequent edits after first create
            setIsInitialLoad(false);
            setJustCreated(true);
            
            // Emit real-time update to other clients (only if not reloading)
            if (!isReloading) {
              socketService.joinDiagram(result.id);
              socketService.emitDiagramUpdate(result.id, { action: 'created', title });
            } else {
              console.log('🔄 Skipping Socket.IO emission during reload');
            }
          } else {
            // Update existing diagram
            console.log('Updating existing diagram with backend, id:', id);
            try {
              await updateDiagram(id, title, database, diagramContent);
              console.log('✅ Diagram updated successfully');
              setSaveState(State.SAVED);
              setLastSaved(new Date().toLocaleString());
              console.log('🔒 Save state set to SAVED after updating existing diagram');
              lastSavedSignatureRef.current = contentSignature;
              
              // Emit real-time update to other clients (only if not reloading)
              if (!isReloading) {
                socketService.joinDiagram(id);
                socketService.emitDiagramUpdate(id, { action: 'updated', title });
              } else {
                console.log('🔄 Skipping Socket.IO emission during reload');
              }
            } catch (error) {
              if (error.response?.status === 404) {
                // Diagram doesn't exist in backend, create it instead
                console.log('Diagram not found in backend, creating new one');
                const result = await createDiagram(title, database, diagramContent);
                console.log('✅ Diagram created successfully (fallback):', result);
                setId(result.id);
                window.name = `d ${result.id}`;
                setSaveState(State.SAVED);
                setLastSaved(new Date().toLocaleString());
                console.log('🔒 Save state set to SAVED after creating fallback diagram');
                lastSavedSignatureRef.current = contentSignature;
                setIsInitialLoad(false);
                
                // Emit real-time update to other clients (only if not reloading)
                if (!isReloading) {
                  socketService.joinDiagram(result.id);
                  socketService.emitDiagramUpdate(result.id, { action: 'created', title });
                } else {
                  console.log('🔄 Skipping Socket.IO emission during reload');
                }
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
                console.log('🔒 Save state set to SAVED after local storage create');
                lastSavedSignatureRef.current = contentSignature;
                setIsInitialLoad(false);
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
                console.log('🔒 Save state set to SAVED after local storage update');
                lastSavedSignatureRef.current = contentSignature;
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
        
        // Assign window.name BEFORE setting state to avoid autosave creating a new diagram
        window.name = `d ${diagram.id}`;
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
        setIsLoadingDiagram(false);
        setTimeout(() => setIsInitialLoad(false), 500);
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
              window.name = `d ${fullDiagram.id}`;
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
            // Ensure the database picker modal is closed if it was open
            setShowSelectDbModal(false);
            setIsLoadingDiagram(false);
              setTimeout(() => setIsInitialLoad(false), 500);
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
          setTimeout(() => setIsInitialLoad(false), 500);
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadDiagram = async (id) => {
      console.log('🔄 loadDiagram called with id:', id);
      setIsLoadingDiagram(true);
      if (useBackendStorage && backendAvailable) {
        // Try to load from backend first
        try {
          console.log('Loading diagram from backend, id:', id);
          const diagram = await getDiagram(id);
          if (diagram) {
            // Assign window.name BEFORE setting state to avoid autosave creating a new diagram
            window.name = `d ${diagram.id}`;
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
            setIsLoadingDiagram(false);
            setTimeout(() => setIsInitialLoad(false), 500);
            console.log('✅ Diagram loaded successfully from backend');
            console.log('📊 Loaded diagram data:', {
              id: diagram.id,
              title: diagram.title,
              tablesCount: diagram.content.tables?.length || 0,
              relationshipsCount: diagram.content.relationships?.length || 0
            });
            
            // Join Socket.IO room for real-time collaboration
            socketService.joinDiagram(diagram.id);
            return;
          }
        } catch (error) {
          console.log('Backend load failed, falling back to local storage:', error.message);
        }
      }
      
      // Fallback to local storage (Dexie uses numeric ids). Convert if numeric-like.
      const localId = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
      await db.diagrams
        .get(localId)
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
            
            // Join Socket.IO room for real-time collaboration (local storage fallback)
            socketService.joinDiagram(diagram.id);
          } else {
            window.name = "";
          }
          setIsLoadingDiagram(false);
          setTimeout(() => setIsInitialLoad(false), 500);
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
      // Keep id as string (backend uses string ids); only cast to number for Dexie when needed
      const id = name[1];
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
    setSaveState,
    searchParams,
    useBackendStorage,
    backendAvailable,
  ]);

  useEffect(() => {
    // Trigger autosave whenever content changes and autosave is enabled

    // Only autosave if the diagram has been persisted at least once
    if (!isPersisted) return;

    // Don't autosave during initial load or while a save is in progress
    if (isInitialLoad || saveState === State.SAVING) return;

    // Don't autosave if we're currently loading a diagram
    if (isLoadingDiagram) return;

    // Don't autosave immediately after database switching
    if (recentDatabaseSwitch) {
      console.log('⏸️ Skipping autosave due to recent database switch');
      return;
    }

    if (settings.autosave) {
      // Only autosave when content changed compared to last saved state
      if (contentSignature === lastSavedSignatureRef.current) return;
      // Debounce autosave
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        console.log('🔄 Triggering autosave due to content changes');
        setSaveState(State.SAVING);
      }, 800);
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
    transform.pan?.x,
    transform.pan?.y,
    title,
    gistId,
    isPersisted,
    setSaveState,
    isInitialLoad,
    saveState,
    isLoadingDiagram,
    recentDatabaseSwitch,
    contentSignature,
  ]);

  useEffect(() => {
    if (saveState === State.SAVING) {
      save();
    }
  }, [saveState, save]);

  // Clear the justCreated flag after the first content change following creation
  useEffect(() => {
    if (!justCreated) return;
    // If content differs from the saved signature, allow autosave as normal
    if (contentSignature !== lastSavedSignatureRef.current) {
      setJustCreated(false);
    }
  }, [justCreated, contentSignature]);

  useEffect(() => {
    document.title = "Editor | drawDB";

    load();
  }, [load]);

  // Handle database connection changes
  useEffect(() => {
    const handleDatabaseChange = () => {
      console.log('🔄 Database connection changed, temporarily blocking autosave');
      
      // Set flag to prevent autosave immediately after database switch
      setRecentDatabaseSwitch(true);
      
      // Clear the flag after a short delay
      setTimeout(() => {
        setRecentDatabaseSwitch(false);
        console.log('✅ Database switch cooldown completed, autosave re-enabled');
      }, 2000); // 2 second cooldown
      
      // When database changes, preserve the current save state
      if (saveState === State.SAVED) {
        console.log('✅ Preserving SAVED state after database change');
      }
    };

    // Listen for database settings changes
    window.addEventListener('databaseSettingsChanged', handleDatabaseChange);
    
    return () => {
      window.removeEventListener('databaseSettingsChanged', handleDatabaseChange);
    };
  }, [saveState]);

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
          isUpdatingFromCollaboration={isUpdatingFromCollaboration}
          isPersisted={isPersisted}
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
