# Changelog — Node-MPY

All notable changes to this project will be documented in this file.

## [1.0.1] — 2026-10-18 (MicroPython WASM, IoT Nodes & GitHub Auto-Updater)

### 🚀 Highlights
- **Real MicroPython v1.26 WebAssembly VM**: Runs real compiled MicroPython bytecode in an isolated Web Worker without UI stutter. Full virtual `machine` (Pin, ADC, PWM, I2C, SPI), `network` and `time` modules.
- **Dual-Mode Simulator**: Instant 1-click toggle between **Visual Flow** (step-by-step canvas highlighting) and **MicroPython WASM VM** (real WebAssembly virtual processor).
- **HTTP GET & HTTP POST IoT Nodes**: Reverse-polling nodes for IoT projects (sends photoresistor ADC readings to Node-RED on PC and receives `/on` or `/off` response commands to toggle the onboard LED). Safe `try/except` wrappers and auto-import of `urequests` & `ujson`.
- **Cross-Platform GitHub Updates & Settings Modal**: Automatic OS detection (Windows `.exe`, Linux `.AppImage`, macOS `.dmg`) with 1-click update check and direct package download via GitHub Releases API.
- **Virtual Bus ACK**: Virtual I2C (`0x3C`, `0x27`) and SPI bus ACK prevents missing-hardware panics (`ENODEV`) while preserving clean Python runtime semantics.

## [1.0.0] — 2026-10-18 (Official First Release)

### 🚀 Highlights
- **Visual Flow Programming Studio for MicroPython**: Designed in the aesthetic of Node-RED for ESP8266, ESP32, Raspberry Pi Pico, and compatible boards.
- **81 Pre-packaged Nodes across 12 Libraries**:
  - **Core (19 nodes)**: Start/Init, While Loop, For Range Loop, If/Else, Comparison, Math Operation, Math Functions (abs, round, sqrt, min, max, pow), Map Range, Print to Console, Set Variable, Get Variable, Value/Constant, Custom Function, Logic Gates (AND/OR/NOT), String Formatter, Random Number, Type Cast, Comments.
  - **Hardware & GPIO (19 nodes)**: Pin Init, Pin Write, Pin Read, Pin Toggle, Pin Is Active, ADC Init/Read, PWM Init/Freq/Duty/Deinit, Tone Buzzer, I2C Init/Scan, SPI Init, UART Init, Hardware Timer Init/Deinit, Deep Sleep.
  - **Timing (7 nodes)**: Sleep (sec/ms/us), Ticks MS/US, Ticks Diff, Ticks Add.
  - **Network & IoT (7 nodes)**: Wi-Fi STA Connect, Access Point Create, Connection Status, IP Config (`ifconfig`), Disconnect, **HTTP GET** and **HTTP POST** (with JSON & Raw formatting, safe `try/except` wrappers and auto-import of `urequests` & `ujson`).
  - **Displays (14 nodes)**: SSD1306 OLED (Init, Clear, Text, Line, Pixel, Rect, Show), ST7735 SPI Color TFT, MAX7219 8x8 LED Matrix, I2C 1602/2004 LCD.
  - **Sensors (4 nodes)**: DHT11/DHT22 (Temperature & Humidity), BMP280 (Temperature, Pressure & Altitude).
  - **Actuators & Lighting (8 nodes)**: Servo Motor Controller, WS2812 NeoPixel Addressable LEDs.

### ⚡ Dual-Mode Hardware Simulator & WebAssembly MicroPython
- **Real MicroPython v1.26 WebAssembly VM**: Runs actual compiled MicroPython bytecode in a background Web Worker without blocking the UI, complete with virtual `machine`, `urequests`, `network`, and display drivers.
- **Visual Flow Mode**: Step-by-step graphical node highlighting on the canvas with adjustable simulation speed (0.5x, 1x, 2x, 5x).
- **Node-RED IoT Reverse Polling Simulation**: Automated handling of HTTP GET/POST requests and response commands (`/on`, `/off`) for IoT projects.
- **Hardware-Resilient Virtual Buses**: Virtual I2C (`0x3C`, `0x27`) and SPI bus ACK prevents missing-hardware panics (`ENODEV`) while preserving clean Python runtime semantics.
- **Live Interactive GPIO Pins**: Clickable GPIO indicators (`G0`, `G4`, `G5`, `G12`, `G14`, `D4`) with zero-latency concurrent memory synchronization.

### 🛠️ MicroPython Compiler Engine
- **Deterministic 4-Section Python Generation**: `1. IMPORTS`, `2. HARDWARE & INIT`, `3. FUNCTIONS & CALLBACKS`, `4. MAIN EXECUTION & LOOP`.
- **Topological Dependency Ordering**: Kahn's algorithm resolves object instantiation order (e.g. Pin $\rightarrow$ I2C Bus $\rightarrow$ OLED Screen).
- **Smart Data-Node Resolution**: Recursive expression emission guarantees required variable values exist before flow statements execute.
- **MicroPython Port Compatibility**: Interchangeable `number` $\leftrightarrow$ `boolean` and `any` connections for Python truthiness.

### 🖥️ Native Cross-Platform Desktop (Tauri v2)
- Clean native desktop binaries for Windows (`.exe` standalone and NSIS installer), Linux (`.AppImage`, `.deb`), and macOS (`.dmg`).
- Native File Save/Open dialogs with fallback web browser Blob download.
- Full GitHub Actions automated multi-platform build pipeline.
