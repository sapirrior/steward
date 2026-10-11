/** @jsxImportSource stitchable */
import {
  useState,
  useEffect,
  useRef,
  useReducer,
  useInput,
  useApp,
  Box,
} from 'stitchable';

import type { StewardSettings } from '../settings/settingsTypes.js';
import { settingsStore } from '../settings/settingsStore.js';
import { themeManager } from '../themes/themeManager.js';
import { appStateReducer } from './state/appStateReducer.js';
import { AppController } from './runtime/AppController.js';
import { useSpinner } from './hooks/useSpinner.js';
import { useHistoryNavigation } from './hooks/useHistoryNavigation.js';
import { commandRegistry } from './commands/CommandRegistry.js';

import { Header } from './components/layout/Header.js';
import { Footer } from './components/layout/Footer.js';
import { UserMessage } from './components/messages/UserMessage.js';
import { AssistantTurn } from './components/messages/AssistantTurn.js';
import { PromptInput } from './components/input/PromptInput.js';
import { PermissionDock } from './components/permission/PermissionDock.js';

import { DialogHost } from './dialogs/DialogHost.js';
import { ModelDialog } from './commands/ModelCommand/ModelDialog.js';
import { EffortDialog } from './commands/EffortCommand/EffortDialog.js';
import { ThemeDialog } from './commands/ThemeCommand/ThemeDialog.js';
import { ResumeDialog } from './commands/ResumeCommand/ResumeDialog.js';
import { SettingsDialog } from './commands/SettingsCommand/SettingsDialog.js';
import { ExitDialog } from './commands/ExitCommand/ExitDialog.js';

export interface AppProps {
  settings?: StewardSettings;
}

