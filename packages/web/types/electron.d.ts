export {};

declare global {
  interface Window {
    electronAPI?: {
      getPiPath: () => Promise<string | null>;
      openFolderDialog: () => Promise<string | null>;
      platform: string;
      isElectron: boolean;
    };
  }
}
