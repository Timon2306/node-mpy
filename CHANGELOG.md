# Changelog — Node-MPY

All notable changes to this project will be documented in this file.

## [1.1.1] — 2026-10-22 (Try/Except, Elif Multi-Branching & Flow Continuation)

### 🚀 Highlights
- **`Try / Except` Error Trapping Node (`core:try_except`)**:
  - Full support for MicroPython `try: ... except Exception as err: ...` exception handling.
  - Dedicated `error_msg` port exposing `str(err)` to displays, serial logs, or variables.
  - Prevents board freeze and crashes on I2C sensor timeouts, Wi-Fi reconnects, or JSON parse errors.
- **`If / Elif / Else` Multi-Branching (`core:if_elif_else`) & `elif` Support**:
  - Dedicated multi-way branching node with `cond_if`, `cond_elif1..3`, `flow_if`, `flow_elif1..3`, and `flow_else`.
  - Added optional `elif` port to standard `core:if_else` node.
  - Generates clean idiomatic MicroPython without deeply nested `else: if:`.
- **Sequential Flow Continuation (`flow_next`) & Automatic Branch Convergence**:
  - Explicit **«Далее (После)» (`flow_next`)** output port on `If / Else`, `If / Elif / Else`, and `Try / Except` allowing sequential steps to continue execution outside conditional blocks at the outer indentation level.
  - Smart convergence detection: when both branches lead into the same downstream node (convergent diamond flow), the compiler automatically flattens it after the conditional block without duplicate execution.
- **117 Native Nodes Total**:
  - Complete 100% test pass across all 117 node definitions, 75 PinLab experiments, compiler suite, and visual dashboard tests.

## [1.1.0] — 2026-10-21 (Visual IoT Dashboard & PinLab Suite)

### 🚀 Highlights
- **Visual IoT Dashboard Studio (Dashboard Flows)**: Dedicated flow mode for designing browser-based dashboards with drag-and-drop nodes:
  - **Gauge (Шкала)**: Real-time radial dial gauge with configurable min/max range and measurement units.
  - **Chart (График)**: Multi-point live time-series canvas chart.
  - **Buttons & Switches (Кнопки и Тумблеры)**: Custom labels, color themes, and custom command payloads (`FAN_ON`, `START_PUMP`, etc.).
  - **Sliders (Ползунки)**: Smooth continuous adjustment (0..1023 for PWM brightness or 0..180 for Servo angles).
  - **LED Indicators & Text**: Live hardware status indicators and formatted values.
  - **Interactive In-App Runner**: 1-click «Запустить дашборд» launches live interactive telemetry simulation inside the app.
- **Clean TypeScript Backend Generator (`server.ts`)**:
  - Concise ~85-line TypeScript backend server with Server-Sent Events (SSE) for instant real-time telemetry broadcast.
  - Standalone dark-themed `dashboard.html` web application with responsive layout and zero external runtime dependencies.
  - Dual-mode inspector code viewer: toggle between `[ server.ts ]` and `[ dashboard.html ]`.
  - 1-click **«Экспорт дашборда»**: saves both `server.ts` and `dashboard.html` together in a single folder ready to run (`npx tsx server.ts`).
- **Universal Two-Way IoT Controller Bridge**:
  - **`network:dashboard_client`**: Multi-sensor reverse-polling client sending telemetry (`val1`, `val2`) and receiving text commands and slider numbers from any dashboard control.
  - **`network:dashboard_command`**: Dedicated command filter node enabling direct wiring to relays, LEDs, motors, or conditional branches.
- **Hardware Expansion & PinLab Compatibility (115 nodes total)**:
  - 100% test pass across all 75 laboratory experiments from the PinLab course.
  - Added native modules: **DS18B20** (1-Wire digital thermometer), **RFID MFRC522** (MIFARE card/tag reader), and **MicroPyServer** (embedded lightweight microcontroller web server).
  - Smart selective Python imports (`from machine import Pin` instead of forced global `import machine`).
  - Polished node layout, fixed text clipping, and responsive port widths.

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
