# Changelog — Node-TEAL

All notable changes to this project will be documented in this file.

## [1.0.0] — 2026-10-18 (Official First Release)

### 🚀 Highlights
- **Visual Flow Programming Studio for MicroPython**: Designed in the aesthetic of Node-RED for ESP8266, ESP32, Raspberry Pi Pico, and compatible boards.
- **79 Pre-packaged Nodes across 12 Libraries**:
  - **Core (19 nodes)**: Start/Init, While Loop, For Range Loop, If/Else, Comparison, Math Operation, Math Functions (abs, round, sqrt, min, max, pow), Map Range, Print to Console, Set Variable, Get Variable, Value/Constant, Custom Function, Logic Gates (AND/OR/NOT), String Formatter, Random Number, Type Cast, Comments.
  - **Hardware & GPIO (19 nodes)**: Pin Init, Pin Write, Pin Read, Pin Toggle, Pin Is Active, ADC Init/Read, PWM Init/Freq/Duty/Deinit, Tone Buzzer, I2C Init/Scan, SPI Init, UART Init, Hardware Timer Init/Deinit, Deep Sleep.
  - **Timing (7 nodes)**: Sleep (sec/ms/us), Ticks MS/US, Ticks Diff, Ticks Add.
  - **Network (5 nodes)**: Wi-Fi STA Connect, Access Point Create, Connection Status, IP Config (`ifconfig`), Disconnect.
  - **Displays (14 nodes)**: SSD1306 OLED (Init, Clear, Text, Line, Pixel, Rect, Show), ST7735 SPI Color TFT, MAX7219 8x8 LED Matrix, I2C 1602/2004 LCD.
  - **Sensors (4 nodes)**: DHT11/DHT22 (Temperature & Humidity), BMP280 (Temperature, Pressure & Altitude).
  - **Actuators & Lighting (8 nodes)**: Servo Motor Controller, WS2812 NeoPixel Addressable LEDs.

### ⚡ Interactive Hardware Simulator
- **Live Interactive GPIO Pins**: Clickable GPIO indicators (`G0`, `G4`, `G5`, `G12`, `G14`, `D4`) to toggle pin voltages in real-time during live simulation.
- **Crash-Proof Execution Engine**: Universal safe fallback handlers for custom JSON-defined nodes, division-by-zero protection, and step throttling.
- **Real-Time Canvas Step Tracing**: Visual highlighting of active and error nodes during simulation execution.

### 🛠️ MicroPython Compiler Engine
- **Deterministic 4-Section Python Generation**: `1. IMPORTS`, `2. HARDWARE & INIT`, `3. FUNCTIONS & CALLBACKS`, `4. MAIN EXECUTION & LOOP`.
- **Topological Dependency Ordering**: Kahn's algorithm resolves object instantiation order (e.g. Pin $\rightarrow$ I2C Bus $\rightarrow$ OLED Screen).
- **Smart Data-Node Resolution**: Recursive expression emission guarantees required variable values exist before flow statements execute.
- **MicroPython Port Compatibility**: Interchangeable `number` $\leftrightarrow$ `boolean` and `any` connections for Python truthiness.

### 🖥️ Native Cross-Platform Desktop (Tauri v2)
- Clean native desktop binaries for Windows (`.exe` standalone and NSIS installer), Linux (`.AppImage`, `.deb`), and macOS (`.dmg`).
- Native File Save/Open dialogs with fallback web browser Blob download.
- Full GitHub Actions automated multi-platform build pipeline.
