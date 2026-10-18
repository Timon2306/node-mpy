import { PortDefinition } from './ports';

export type PropertyFieldType = 'select' | 'number' | 'text' | 'boolean' | 'textarea' | 'code';

export interface PropertyOption {
  label: string;
  value: string | number | boolean;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyFieldType;
  label: string;
  defaultValue: any;
  options?: PropertyOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export type CodeSection = 'imports' | 'init' | 'functions' | 'flow' | 'loop';

export interface CodeTemplate {
  section: CodeSection;
  template: string;
  imports?: string[];
  outputVariables?: Record<string, string>; // Maps output port id to expression / variable name
}

export interface NodeDefinition {
  id: string;
  libraryId: string;
  label: string;
  category: string;
  color: string;
  icon: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  properties: PropertyDefinition[];
  codeTemplate: CodeTemplate;
}

export interface NodeInstanceData extends Record<string, unknown> {
  definitionId: string;
  libraryId: string;
  label: string;
  color: string;
  icon: string;
  properties: Record<string, any>;
  hasWarning?: boolean;
  warningMessage?: string;
  customCode?: string; // For custom functions
  [key: string]: unknown;
}

export interface ImportEntry {
  id?: string;
  module: string;
  import_all?: boolean;
  classes?: string;
  is_custom?: boolean;
}

export function extractImportsFromNode(properties: Record<string, any> | undefined): ImportEntry[] {
  if (!properties) return [];
  const result: ImportEntry[] = [];

  if (Array.isArray(properties.imports) && properties.imports.length > 0) {
    for (const item of properties.imports) {
      if (item && item.module) {
        result.push({
          id: item.id || `imp_${Math.random().toString(36).substring(2, 9)}`,
          module: String(item.module).trim(),
          import_all: item.import_all !== false,
          classes: item.classes ? String(item.classes).trim() : '',
          is_custom: !!item.is_custom,
        });
      }
    }
  } else if (properties.module) {
    result.push({
      id: 'default',
      module: String(properties.module).trim(),
      import_all: properties.import_all !== false,
      classes: properties.classes ? String(properties.classes).trim() : '',
      is_custom: !!properties.is_custom,
    });
  }

  return result;
}
