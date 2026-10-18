import { NodeDefinition } from './nodes';

export interface LibraryPackageJSON {
  id: string; // e.g. "machine", "ssd1306"
  name: string; // e.g. "Machine (Hardware)", "SSD1306 OLED"
  version: string;
  description: string;
  author?: string;
  isNative: boolean; // true for native MicroPython firmware libs, false for external .py
  category: string; // Category under which its nodes will appear
  color: string; // Category color strip on nodes
  icon: string; // Lucide icon name
  importSnippet: string; // e.g. "import machine" or "from ssd1306 import SSD1306_I2C"
  nodes: NodeDefinition[];
}

export interface PaletteCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  isUnlocked: boolean; // whether an Import Module node for this library is on the canvas
  nodes: NodeDefinition[];
}
