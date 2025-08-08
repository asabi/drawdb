import { MODAL } from "../data/constants";
import i18n from "../i18n/i18n";

export const getModalTitle = (modal) => {
  switch (modal) {
    case MODAL.IMG:
      return "Export as image";
    case MODAL.CODE:
      return "Export as code";
    case MODAL.IMPORT:
      return "Import diagram";
    case MODAL.RENAME:
      return "Rename diagram";
    case MODAL.OPEN:
      return "Open diagram";
    case MODAL.SAVEAS:
      return "Save as";
    case MODAL.NEW:
      return "New diagram";
    case MODAL.IMPORT_SRC:
      return "Import from SQL";
    case MODAL.TABLE_WIDTH:
      return "Set table width";
    case MODAL.LANGUAGE:
      return "Language";
    case MODAL.SHARE:
      return "Share";
    case MODAL.DATABASE_SETTINGS:
      return "Database Settings";
    default:
      return "";
  }
};

export const getModalWidth = (modal) => {
  switch (modal) {
    case MODAL.IMG:
      return 600;
    case MODAL.CODE:
      return 800;
    case MODAL.IMPORT:
      return 600;
    case MODAL.RENAME:
      return 400;
    case MODAL.OPEN:
      return 600;
    case MODAL.SAVEAS:
      return 400;
    case MODAL.NEW:
      return 600;
    case MODAL.IMPORT_SRC:
      return 800;
    case MODAL.TABLE_WIDTH:
      return 400;
    case MODAL.LANGUAGE:
      return 400;
    case MODAL.SHARE:
      return 600;
    case MODAL.DATABASE_SETTINGS:
      return 900;
    default:
      return 600;
  }
};

export const getOkText = (modal) => {
  switch (modal) {
    case MODAL.IMG:
      return "Export";
    case MODAL.CODE:
      return "Export";
    case MODAL.IMPORT:
      return "Import";
    case MODAL.RENAME:
      return "Rename";
    case MODAL.OPEN:
      return "Open";
    case MODAL.SAVEAS:
      return "Save";
    case MODAL.NEW:
      return "Create";
    case MODAL.IMPORT_SRC:
      return "Import";
    case MODAL.TABLE_WIDTH:
      return "Set";
    case MODAL.LANGUAGE:
      return "Set";
    case MODAL.SHARE:
      return "Share";
    case MODAL.DATABASE_SETTINGS:
      return "Save";
    default:
      return "OK";
  }
};
