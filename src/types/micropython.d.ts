declare module '@webreflection/micropython-webassembly-pyscript' {
  export interface MicroPythonOptions {
    pystack?: number;
    heapsize?: number;
    url?: string;
    stdin?: (c: number) => number;
    stdout?: (line: string) => void;
    stderr?: (line: string) => void;
    linebuffer?: boolean;
  }

  export interface MicroPythonInstance {
    _module: any;
    PyProxy: any;
    FS: any;
    globals: any;
    registerJsModule: (name: string, module: Record<string, any>) => void;
    pyimport: (name: string) => any;
    runPython: (code: string) => any;
    runPythonAsync: (code: string) => Promise<any>;
    replInit: () => void;
    replProcessChar: (c: number) => void;
  }

  export function loadMicroPython(options?: MicroPythonOptions): Promise<MicroPythonInstance>;
  export default function _createMicroPythonModule(moduleArg?: any): Promise<any>;
}

declare module '@webreflection/micropython-webassembly-pyscript/wasm?url' {
  const src: string;
  export default src;
}

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

