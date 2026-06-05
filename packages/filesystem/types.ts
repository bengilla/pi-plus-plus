export type FileSourceType = "local" | "github" | "nas";

export interface FileSource {
  type: FileSourceType;
  label: string;
  path: string;
  repo?: string;
  branch?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface FileSystem {
  listFiles(source: FileSource): Promise<FileNode[]>;
  readFile(source: FileSource, filePath: string): Promise<string>;
  writeFile(source: FileSource, filePath: string, content: string): Promise<void>;
}