export function App({ settings }: AppProps = {}) {
  const currentSettings = settings ?? settingsStore.settings;
  const initialTheme = themeManager.getTheme(currentSettings.theme);
  const app = useApp();

  const [state, dispatch] = useReducer(appStateReducer, {
    settings: currentSettings,
    theme: initialTheme,
    modelRef: {
      provider: currentSettings.provider || 'google',
      modelId: currentSettings.model || 'gemini-3.1-flash-lite',
    },
    reasoningEffort: currentSettings.reasoningEffort || 'low',
    status: 'idle',
    history: [],
    activeTurn: null,
    metrics: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
    permissionRequest: null,
    cwd: process.cwd(),
  });

  const controllerRef = useRef<AppController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new AppController({
      state,
      dispatch,
      exitFn: () => app.exit(),
    });
  }
  controllerRef.current.update(state, dispatch);
  const controller = controllerRef.current;

  // Dialog & Prompt state
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // Model & Saved Thread catalogs
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [savedThreads, setSavedThreads] = useState<any[]>([]);

  useEffect(() => {
    controller.loadInitialModels().then((models) => setModelsList([...models]));
    controller.threadController.list().then((list) => setSavedThreads([...list]));
  }, []);

  const spinnerChar = useSpinner(state.status === 'running');
  const historyNav = useHistoryNavigation();

  // Command palette autocomplete items (inline inside PromptInput)
  const isSlashCommand = inputText.startsWith('/') && state.status !== 'running';
  const suggestedCommands = isSlashCommand
    ? commandRegistry.filter(inputText).map((c) => ({
        name: c.name,
        displayLabel: c.displayLabel,
        description: c.description,
      }))
    : [];

  const openModal = async (id: string) => {
    if (id === 'resume') {
      const list = await controller.threadController.list();
      setSavedThreads([...list]);
    } else if (id === 'model' && modelsList.length === 0) {
      const models = await controller.loadInitialModels();
      setModelsList([...models]);
    }
    setActiveDialog(id);
    setDialogIndex(0);
    setFilterQuery('');
  };

  const closeModal = () => {
    setActiveDialog(null);
    setDialogIndex(0);
    setFilterQuery('');
  };

  useInput((ev) => {
    // 1. Permission Dock input handling
    if (state.permissionRequest) {
      if (ev.type === 'key') {
        if (ev.key.return || ev.input === 'y' || ev.input === 'Y') {
          controller.approvePermission();
          return true;
        }
        if (ev.key.escape || ev.input === 'n' || ev.input === 'N') {
          controller.denyPermission();
          return true;
        }
      }
      return true;
    }

    // 2. Active Modal Dialog navigation
    if (activeDialog !== null) {
      if (ev.type === 'key') {
        if (ev.key.escape) {
          closeModal();
          return true;
        }

        // Count items in active dialog
        let count = 0;
        if (activeDialog === 'model') count = modelsList.length;
        else if (activeDialog === 'effort') count = 5;
        else if (activeDialog === 'theme') count = 2;
        else if (activeDialog === 'resume') count = savedThreads.length;
        else if (activeDialog === 'settings') count = 6;
        else if (activeDialog === 'exit') count = 2;

        if (ev.key.upArrow && count > 0) {
          setDialogIndex((prev) => (prev - 1 + count) % count);
          return true;
        }
        if (ev.key.downArrow && count > 0) {
          setDialogIndex((prev) => (prev + 1) % count);
          return true;
        }

        // Confirm selection in dialog
        if (ev.key.return) {
          if (activeDialog === 'model') {
            const selected = modelsList[dialogIndex];
            if (selected) controller.switchModel({ provider: selected.provider, modelId: selected.id });
          } else if (activeDialog === 'effort') {
            const efforts = ['none', 'low', 'medium', 'high', 'xhigh'] as const;
            const selected = efforts[dialogIndex];
            if (selected) controller.switchEffort(selected);
          } else if (activeDialog === 'theme') {
            const themes = ['default', 'github'];
            const selected = themes[dialogIndex];
            if (selected) controller.switchTheme(selected);
          } else if (activeDialog === 'resume') {
            const selected = savedThreads[dialogIndex];
            if (selected) controller.resumeThread(selected.id);
          } else if (activeDialog === 'exit') {
            if (dialogIndex === 0) controller.exitApp();
            else closeModal();
          } else {
            closeModal();
          }
          closeModal();
          return true;
        }

        // Filtering in search input
        if (ev.key.backspace) {
          setFilterQuery((prev) => prev.slice(0, -1));
          setDialogIndex(0);
          return true;
        }
        if (ev.input) {
          setFilterQuery((prev) => prev + ev.input);
          setDialogIndex(0);
          return true;
        }
      }
      return true;
    }

    // 3. Normal Prompt Input & Global Shortcuts
    if (ev.type === 'key') {
      if (ev.key.ctrl && ev.key.name === 'c') {
        if (state.status === 'running') {
          controller.abortTurn();
          return true;
        }
        controller.exitApp();
        return true;
      }

      if (ev.key.ctrl && (ev.key.name === 'o' || ev.key.name === '0')) {
        dispatch({ type: 'TOGGLE_EXPAND_ALL_BASH_CARDS' });
        return true;
      }

      if (ev.key.escape && state.status === 'running') {
        controller.abortTurn();
        return true;
      }

      // Enter to submit
      if (ev.key.return) {
        const text = inputText.trim();
        if (!text) return true;

        if (text.startsWith('/')) {
          const parts = text.slice(1).split(/\s+/);
          const cmdName = parts[0]?.toLowerCase();
          const arg = parts.slice(1).join(' ').trim();

          setInputText('');
          setCursorPos(0);

          if (cmdName === 'new' || cmdName === 'clear') {
            controller.newSession();
            return true;
          }
          if (cmdName === 'model') {
            if (arg) {
              const [prov, ...rest] = arg.includes('/') ? arg.split('/') : [state.modelRef.provider, arg];
              controller.switchModel({ provider: prov, modelId: rest.join('/') });
            } else {
              openModal('model');
            }
            return true;
          }
          if (cmdName === 'effort') {
            if (arg) controller.switchEffort(arg as any);
            else openModal('effort');
            return true;
          }
          if (cmdName === 'theme') {
            if (arg) controller.switchTheme(arg);
            else openModal('theme');
            return true;
          }
          if (cmdName === 'resume') {
            openModal('resume');
            return true;
          }
          if (cmdName === 'settings' || cmdName === 'config') {
            openModal('settings');
            return true;
          }
          if (cmdName === 'exit' || cmdName === 'quit' || cmdName === 'q') {
            openModal('exit');
            return true;
          }
        }

        historyNav.pushToHistory(text);
        setInputText('');
        setCursorPos(0);
        controller.executePrompt(text);
        return true;
      }

      // Autocomplete Tab confirmation for inline slash commands
      if (ev.key.tab && suggestedCommands.length > 0) {
        const first = suggestedCommands[0];
        if (first) {
          const completed = `/${first.name} `;
          setInputText(completed);
          setCursorPos(completed.length);
          return true;
        }
      }

      // History navigation
      if (inputText.length === 0 && !state.activeTurn) {
        if (ev.key.upArrow) {
          const prev = historyNav.navigateUp(inputText);
          if (prev !== null) {
            setInputText(prev);
            setCursorPos(prev.length);
            return true;
          }
        }
        if (ev.key.downArrow) {
          const next = historyNav.navigateDown();
          if (next !== null) {
            setInputText(next);
            setCursorPos(next.length);
            return true;
          }
        }
      }

      // Cursor movement
      if (ev.key.leftArrow && cursorPos > 0) {
        setCursorPos((prev) => prev - 1);
        return true;
      }
      if (ev.key.rightArrow && cursorPos < inputText.length) {
        setCursorPos((prev) => prev + 1);
        return true;
      }
      if (ev.key.backspace && cursorPos > 0) {
        const next = inputText.slice(0, cursorPos - 1) + inputText.slice(cursorPos);
        setInputText(next);
        setCursorPos((prev) => prev - 1);
        return true;
      }
      if (ev.input) {
        const next = inputText.slice(0, cursorPos) + ev.input + inputText.slice(cursorPos);
        setInputText(next);
        setCursorPos((prev) => prev + ev.input.length);
        return true;
      }
    }

    // Bracketed paste
    if (ev.type === 'paste' && ev.text) {
      const sanitized = ev.text.replace(/\r\n|\r|\n/g, ' ');
      const next = inputText.slice(0, cursorPos) + sanitized + inputText.slice(cursorPos);
      setInputText(next);
      setCursorPos((prev) => prev + sanitized.length);
      return true;
    }
  });

  const hasStarted = state.history.length > 0 || state.activeTurn !== null;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width="100%">
      {/* 1. Header Banner */}
      <Header theme={state.theme} isCompact={hasStarted} />

      {/* 2. Conversation History */}
      {state.history.map((turn) => (
        <Box key={turn.id} flexDirection="column" width="100%">
          <UserMessage prompt={turn.userPrompt} timestamp={turn.userTimestamp} theme={state.theme} />
          <AssistantTurn
            turn={turn}
            theme={state.theme}
            isBashCardsExpanded={Boolean(state.expandAllBashCards)}
          />
        </Box>
      ))}

      {/* 3. Active Turn */}
      {state.activeTurn && (
        <Box flexDirection="column" width="100%">
          <UserMessage
            prompt={state.activeTurn.userPrompt}
            timestamp={state.activeTurn.userTimestamp}
            theme={state.theme}
          />
          <AssistantTurn
            turn={state.activeTurn}
            theme={state.theme}
            isStreaming
            isBashCardsExpanded={Boolean(state.expandAllBashCards)}
          />
        </Box>
      )}

      {/* 4. Permission Dock */}
      {state.permissionRequest && (
        <PermissionDock
          toolName={state.permissionRequest.toolName}
          command={state.permissionRequest.command}
          reason={state.permissionRequest.tagline}
          theme={state.theme}
          onDecision={(allowed) =>
            allowed ? controller.approvePermission() : controller.denyPermission()
          }
        />
      )}

      {/* 5. Prompt Input Box (with inline slash suggestions) */}
      <PromptInput
        inputText={inputText}
        cursorPos={cursorPos}
        modelRef={state.modelRef}
        reasoningEffort={state.reasoningEffort}
        isRunning={state.status === 'running'}
        theme={state.theme}
        suggestedCommands={suggestedCommands}
      />

      {/* 6. Footer Status Bar */}
      <Footer
        cwd={state.cwd}
        gitBranch={state.gitBranch}
        metrics={state.metrics}
        isRunning={state.status === 'running'}
        spinnerChar={spinnerChar}
        theme={state.theme}
      />

      {/* 7. Centered Modal Dialog Host */}
      <DialogHost isOpen={activeDialog !== null} onClose={closeModal} theme={state.theme}>
        {activeDialog === 'model' && (
          <ModelDialog
            models={modelsList}
            selectedIndex={dialogIndex}
            currentModelId={state.modelRef.modelId}
            theme={state.theme}
            filterQuery={filterQuery}
          />
        )}
        {activeDialog === 'effort' && (
          <EffortDialog
            currentEffort={state.reasoningEffort}
            selectedIndex={dialogIndex}
            theme={state.theme}
          />
        )}
        {activeDialog === 'theme' && (
          <ThemeDialog
            currentThemeName={state.theme.name}
            selectedIndex={dialogIndex}
            theme={state.theme}
          />
        )}
        {activeDialog === 'resume' && (
          <ResumeDialog
            threads={savedThreads}
            selectedIndex={dialogIndex}
            theme={state.theme}
            filterQuery={filterQuery}
          />
        )}
        {activeDialog === 'settings' && (
          <SettingsDialog
            settings={state.settings}
            selectedIndex={dialogIndex}
            theme={state.theme}
          />
        )}
        {activeDialog === 'exit' && (
          <ExitDialog
            selectedIndex={dialogIndex}
            theme={state.theme}
          />
        )}
      </DialogHost>
    </Box>
  );
}
