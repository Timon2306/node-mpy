export type Language = 'ru' | 'en';

export interface Translations {
  topbar: {
    projectNamePlaceholder: string;
    demoButton: string;
    demoTooltip: string;
    openButton: string;
    openTooltip: string;
    saveButton: string;
    saveTooltip: string;
    saveSchema: string;
    saveSchemaDesc: string;
    saveSvg: string;
    saveSvgDesc: string;
    savePng: string;
    savePngDesc: string;
    savePy: string;
    savePyDesc: string;
    copyJson: string;
    copyJsonDesc: string;
    schemaCopied: string;
    clearTooltip: string;
    clearConfirm: string;
    exportButton: string;
    exportSuccess: string;
    exportTooltip: string;
    managePalette: string;
    managePaletteDesc: string;
    shortcuts: string;
    about: string;
    docs?: string;
  };
  palette: {
    searchPlaceholder: string;
    activeModules: string;
    paletteButton: string;
    noNodesFound: string;
    categories: Record<string, string>;
  };
  inspector: {
    propertiesTab: string;
    codeTab: string;
    parametersHeader: string;
    socketsHeader: string;
    noNodeSelected: string;
    noNodeSelectedSub: string;
    copyCode: string;
    copied: string;
    warningTitle: string;
    warningDesc: string;
    openFullEditor: string;
    noProperties: string;
    cleanMicropython: string;
    linesCount: string;
  };
  modals: {
    paletteTitle: string;
    tabLibraries: string;
    tabImport: string;
    tabAiPrompt: string;
    librariesDesc: string;
    nativeBadge: string;
    customBadge: string;
    driverBadge: string;
    deleteCustomConfirm: string;
    importJsonHeader: string;
    importJsonDesc: string;
    uploadFileLabel: string;
    pasteJsonLabel: string;
    importButton: string;
    aiPromptHeader: string;
    aiPromptStep1: string;
    aiPromptStep2: string;
    aiPromptStep3: string;
    copyPromptButton: string;
    promptCopied: string;
    shortcutsTitle: string;
    functionEditorTitle: string;
    functionNameLabel: string;
    functionParamsLabel: string;
    functionBodyLabel: string;
    saveButton: string;
    cancelButton: string;
  };
  shortcuts: Array<{ key: string; desc: string }>;
}

