import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Cpu,
  Globe,
  Sliders,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import {
  checkForUpdates,
  openExternalUrl,
  UpdateInfo,
  APP_CURRENT_VERSION,
  detectPlatform,
} from '../../services/updateService';
import { NodeMpyLogo } from '../brand/NodeMpyLogo';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    settingsActiveTab,
    setSettingsActiveTab,
    language,
    setLanguage,
    simEngineMode,
    setSimEngineMode,
  } = useFlowStore();

  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRu = language === 'ru';
  const platform = detectPlatform();

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSettingsModalOpen, setSettingsModalOpen]);

  if (!isSettingsModalOpen) return null;

  const handleCheckUpdates = async () => {
    setChecking(true);
    setErrorMsg(null);
    try {
      const info = await checkForUpdates();
      setUpdateInfo(info);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось связаться с сервером обновлений GitHub.');
    } finally {
      setChecking(false);
    }
  };

  const getPlatformLabel = (p: string) => {
    switch (p) {
      case 'windows':
        return 'Windows (x64 / NSIS / Standalone)';
      case 'linux':
        return 'Linux (AppImage / DEB)';
      case 'macos':
        return 'macOS (DMG / Apple Silicon & Intel)';
      default:
        return 'Web / Unknown OS';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={() => setSettingsModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] bg-[#1A1D24] border border-[#2E3544] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs select-none max-h-[85vh]"
      >
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2E3544] bg-[#14171E] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-gray-100">
              {isRu ? 'Настройки Node-MPY' : 'Node-MPY Settings'}
            </h2>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-[#252B38] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Header */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[#2E3544] bg-[#161920] flex-shrink-0">
          <button
            onClick={() => setSettingsActiveTab('general')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              settingsActiveTab === 'general'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10 rounded-t'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1E232E] rounded-t'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isRu ? 'Основные' : 'General'}</span>
          </button>

          <button
            onClick={() => setSettingsActiveTab('updates')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all relative ${
              settingsActiveTab === 'updates'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10 rounded-t'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1E232E] rounded-t'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRu ? 'Обновления' : 'Updates'}</span>
            {updateInfo?.hasUpdate && (
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 text-gray-300 leading-relaxed scrollbar-thin scrollbar-thumb-gray-600">
          {/* TAB 1: GENERAL */}
          {settingsActiveTab === 'general' && (
            <div className="space-y-4">
              {/* Language Selector */}
              <div className="p-3.5 rounded-lg bg-[#14171E] border border-[#2B3240] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-400" />
                    <div>
                      <p className="font-semibold text-gray-100">
                        {isRu ? 'Язык интерфейса' : 'Interface Language'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {isRu
                          ? 'Переключение языка меню, нод и подсказок'
                          : 'Switch language for menus, nodes, and tooltips'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-[#1A1E26] p-0.5 rounded border border-[#353D4E]">
                    <button
                      onClick={() => setLanguage('ru')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        language === 'ru'
                          ? 'bg-teal-500 text-slate-900 font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Русский
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        language === 'en'
                          ? 'bg-teal-500 text-slate-900 font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>

              {/* Default Simulator Engine */}
              <div className="p-3.5 rounded-lg bg-[#14171E] border border-[#2B3240] space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <Cpu className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-100">
                        {isRu ? 'Движок симулятора по умолчанию' : 'Default Simulator Engine'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {isRu
                          ? 'Выберите режим работы виртуального контроллера при старте симуляции'
                          : 'Choose default simulation mode for the virtual controller'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-[#1A1E26] p-0.5 rounded border border-[#353D4E] flex-shrink-0">
                    <button
                      onClick={() => setSimEngineMode('visual')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        simEngineMode === 'visual'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Visual Flow
                    </button>
                    <button
                      onClick={() => setSimEngineMode('wasm')}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        simEngineMode === 'wasm'
                          ? 'bg-teal-600 text-white font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      MicroPython VM
                    </button>
                  </div>
                </div>
              </div>

              {/* Autosave Status */}
              <div className="p-3.5 rounded-lg bg-[#14171E] border border-[#2B3240] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-gray-100">
                      {isRu ? 'Автосохранение проекта' : 'Project Autosave'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {isRu
                        ? 'Все вкладки и схемы сохраняются в защищенном локальном хранилище'
                        : 'All tabs and flows are continuously saved in local storage'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                  {isRu ? 'АКТИВНО' : 'ACTIVE'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: UPDATES */}
          {settingsActiveTab === 'updates' && (
            <div className="space-y-4">
              {/* App Version & Platform Card */}
              <div className="p-4 rounded-lg bg-[#14171E] border border-[#2B3240] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NodeMpyLogo size={28} />
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Node-MPY <span className="font-mono text-teal-400 font-bold">v{APP_CURRENT_VERSION}</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span>{isRu ? 'Платформа:' : 'Platform:'}</span>
                      <span className="font-mono text-gray-300">{getPlatformLabel(platform)}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCheckUpdates}
                  disabled={checking}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 text-slate-900 font-bold text-xs transition-colors shadow-lg shadow-teal-500/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? (isRu ? 'Проверка...' : 'Checking...') : isRu ? 'Проверить обновления' : 'Check for Updates'}</span>
                </button>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-500/50 flex items-start gap-2.5 text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-xs">{isRu ? 'Ошибка проверки' : 'Update Check Error'}</p>
                    <p className="text-[11px] text-red-300 mt-0.5">{errorMsg}</p>
                    <button
                      onClick={() => openExternalUrl('https://github.com/Timon2306/node-mpy/releases')}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-teal-400 hover:underline"
                    >
                      <span>{isRu ? 'Открыть страницу релизов на GitHub вручную' : 'Open GitHub Releases manually'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Status: Up-to-date */}
              {updateInfo && !updateInfo.hasUpdate && !errorMsg && (
                <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-200 text-xs">
                      {isRu ? 'У вас установлена последняя версия!' : 'You are running the latest version!'}
                    </p>
                    <p className="text-[11px] text-emerald-300/80 leading-snug">
                      {isRu
                        ? `Версия Node-MPY v${updateInfo.currentVersion} является актуальной. Обновлений не требуется.`
                        : `Node-MPY v${updateInfo.currentVersion} is up-to-date. No new updates available.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Status: Update Available! */}
              {updateInfo && updateInfo.hasUpdate && (
                <div className="p-4 rounded-lg bg-[#18202F] border border-teal-500/50 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚀</span>
                      <div>
                        <p className="font-bold text-white text-xs">
                          {isRu ? 'Доступно обновление!' : 'New Update Available!'}
                        </p>
                        <p className="text-[11px] text-teal-300 font-mono font-semibold">
                          v{updateInfo.currentVersion} ➔ <span className="text-teal-400 font-bold text-sm">v{updateInfo.latestVersion}</span>
                        </p>
                      </div>
                    </div>

                    {updateInfo.publishedAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(updateInfo.publishedAt).toLocaleDateString(isRu ? 'ru-RU' : 'en-US')}
                      </span>
                    )}
                  </div>

                  {/* Release Notes */}
                  {updateInfo.releaseNotes && (
                    <div className="p-3 rounded bg-[#11141C] border border-[#2B3240] space-y-1 text-gray-300 max-h-36 overflow-y-auto font-mono text-[11px] leading-relaxed select-text">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        {isRu ? 'Что нового в релизе:' : 'Release notes:'}
                      </p>
                      <div className="whitespace-pre-line text-gray-200">
                        {updateInfo.releaseNotes}
                      </div>
                    </div>
                  )}

                  {/* Primary Download Action for Current Platform */}
                  {updateInfo.matchingAsset ? (
                    <div className="pt-1 flex flex-col sm:flex-row items-center gap-2">
                      <button
                        onClick={() => openExternalUrl(updateInfo.matchingAsset!.downloadUrl)}
                        className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-xs transition-colors shadow-lg shadow-teal-500/30 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {isRu
                            ? `Скачать обновление для ${platform === 'windows' ? 'Windows (.exe)' : platform === 'linux' ? 'Linux (.AppImage)' : 'macOS (.dmg)'}`
                            : `Download for ${platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'macOS'}`}
                        </span>
                        {updateInfo.matchingAsset.sizeBytes > 0 && (
                          <span className="text-[10px] opacity-80 font-mono">
                            ({formatBytes(updateInfo.matchingAsset.sizeBytes)})
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => openExternalUrl(updateInfo.releaseUrl)}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#242B38] hover:bg-[#2F3748] text-gray-200 border border-[#3A4559] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>{isRu ? 'GitHub Релиз' : 'GitHub Release'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openExternalUrl(updateInfo.releaseUrl)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{isRu ? 'Перейти на страницу релиза на GitHub' : 'View Release on GitHub'}</span>
                    </button>
                  )}

                  {/* All Assets List (for cross-platform users) */}
                  {updateInfo.allAssets && updateInfo.allAssets.length > 1 && (
                    <div className="pt-2 border-t border-[#2B3240] space-y-1.5">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">
                        {isRu ? 'Все доступные сборки:' : 'All available packages:'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {updateInfo.allAssets.map((asset) => (
                          <button
                            key={asset.name}
                            onClick={() => openExternalUrl(asset.downloadUrl)}
                            className="flex items-center justify-between p-2 rounded bg-[#12151D] hover:bg-[#1E232E] border border-[#2B3240] text-[11px] text-gray-300 hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <span className="font-mono truncate mr-2">{asset.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                              {formatBytes(asset.sizeBytes)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Initial Idle Hint */}
              {!updateInfo && !checking && !errorMsg && (
                <div className="p-3.5 rounded-lg bg-[#14171E] border border-[#2B3240] text-[11px] text-gray-400 space-y-1 leading-snug">
                  <p className="text-gray-300 font-semibold">
                    {isRu ? 'Как работают обновления в Node-MPY?' : 'How do updates work in Node-MPY?'}
                  </p>
                  <p>
                    {isRu
                      ? 'При нажатии на кнопку проверки приложение обращается к официальному GitHub API репозитория Timon2306/node-mpy, сравнивает семантическую версию с установленной и автоматически подбирает готовый установочный пакет под вашу операционную систему (Windows .exe, Linux .AppImage или macOS .dmg).'
                      : 'When checking for updates, Node-MPY queries the official GitHub API for Timon2306/node-mpy, compares the semver with your current installation, and automatically matches the correct cross-platform binary (Windows .exe, Linux .AppImage, or macOS .dmg).'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#2E3544] bg-[#14171E] flex justify-between items-center flex-shrink-0">
          <span className="text-[10px] text-gray-500 font-mono">
            Node-MPY • MicroPython Visual Studio
          </span>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-[#252B38] hover:bg-[#31394B] text-gray-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            {isRu ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
