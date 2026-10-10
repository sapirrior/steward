/** @jsxImportSource stitchable */
import {
  useState,
  useEffect,
  useRef,
  useReducer,
  useInput,
  useApp,
  Box,
  Text,
  Spacer,
} from 'stitchable';

import type { ModelRef } from '@steward/models';
import { parseModelRef } from '@steward/models';
import type { ReasoningEffort } from '../agent/types.js';
import type { StewardSettings } from '../settings/settingsTypes.js';
import { settingsStore } from '../settings/settingsStore.js';
import { appStateReducer } from './state/appStateReducer.js';
import type { AppState, ActiveToolCallState } from './types.js';
import { themeManager } from '../themes/themeManager.js';
import { AgentRunner } from '../agent/AgentRunner.js';
import { buildSystemPrompt } from '../services/context/systemPrompt.js';
import { FileReadTool } from '../tools/FileReadTool/index.js';
import { GlobTool } from '../tools/GlobTool/index.js';
import { GrepTool } from '../tools/GrepTool/index.js';
import { WebFetchTool } from '../tools/WebFetchTool/index.js';
import { WebSearchTool } from '../tools/WebSearchTool/index.js';
import { BashTool } from '../tools/BashTool/index.js';
import { TaskManagerTool } from '../tools/TaskManagerTool/index.js';
import { threadStore } from '@steward/threads';

import { useSpinner } from './hooks/useSpinner.js';
import { useCommandAutocomplete } from './hooks/useCommandAutocomplete.js';
import { useHistoryNavigation } from './hooks/useHistoryNavigation.js';

import { Header } from './components/layout/Header.js';
import { Footer } from './components/layout/Footer.js';
import { UserMessage } from './components/messages/UserMessage.js';
import { AssistantTurn } from './components/messages/AssistantTurn.js';
import { PromptInput } from './components/input/PromptInput.js';
import { AutocompletePopup } from './components/input/AutocompletePopup.js';

const VALID_REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'max',
];

function parseModel(raw: string, currentProvider: string, currentModel: string): ModelRef {
  const trimmed = raw.trim();
  if (!trimmed) return { provider: currentProvider, modelId: currentModel };
  const parsed = parseModelRef(trimmed);
  if (parsed) return parsed;
  return { provider: currentProvider, modelId: trimmed };
}

function parseEffort(raw: string, fallback: ReasoningEffort): ReasoningEffort {
  const norm = raw.trim().toLowerCase() as ReasoningEffort;
  if (VALID_REASONING_EFFORTS.includes(norm)) return norm;
  throw new Error(
    `Invalid reasoning effort: '${raw}'. Allowed: ${VALID_REASONING_EFFORTS.join(', ')}`,
  );
}

export interface AppProps {
  settings?: StewardSettings;
}

