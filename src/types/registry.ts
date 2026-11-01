import { NodeDefinition } from './nodes';

export interface LibraryPackageJSON {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  isNative: boolean;
  category: string;
  color: string;
  icon: string;
  importSnippet: string;
  nodes: NodeDefinition[];
}

export interface PaletteCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  isUnlocked: boolean;
  nodes: NodeDefinition[];
}