export const translations: Record<Language, Translations> = {
  ru: {
    topbar: {
      projectNamePlaceholder: 'Название проекта',
      demoButton: 'Демо',
      demoTooltip: 'Загрузить готовый демо-проект (DHT22 + OLED + while loop)',
      openButton: 'Открыть',
      openTooltip: 'Открыть проект (.nodempy.json)',
      saveButton: 'Сохранить',
      saveTooltip: 'Экспорт и сохранение схемы или кода',
      saveSchema: 'Схема проекта (.nodempy.json)',
      saveSchemaDesc: 'Полная структура со всеми нодами и связями',
      saveSvg: 'Векторная схема (.svg)',
      saveSvgDesc: 'Масштабируемый вектор для отчетов и схем',
      savePng: 'Изображение схемы (.png)',
      savePngDesc: 'Растровый снимок холста (Hi-Res)',
      savePy: 'Скрипт MicroPython (main.py)',
      savePyDesc: 'Чистый исполняемый код для платы',
      copyJson: 'Скопировать JSON схемы',
      copyJsonDesc: 'В буфер обмена без создания файла',
      schemaCopied: 'JSON схемы скопирован в буфер обмена!',
      clearTooltip: 'Очистить холст',
      clearConfirm: 'Очистить весь холст? Все несохраненные блоки будут удалены.',
      exportButton: 'Export main.py',
      exportSuccess: 'Сохранено!',
      exportTooltip: 'Сгенерировать и экспортировать файл main.py для контроллера',
      managePalette: 'Управление палитрой',
      managePaletteDesc: 'Импорт библиотек и нод (JSON)',
      shortcuts: 'Горячие клавиши',
      about: 'О программе',
    },
    palette: {
      searchPlaceholder: 'Поиск нод...',
      activeModules: 'Активно модулей:',
      paletteButton: 'Палитра',
      noNodesFound: 'Ничего не найдено. Перетащите ноду Import Module для разблокировки других модулей.',
      categories: {
        Core: 'Core (Логика и Структура)',
        Hardware: 'Hardware (Аппаратная часть)',
        Displays: 'Displays (Дисплеи и Экраны)',
        Sensors: 'Sensors (Датчики)',
        Actuators: 'Actuators (Сервоприводы и Моторы)',
        Timing: 'Timing (Тайминги и Задержки)',
        Network: 'Network (Wi-Fi и Сеть)',
        Lighting: 'Lighting (Адресные LED)',
        Dashboard: 'Dashboard (Интерфейс и Виджеты)',
      },
    },
    inspector: {
      propertiesTab: 'Свойства ноды',
      codeTab: 'Live main.py',
      parametersHeader: 'Параметры',
      socketsHeader: 'Разъёмы (Сокеты)',
      noNodeSelected: 'Нода не выбрана',
      noNodeSelectedSub: 'Кликните по любой ноде на холсте для настройки её пинов, адресов и параметров.',
      copyCode: 'Копировать',
      copied: 'Скопировано!',
      warningTitle: 'Внимание!',
      warningDesc: 'Модуль не добавлен на холст через ноду Import Module. Код может не выполниться на плате!',
      openFullEditor: 'Открыть в полном редакторе',
      noProperties: 'У этой ноды нет настраиваемых параметров.',
      cleanMicropython: 'Чистый MicroPython',
      linesCount: 'строк',
    },
    modals: {
      paletteTitle: 'Управление палитрой библиотек',
      tabLibraries: 'Библиотеки',
      tabImport: 'Импорт JSON',
      tabAiPrompt: 'Промпт для ИИ',
      librariesDesc: 'Все модули описаны в декларативном формате JSON. Чтобы использовать ноды библиотеки на холсте, добавьте блок Import Module.',
      nativeBadge: 'Встроенная',
      customBadge: 'Пользовательская',
      driverBadge: 'Драйвер /lib',
      deleteCustomConfirm: 'Удалить эту пользовательскую библиотеку из палитры?',
      importJsonHeader: 'Импорт новых нод через JSON:',
      importJsonDesc: 'Вы можете добавить любые датчики, дисплеи или моторы, просто загрузив JSON-файл или вставив его текст ниже. Схема не требует правок исходного кода приложения.',
      uploadFileLabel: 'Загрузить файл (.json)',
      pasteJsonLabel: 'Или вставьте JSON код пакета нод:',
      importButton: 'Импортировать в палитру',
      aiPromptHeader: 'Как автоматически создать ноды через любую нейросеть:',
      aiPromptStep1: '1. Нажмите кнопку «Скопировать промпт» ниже.',
      aiPromptStep2: '2. Откройте любую нейросеть (ChatGPT, Claude, DeepSeek) и прикрепите скопированный промпт вместе со своим .py файлом библиотеки.',
      aiPromptStep3: '3. Скопируйте сгенерированный нейросетью JSON и вставьте во вкладку «Импорт JSON».',
      copyPromptButton: 'Скопировать промпт',
      promptCopied: 'Скопировано!',
      shortcutsTitle: 'Горячие клавиши и управление',
      functionEditorTitle: 'Редактор пользовательской функции',
      functionNameLabel: 'Имя функции (def)',
      functionParamsLabel: 'Параметры (через запятую)',
      functionBodyLabel: 'Тело функции (Python код, отступ 4 пробела)',
      saveButton: 'Сохранить',
      cancelButton: 'Отмена',
    },
    shortcuts: [
      { key: 'Delete / Backspace', desc: 'Удалить выбранные ноды и соединения с холста' },
      { key: 'Ctrl + Z', desc: 'Отменить последнее действие (Undo)' },
      { key: 'Ctrl + Y / Ctrl + Shift + Z', desc: 'Повторить отмененное действие (Redo)' },
      { key: 'Ctrl + A', desc: 'Выделить все ноды на активной вкладке' },
      { key: 'Ctrl + C', desc: 'Копировать выделенную ноду в буфер' },
      { key: 'Ctrl + V', desc: 'Вставить ноду из буфера на холст' },
      { key: 'Ctrl + D', desc: 'Быстро дублировать выделенную ноду' },
      { key: 'ПКМ по ноде', desc: 'Контекстное меню действий (Копировать, Дублировать, Удалить...)' },
      { key: 'Двойной клик по вкладке Flow', desc: 'Переименовать вкладку потока' },
      { key: 'ЛКМ (клик по ноде)', desc: 'Выбрать ноду и открыть её параметры' },
      { key: 'ЛКМ (клик по пустому месту)', desc: 'Снять выделение с ноды' },
      { key: 'Зажатие Пробела / Колёсика', desc: 'Панорамирование (перемещение по холсту)' },
      { key: 'Колёсико мыши', desc: 'Масштабирование холста (Zoom In / Out)' },
      { key: 'Перетаскивание из палитры', desc: 'Добавление новой ноды на холст' },
    ],
  },
  en: {
    topbar: {
      projectNamePlaceholder: 'Project Name',
      demoButton: 'Demo',
      demoTooltip: 'Load preconfigured demo project (DHT22 + OLED + while loop)',
      openButton: 'Open',
      openTooltip: 'Open project (.nodempy.json)',
      saveButton: 'Save',
      saveTooltip: 'Export and save project schema or code',
      saveSchema: 'Project Schema (.nodempy.json)',
      saveSchemaDesc: 'Complete structure with all nodes and connections',
      saveSvg: 'Vector Diagram (.svg)',
      saveSvgDesc: 'Scalable vector graphic for reports & docs',
      savePng: 'Diagram Snapshot (.png)',
      savePngDesc: 'High-resolution raster screenshot',
      savePy: 'MicroPython Script (main.py)',
      savePyDesc: 'Clean executable code for the board',
      copyJson: 'Copy Schema JSON',
      copyJsonDesc: 'To clipboard without creating a file',
      schemaCopied: 'Schema JSON copied to clipboard!',
      clearTooltip: 'Clear Canvas',
      clearConfirm: 'Clear entire canvas? All unsaved blocks will be lost.',
      exportButton: 'Export main.py',
      exportSuccess: 'Saved!',
      exportTooltip: 'Generate and export main.py for microcontroller',
      managePalette: 'Manage Palette',
      managePaletteDesc: 'Import libraries and node packages (JSON)',
      shortcuts: 'Shortcuts',
      about: 'About',
      docs: 'MicroPython Documentation',
    },
    palette: {
      searchPlaceholder: 'Search nodes...',
      activeModules: 'Active modules:',
      paletteButton: 'Palette',
      noNodesFound: 'No nodes found. Drag an Import Module node to unlock other categories.',
      categories: {
        Core: 'Core (Logic & Flow)',
        Hardware: 'Hardware (Pins & Buses)',
        Displays: 'Displays & Screens',
        Sensors: 'Sensors',
        Actuators: 'Actuators (Servos & Motors)',
        Timing: 'Timing & Delays',
        Network: 'Network (Wi-Fi)',
        Lighting: 'Lighting (NeoPixel LEDs)',
        Dashboard: 'Dashboard (UI Widgets)',
      },
    },
    inspector: {
      propertiesTab: 'Properties',
      codeTab: 'Live main.py',
      parametersHeader: 'Parameters',
      socketsHeader: 'Sockets (Handles)',
      noNodeSelected: 'No node selected',
      noNodeSelectedSub: 'Click on any node on the canvas to configure its pins, addresses, and parameters.',
      copyCode: 'Copy',
      copied: 'Copied!',
      warningTitle: 'Warning!',
      warningDesc: 'Module not added to canvas via Import Module. Code may fail on board!',
      openFullEditor: 'Open in Full Editor',
      noProperties: 'This node has no configurable properties.',
      cleanMicropython: 'Clean MicroPython',
      linesCount: 'lines',
    },
    modals: {
      paletteTitle: 'Manage Library Palette',
      tabLibraries: 'Libraries',
      tabImport: 'Import JSON',
      tabAiPrompt: 'AI Prompt',
      librariesDesc: 'All modules are declaratively defined in JSON format. To use a library on the canvas, add an Import Module block.',
      nativeBadge: 'Native',
      customBadge: 'Custom',
      driverBadge: 'Driver /lib',
      deleteCustomConfirm: 'Delete this custom library from palette?',
      importJsonHeader: 'Import new nodes via JSON:',
      importJsonDesc: 'You can add any sensors, displays, or actuators by uploading a JSON file or pasting JSON below. No app source code edits required.',
      uploadFileLabel: 'Upload file (.json)',
      pasteJsonLabel: 'Or paste node package JSON:',
      importButton: 'Import to Palette',
      aiPromptHeader: 'How to auto-generate nodes using any AI:',
      aiPromptStep1: '1. Click "Copy Prompt" below.',
      aiPromptStep2: '2. Open any LLM (ChatGPT, Claude, DeepSeek) and paste the prompt along with your .py driver file.',
      aiPromptStep3: '3. Copy the resulting JSON and paste it into the "Import JSON" tab.',
      copyPromptButton: 'Copy Prompt',
      promptCopied: 'Copied!',
      shortcutsTitle: 'Keyboard Shortcuts & Navigation',
      functionEditorTitle: 'Custom Function Editor',
      functionNameLabel: 'Function Name (def)',
      functionParamsLabel: 'Parameters (comma-separated)',
      functionBodyLabel: 'Function Body (Python code, 4-space indent)',
      saveButton: 'Save',
      cancelButton: 'Cancel',
    },
    shortcuts: [
      { key: 'Delete / Backspace', desc: 'Delete selected nodes and edges from canvas' },
      { key: 'Ctrl + Z', desc: 'Undo last action' },
      { key: 'Ctrl + Y / Ctrl + Shift + Z', desc: 'Redo action' },
      { key: 'Ctrl + C', desc: 'Copy selected node to clipboard' },
      { key: 'Ctrl + V', desc: 'Paste node from clipboard to canvas' },
      { key: 'Ctrl + D', desc: 'Duplicate selected node' },
      { key: 'RMB on Node', desc: 'Context menu (Copy, Duplicate, Delete, Properties...)' },
      { key: 'Double Click Flow Tab', desc: 'Rename flow tab' },
      { key: 'LMB (click node)', desc: 'Select node and view properties' },
      { key: 'LMB (click canvas)', desc: 'Deselect current node' },
      { key: 'Hold Space / Wheel Drag', desc: 'Pan canvas workspace' },
      { key: 'Mouse Wheel', desc: 'Zoom In / Out' },
      { key: 'Drag from Palette', desc: 'Add new node to canvas' },
    ],
  },
};