export function App({ settings }: AppProps = {}) {
  const currentSettings = settings ?? settingsStore.settings;
  const initialTheme = themeManager.getTheme(currentSettings.theme);
  const initialModelRef: ModelRef = {
    provider: currentSettings.provider || 'google',
    modelId: currentSettings.model || 'gemini-3.1-flash-lite',
  };
  const initialEffort = currentSettings.reasoningEffort || 'low';

  const [state, dispatch] = useReducer(appStateReducer, {
    settings: currentSettings,
    theme: initialTheme,
    modelRef: initialModelRef,
    reasoningEffort: initialEffort,
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

  // On startup: load user settings asynchronously from ~/.steward/settings.json
  useEffect(() => {
    let mounted = true;
    settingsStore.load().then((userSettings) => {
      if (!mounted) return;
      if (userSettings.provider && userSettings.model) {
        dispatch({
          type: 'SET_MODEL',
          modelRef: {
            provider: userSettings.provider,
            modelId: userSettings.model,
          },
        });
      }
      if (userSettings.reasoningEffort) {
        dispatch({
          type: 'SET_EFFORT',
          effort: userSettings.reasoningEffort,
        });
      }
      if (userSettings.theme) {
        const theme = themeManager.getTheme(userSettings.theme);
        themeManager.setTheme(userSettings.theme);
        dispatch({
          type: 'SET_THEME',
          theme,
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // Ref mirrors for fast typing & paste synchronization
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const cursorPosRef = useRef(cursorPos);
  cursorPosRef.current = cursorPos;

  const app = useApp();
  const spinnerChar = useSpinner(state.status === 'running');
  const autocomplete = useCommandAutocomplete(inputText);
  const historyNav = useHistoryNavigation();

  // Active tools
  const activeToolsRef = useRef<any[]>([]);
  if (activeToolsRef.current.length === 0) {
    const t = currentSettings.tools;
    if (t?.read) activeToolsRef.current.push(new FileReadTool());
    if (t?.glob) activeToolsRef.current.push(new GlobTool());
    if (t?.grep) activeToolsRef.current.push(new GrepTool());
    if (t?.websearch) activeToolsRef.current.push(new WebSearchTool());
    if (t?.webfetch) activeToolsRef.current.push(new WebFetchTool());
    if (t?.bash) activeToolsRef.current.push(new BashTool());
    activeToolsRef.current.push(new TaskManagerTool());
  }

  const runnerRef = useRef<AgentRunner>(new AgentRunner());
  const abortControllerRef = useRef<AbortController | null>(null);

  const executePrompt = async (promptToRun: string) => {
    const trimmed = promptToRun.trim();
    if (!trimmed || state.status === 'running') return;

    // Handle Slash Commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const commandArg = parts.slice(1).join(' ').trim();

      if (commandName === 'exit' || commandName === 'quit' || commandName === 'q') {
        app.exit();
        return;
      }
      if (commandName === 'clear') {
        dispatch({ type: 'CLEAR_HISTORY' });
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'theme') {
        const targetThemeName =
          commandArg || (state.theme.name === 'default' ? 'github' : 'default');
        const nextTheme = themeManager.getTheme(targetThemeName);
        themeManager.setTheme(targetThemeName);
        dispatch({ type: 'SET_THEME', theme: nextTheme });
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'model') {
        if (!commandArg) {
          const info = `Current model: **${state.modelRef.provider}/${state.modelRef.modelId}**`;
          dispatch({
            type: 'START_TURN',
            turn: {
              id: `cmd-${Date.now()}`,
              userPrompt: trimmed,
              userTimestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              reasoning: '',
              text: info,
              toolCalls: [],
              status: 'finished',
            },
          });
          setInputText('');
          setCursorPos(0);
          return;
        }
        const nextModel = parseModel(commandArg, state.modelRef.provider, state.modelRef.modelId);
        dispatch({ type: 'SET_MODEL', modelRef: nextModel });
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'effort') {
        if (!commandArg) {
          const info = `Current reasoning effort: **${state.reasoningEffort}**\nAllowed: \`${VALID_REASONING_EFFORTS.join(', ')}\``;
          dispatch({
            type: 'START_TURN',
            turn: {
              id: `cmd-${Date.now()}`,
              userPrompt: trimmed,
              userTimestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              reasoning: '',
              text: info,
              toolCalls: [],
              status: 'finished',
            },
          });
          setInputText('');
          setCursorPos(0);
          return;
        }
        try {
          const nextEffort = parseEffort(commandArg, state.reasoningEffort);
          dispatch({ type: 'SET_EFFORT', effort: nextEffort });
        } catch (err: any) {
          dispatch({
            type: 'START_TURN',
            turn: {
              id: `cmd-${Date.now()}`,
              userPrompt: trimmed,
              userTimestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              reasoning: '',
              text: `Error: ${err?.message || err}`,
              toolCalls: [],
              status: 'error',
            },
          });
        }
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'settings' || commandName === 'config') {
        const currentSettings = await settingsStore.load();
        const settingsText = `# Persistent Settings (~/.steward/settings.json)
- **Provider**: \`${currentSettings.provider}\`
- **Model**: \`${currentSettings.model}\`
- **Reasoning Effort**: \`${currentSettings.reasoningEffort}\`
- **Theme**: \`${currentSettings.theme}\`
- **Bash Auto-Approve**: \`${currentSettings.bash.autoApprove ? 'enabled' : 'disabled'}\`
- **Active Tools**: ${Object.entries(currentSettings.tools)
          .map(([k, v]) => `\`${k}: ${v ? 'on' : 'off'}\``)
          .join(', ')}`;

        dispatch({
          type: 'START_TURN',
          turn: {
            id: `cmd-${Date.now()}`,
            userPrompt: trimmed,
            userTimestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            reasoning: '',
            text: settingsText,
            toolCalls: [],
            status: 'finished',
          },
        });
        setInputText('');
        setCursorPos(0);
        return;
      }
    }

    historyNav.pushToHistory(trimmed);
    setInputText('');
    setCursorPos(0);
    autocomplete.reset();

    const turnId = `turn-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    abortControllerRef.current = new AbortController();

    dispatch({
      type: 'START_TURN',
      turn: {
        id: turnId,
        userPrompt: trimmed,
        userTimestamp: timestamp,
        reasoning: '',
        text: '',
        toolCalls: [],
        status: 'running',
        abortController: abortControllerRef.current,
      },
    });

    const messages = [
      ...state.history.flatMap((h) => [
        { role: 'user' as const, content: h.userPrompt },
        { role: 'assistant' as const, content: h.text },
      ]),
      { role: 'user' as const, content: trimmed },
    ];

    const systemPrompt = buildSystemPrompt({
      cwd: state.cwd,
      isHeadless: false,
    });

    let reasoningStart = Date.now();
    let hasFinishedReasoning = false;

    try {
      const stream = runnerRef.current.runStream(
        {
          modelRef: state.modelRef,
          messages,
          tools: activeToolsRef.current,
          reasoning: state.reasoningEffort,
          systemPrompt,
          signal: abortControllerRef.current.signal,
        },
        (event) => {
          if (event.type === 'tool-call-start') {
            if (!hasFinishedReasoning && reasoningStart) {
              hasFinishedReasoning = true;
              dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
            }
            const tcState: ActiveToolCallState = {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              tagline: event.tagline,
              args: event.args,
              status: 'running',
            };
            dispatch({ type: 'START_TOOL_CALL', toolCall: tcState });
          } else if (event.type === 'tool-call-result') {
            dispatch({
              type: 'FINISH_TOOL_CALL',
              toolCallId: event.toolCallId,
              result: event.result,
              durationMs: event.durationMs,
              isError: event.isError,
            });
          } else if (event.type === 'retry') {
            dispatch({
              type: 'SET_RETRY',
              attempt: event.attempt,
              maxRetries: event.maxRetries,
              delayMs: event.delayMs,
              errorMessage: event.error.message,
            });
          } else if (event.type === 'error') {
            dispatch({ type: 'ERROR_TURN', message: event.error.message });
          }
        },
      );

      for await (const event of stream) {
        if (event.type === 'reasoning-delta') {
          dispatch({ type: 'APPEND_REASONING', text: event.text });
        } else if (event.type === 'text-delta') {
          if (!hasFinishedReasoning) {
            hasFinishedReasoning = true;
            dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
          }
          dispatch({ type: 'APPEND_TEXT', text: event.text });
        }
      }

      const finalResult = await stream.next();
      dispatch({ type: 'FINISH_TURN', usage: finalResult.value?.usage });
    } catch (err: any) {
      if (abortControllerRef.current?.signal.aborted) {
        dispatch({ type: 'ABORT_TURN' });
      } else {
        dispatch({ type: 'ERROR_TURN', message: err?.message || String(err) });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  useInput((ev) => {
    // 1. Interruption (Escape / Ctrl+C)
    if (ev.type === 'key') {
      if (ev.key.ctrl && ev.key.name === 'c') {
        if (state.status === 'running') {
          abortControllerRef.current?.abort();
          dispatch({ type: 'ABORT_TURN' });
          return true;
        }
        app.exit();
        return true;
      }

      // Toggle expand all bash cards (Ctrl+O)
      if (ev.key.ctrl && (ev.key.name === 'o' || ev.key.name === '0')) {
        dispatch({ type: 'TOGGLE_EXPAND_ALL_BASH_CARDS' });
        return true;
      }

      if (ev.key.name === 'escape') {
        if (state.status === 'running') {
          abortControllerRef.current?.abort();
          dispatch({ type: 'ABORT_TURN' });
          return true;
        }
        if (autocomplete.isOpen) {
          autocomplete.reset();
          return true;
        }
      }

      // 2. Autocomplete Navigation
      if (autocomplete.isOpen) {
        if (ev.key.upArrow) {
          autocomplete.selectPrev();
          return true;
        }
        if (ev.key.downArrow) {
          autocomplete.selectNext();
          return true;
        }
        if (ev.key.tab || (ev.key.return && autocomplete.matchedCommands.length > 0)) {
          const selected = autocomplete.getSelectedCommand();
          if (selected) {
            const completed = `/${selected.name} `;
            inputTextRef.current = completed;
            cursorPosRef.current = completed.length;
            setInputText(completed);
            setCursorPos(completed.length);
            return true;
          }
        }
      }

      // 3. History Navigation
      if (inputText.length === 0 && !state.activeTurn) {
        if (ev.key.upArrow) {
          const prev = historyNav.navigateUp(inputTextRef.current);
          if (prev !== null) {
            inputTextRef.current = prev;
            cursorPosRef.current = prev.length;
            setInputText(prev);
            setCursorPos(prev.length);
            return true;
          }
        }
        if (ev.key.downArrow) {
          const next = historyNav.navigateDown();
          if (next !== null) {
            inputTextRef.current = next;
            cursorPosRef.current = next.length;
            setInputText(next);
            setCursorPos(next.length);
            return true;
          }
        }
      }

      // 4. Cursor Left/Right
      if (ev.key.leftArrow) {
        if (cursorPosRef.current > 0) {
          const next = cursorPosRef.current - 1;
          cursorPosRef.current = next;
          setCursorPos(next);
        }
        return true;
      }

      if (ev.key.rightArrow) {
        if (cursorPosRef.current < inputTextRef.current.length) {
          const next = cursorPosRef.current + 1;
          cursorPosRef.current = next;
          setCursorPos(next);
        }
        return true;
      }

      // 5. Backspace / Delete
      if (ev.key.backspace || ev.key.delete) {
        if (cursorPosRef.current > 0) {
          const pos = cursorPosRef.current;
          const current = inputTextRef.current;
          const updated = current.slice(0, pos - 1) + current.slice(pos);
          const nextPos = pos - 1;

          inputTextRef.current = updated;
          cursorPosRef.current = nextPos;
          setInputText(updated);
          setCursorPos(nextPos);
        }
        return true;
      }

      // 6. Return / Submit
      if (ev.key.return) {
        const textToSubmit = inputTextRef.current;
        executePrompt(textToSubmit);
        return true;
      }

      // 7. Regular Typing
      if (ev.input) {
        const pos = cursorPosRef.current;
        const current = inputTextRef.current;
        const updated = current.slice(0, pos) + ev.input + current.slice(pos);
        const nextPos = pos + ev.input.length;

        inputTextRef.current = updated;
        cursorPosRef.current = nextPos;
        setInputText(updated);
        setCursorPos(nextPos);
        return true;
      }
    }

    // 8. Bracketed Paste Handling
    if (ev.type === 'paste' && ev.text) {
      const sanitized = ev.text.replace(/\r\n|\r|\n/g, ' ');
      const pos = cursorPosRef.current;
      const current = inputTextRef.current;
      const updated = current.slice(0, pos) + sanitized + current.slice(pos);
      const nextPos = pos + sanitized.length;

      inputTextRef.current = updated;
      cursorPosRef.current = nextPos;
      setInputText(updated);
      setCursorPos(nextPos);
      return true;
    }
  });

  const hasStarted = state.history.length > 0 || state.activeTurn !== null;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} width="100%">
      {/* 1. Header Splash */}
      <Header theme={state.theme} isCompact={hasStarted} />

      {/* 2. Conversation History */}
      {state.history.map((turn) => (
        <Box key={turn.id} flexDirection="column" width="100%">
          <UserMessage
            prompt={turn.userPrompt}
            timestamp={turn.userTimestamp}
            theme={state.theme}
          />
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

      {/* 4. Autocomplete Popup */}
      {autocomplete.isOpen && (
        <AutocompletePopup
          commands={autocomplete.matchedCommands}
          selectedIndex={autocomplete.selectedIndex}
          theme={state.theme}
        />
      )}

      {/* 5. Prompt Input Box */}
      <PromptInput
        inputText={inputText}
        cursorPos={cursorPos}
        modelRef={state.modelRef}
        reasoningEffort={state.reasoningEffort}
        isRunning={state.status === 'running'}
        theme={state.theme}
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
    </Box>
  );
}
