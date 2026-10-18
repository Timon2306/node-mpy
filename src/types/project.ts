import { Edge, Node } from '@xyflow/react';
import { NodeInstanceData } from './nodes';
import { LibraryPackageJSON } from './registry';

export interface FlowTab {
  id: string;
  name: string;
  nodes: Node<NodeInstanceData>[];
  edges: Edge[];
}

export interface NodeTealProject {
  formatVersion: '1.0';
  appName: 'Node-TEAL';
  projectName: string;
  createdAt: string;
  updatedAt: string;
  flows?: FlowTab[];
  activeFlowId?: string;
  nodes: Node<NodeInstanceData>[];
  edges: Edge[];
  customLibraries?: LibraryPackageJSON[]; // User-imported libraries saved with the project
}
