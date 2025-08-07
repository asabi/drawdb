import { createContext, useEffect, useState } from "react";
import { tableWidth } from "../data/constants";

const defaultSettings = {
  strictMode: false,
  showFieldSummary: true,
  showGrid: true,
  snapToGrid: false,
  showDataTypes: true,
  mode: "light",
  autosave: true,
  showCardinality: true,
  showRelationshipLabels: true,
  tableWidth: tableWidth,
  showDebugCoordinates: false,
  autoUpdateOnCollaboration: true,
};

export const SettingsContext = createContext(defaultSettings);

export default function SettingsContextProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error('Error parsing settings from localStorage:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    document.body.setAttribute("theme-mode", settings.mode);
  }, [settings.mode]);

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}
