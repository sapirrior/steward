/** @jsxImportSource stitchable */
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useReducer,
  useInput,
  useApp,
  Box,
  Text,
} from 'stitchable';

import type { ModelRef, ModelMetadata } from '@steward/models';
import { parseModelRef, createModels } from '@steward/models';
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
import { threadStore, type ThreadSummary, type ThreadDocument } from '@steward/threads';
import { reconstructTurnsFromMessages } from './utils/threadToTurns.js';

import { useSpinner } from './hooks/useSpinner.js';
import { useHistoryNavigation } from './hooks/useHistoryNavigation.js';

import { Header } from './components/layout/Header.js';
import { Footer } from './components/layout/Footer.js';
import { UserMessage } from './components/messages/UserMessage.js';
import { AssistantTurn } from './components/messages/AssistantTurn.js';
import { PromptInput } from './components/input/PromptInput.js';
import { BUILTIN_COMMANDS } from './commands/commandRegistry.js';
import { CommandPaletteDialog } from './components/dialogs/CommandPaletteDialog.js';
import { ModelDialog } from './components/dialogs/ModelDialog.js';
import { EffortDialog } from './components/dialogs/EffortDialog.js';
import { ThemeDialog } from './components/dialogs/ThemeDialog.js';
import { ResumeDialog } from './components/dialogs/ResumeDialog.js';

const VALID_REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'max',
];

const EFFORT_OPTIONS: { level: ReasoningEffort; description: string }[] = [
  { level: 'none', description: 'Disable reasoning / thinking tokens completely' },
  { level: 'low', description: 'Fast reasoning with minimal thinking tokens' },
  { level: 'medium', description: 'Balanced reasoning for typical engineering tasks' },
  { level: 'high', description: 'Deep reasoning with extended thinking tokens' },
  { level: 'max', description: 'Maximum thinking effort budget for complex problems' },
];

const THEME_OPTIONS: { name: string; description: string }[] = [
  { name: 'default', description: 'Modern dark theme with high contrast card surfaces' },
  { name: 'github', description: 'GitHub Dark modern aesthetic' },
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

export type ActiveDialogType = 'commands' | 'model' | 'effort' | 'theme' | 'resume' | null;

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

  // Pre-load model list from @steward/models (all models, no filter)
  const [allModels, setAllModels] = useState<readonly ModelMetadata[]>([]);
  useEffect(() => {
    let mounted = true;
    createModels()
      .list()
      .then((list) => {
        if (mounted) setAllModels(list);
      })
      .catch(() => {
        if (mounted) {
          setAllModels([
            {
              provider: 'google',
              id: 'gemini-2.5-flash',
              name: 'Gemini 2.5 Flash',
              reasoning: false,
              toolCall: true,
              inputModalities: ['text'],
              outputModalities: ['text'],
              contextWindow: 1048576,
            },
            {
              provider: 'google',
              id: 'gemini-3.1-flash-lite',
              name: 'Gemini 3.1 Flash Lite',
              reasoning: false,
              toolCall: true,
              inputModalities: ['text'],
              outputModalities: ['text'],
              contextWindow: 1048576,
            },
            {
              provider: 'anthropic',
              id: 'claude-3-7-sonnet',
              name: 'Claude 3.7 Sonnet',
              reasoning: true,
              toolCall: true,
              inputModalities: ['text'],
              outputModalities: ['text'],
              contextWindow: 200000,
            },
            {
              provider: 'openai',
              id: 'gpt-4o',
              name: 'GPT-4o',
              reasoning: false,
              toolCall: true,
              inputModalities: ['text'],
              outputModalities: ['text'],
              contextWindow: 128000,
            },
          ]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const [savedThreads, setSavedThreads] = useState<readonly ThreadSummary[]>([]);
  const threadDocRef = useRef<ThreadDocument | null>(null);

  const refreshSavedThreads = async () => {
    try {
      const list = await threadStore.list();
      setSavedThreads(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshSavedThreads();
  }, []);

  const app = useApp();

  const exitApp = async () => {
    if (threadDocRef.current && threadDocRef.current.messages.length > 0) {
      try {
        await threadStore.save(threadDocRef.current);
      } catch {
        // ignore
      }
    }
    app.exit();
  };

  // Dialog State
  const [activeDialog, setActiveDialog] = useState<ActiveDialogType>(null);
  const [dialogSelectedIndex, setDialogSelectedIndex] = useState(0);

  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // Ref mirrors for fast typing & paste synchronization
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const cursorPosRef = useRef(cursorPos);
  cursorPosRef.current = cursorPos;

  const spinnerChar = useSpinner(state.status === 'running');
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

  // Compute effective dialog
  const isInputStartingSlash = inputText.startsWith('/') && state.status !== 'running';
  const effectiveDialogType: ActiveDialogType =
    activeDialog ?? (isInputStartingSlash ? 'commands' : null);

  // Compute search/filter query
  const filterQuery = (
    effectiveDialogType === 'commands' && inputText.startsWith('/') ? inputText.slice(1) : inputText
  )
    .trim()
    .toLowerCase();

  // Filter dialog items
  const filteredCommands = useMemo(() => {
    if (!filterQuery) return BUILTIN_COMMANDS;
    return BUILTIN_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(filterQuery) ||
        (cmd.aliases && cmd.aliases.some((a) => a.toLowerCase().includes(filterQuery))),
    );
  }, [filterQuery]);

  const filteredModels = useMemo(() => {
    if (!filterQuery) return allModels;
    return allModels.filter(
      (m) =>
        m.id.toLowerCase().includes(filterQuery) ||
        m.provider.toLowerCase().includes(filterQuery) ||
        m.name.toLowerCase().includes(filterQuery),
    );
  }, [allModels, filterQuery]);

  const filteredEfforts = useMemo(() => {
    if (!filterQuery) return EFFORT_OPTIONS;
    return EFFORT_OPTIONS.filter((e) => e.level.toLowerCase().includes(filterQuery));
  }, [filterQuery]);

  const filteredThemes = useMemo(() => {
    if (!filterQuery) return THEME_OPTIONS;
    return THEME_OPTIONS.filter((t) => t.name.toLowerCase().includes(filterQuery));
  }, [filterQuery]);

  const filteredThreads = useMemo(() => {
    if (!filterQuery) return savedThreads;
    return savedThreads.filter(
      (t) =>
        t.title.toLowerCase().includes(filterQuery) ||
        t.id.toLowerCase().includes(filterQuery) ||
        t.model.modelId.toLowerCase().includes(filterQuery),
    );
  }, [savedThreads, filterQuery]);

  // Current dialog count
  let currentDialogCount = 0;
  if (effectiveDialogType === 'commands') currentDialogCount = filteredCommands.length;
  else if (effectiveDialogType === 'model') currentDialogCount = filteredModels.length;
  else if (effectiveDialogType === 'effort') currentDialogCount = filteredEfforts.length;
  else if (effectiveDialogType === 'theme') currentDialogCount = filteredThemes.length;
  else if (effectiveDialogType === 'resume') currentDialogCount = filteredThreads.length;

  const safeSelectedIndex = Math.min(dialogSelectedIndex, Math.max(0, currentDialogCount - 1));

  const executePrompt = async (promptToRun: string) => {
    const trimmed = promptToRun.trim();
    if (!trimmed || state.status === 'running') return;

    // Handle Slash Commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const commandArg = parts.slice(1).join(' ').trim();

      if (commandName === 'exit' || commandName === 'quit' || commandName === 'q') {
        await exitApp();
        return;
      }
      if (commandName === 'new' || commandName === 'clear' || commandName === 'reset') {
        if (threadDocRef.current && threadDocRef.current.messages.length > 0) {
          await threadStore.save(threadDocRef.current).catch(() => {});
        }
        threadDocRef.current = null;
        dispatch({ type: 'NEW_SESSION' });
        setActiveDialog(null);
        setInputText('');
        setCursorPos(0);
        refreshSavedThreads();
        return;
      }
      if (commandName === 'theme') {
        if (commandArg) {
          const nextTheme = themeManager.getTheme(commandArg);
          themeManager.setTheme(commandArg);
          dispatch({ type: 'SET_THEME', theme: nextTheme });
          setInputText('');
          setCursorPos(0);
          return;
        }
        setActiveDialog('theme');
        setDialogSelectedIndex(0);
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'model') {
        if (commandArg) {
          const nextModel = parseModel(commandArg, state.modelRef.provider, state.modelRef.modelId);
          dispatch({ type: 'SET_MODEL', modelRef: nextModel });
          setInputText('');
          setCursorPos(0);
          return;
        }
        setActiveDialog('model');
        setDialogSelectedIndex(0);
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'effort') {
        if (commandArg) {
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
        setActiveDialog('effort');
        setDialogSelectedIndex(0);
        setInputText('');
        setCursorPos(0);
        return;
      }
      if (commandName === 'resume') {
        await refreshSavedThreads();
        setActiveDialog('resume');
        setDialogSelectedIndex(0);
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
      if (commandName === 'compact') {
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
            text: 'Context compacted.',
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
    setActiveDialog(null);

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

      if (finalResult.value) {
        if (!threadDocRef.current) {
          threadDocRef.current = threadStore.create({
            model: {
              provider: state.modelRef.provider,
              modelId: state.modelRef.modelId,
              reasoning: state.reasoningEffort,
            },
            cwd: state.cwd,
            messages: [],
          });
        }

        threadDocRef.current.messages.push({ role: 'user', content: trimmed });
        if (finalResult.value.responseMessages && finalResult.value.responseMessages.length > 0) {
          threadDocRef.current.messages.push(...finalResult.value.responseMessages);
        }

        if (finalResult.value.usage) {
          threadDocRef.current.usage.inputTokens += finalResult.value.usage.inputTokens;
          threadDocRef.current.usage.outputTokens += finalResult.value.usage.outputTokens;
          threadDocRef.current.usage.totalTokens += finalResult.value.usage.totalTokens;
          if (finalResult.value.usage.reasoningTokens) {
            threadDocRef.current.usage.reasoningTokens =
              (threadDocRef.current.usage.reasoningTokens || 0) +
              finalResult.value.usage.reasoningTokens;
          }
        }

        await threadStore.save(threadDocRef.current);
        refreshSavedThreads();
      }
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
        exitApp();
        return true;
      }

      // Toggle expand all bash cards (Ctrl+O)
      if (ev.key.ctrl && (ev.key.name === 'o' || ev.key.name === '0')) {
        dispatch({ type: 'TOGGLE_EXPAND_ALL_BASH_CARDS' });
        return true;
      }

      // Command palette trigger (Ctrl+P)
      if (ev.key.ctrl && ev.key.name === 'p') {
        if (effectiveDialogType === 'commands') {
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
        } else {
          setActiveDialog('commands');
          setDialogSelectedIndex(0);
          setInputText('');
          setCursorPos(0);
        }
        return true;
      }

      // Escape key: dismiss dialog or abort run
      if (ev.key.name === 'escape') {
        if (state.status === 'running') {
          abortControllerRef.current?.abort();
          dispatch({ type: 'ABORT_TURN' });
          return true;
        }
        if (effectiveDialogType !== null) {
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
          setDialogSelectedIndex(0);
          return true;
        }
      }

      // 2. Dialog Up/Down Arrow Navigation
      if (effectiveDialogType !== null) {
        if (ev.key.upArrow) {
          if (currentDialogCount > 0) {
            setDialogSelectedIndex((prev) => (prev - 1 + currentDialogCount) % currentDialogCount);
          }
          return true;
        }
        if (ev.key.downArrow) {
          if (currentDialogCount > 0) {
            setDialogSelectedIndex((prev) => (prev + 1) % currentDialogCount);
          }
          return true;
        }
      }

      // 3. Autocomplete Tab confirmation in commands dialog
      if (ev.key.tab && effectiveDialogType === 'commands') {
        const selected = filteredCommands[safeSelectedIndex];
        if (selected) {
          const completed = `/${selected.name} `;
          inputTextRef.current = completed;
          cursorPosRef.current = completed.length;
          setInputText(completed);
          setCursorPos(completed.length);
          return true;
        }
      }

      // 4. Return / Confirm Selection in Dialog or Submit Prompt
      if (ev.key.return) {
        if (effectiveDialogType === 'commands') {
          const selected = filteredCommands[safeSelectedIndex];
          if (selected) {
            if (selected.name === 'new' || selected.name === 'clear' || selected.name === 'reset') {
              if (threadDocRef.current && threadDocRef.current.messages.length > 0) {
                threadStore.save(threadDocRef.current).catch(() => {});
              }
              threadDocRef.current = null;
              dispatch({ type: 'NEW_SESSION' });
              setActiveDialog(null);
              setInputText('');
              setCursorPos(0);
              refreshSavedThreads();
              return true;
            }
            if (selected.name === 'model') {
              setActiveDialog('model');
              setDialogSelectedIndex(0);
              setInputText('');
              setCursorPos(0);
              return true;
            }
            if (selected.name === 'effort') {
              setActiveDialog('effort');
              setDialogSelectedIndex(0);
              setInputText('');
              setCursorPos(0);
              return true;
            }
            if (selected.name === 'theme') {
              setActiveDialog('theme');
              setDialogSelectedIndex(0);
              setInputText('');
              setCursorPos(0);
              return true;
            }
            if (selected.name === 'resume') {
              refreshSavedThreads().then(() => {
                setActiveDialog('resume');
                setDialogSelectedIndex(0);
                setInputText('');
                setCursorPos(0);
              });
              return true;
            }
            if (selected.name === 'exit' || selected.name === 'quit' || selected.name === 'q') {
              exitApp();
              return true;
            }
            if (selected.name === 'settings' || selected.name === 'config') {
              executePrompt('/settings');
              setActiveDialog(null);
              setInputText('');
              setCursorPos(0);
              return true;
            }
            if (selected.name === 'compact') {
              executePrompt('/compact');
              setActiveDialog(null);
              setInputText('');
              setCursorPos(0);
              return true;
            }
          }
        }

        if (effectiveDialogType === 'model') {
          const selected = filteredModels[safeSelectedIndex];
          if (selected) {
            dispatch({
              type: 'SET_MODEL',
              modelRef: { provider: selected.provider, modelId: selected.id },
            });
          }
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
          return true;
        }

        if (effectiveDialogType === 'effort') {
          const selected = filteredEfforts[safeSelectedIndex];
          if (selected) {
            dispatch({ type: 'SET_EFFORT', effort: selected.level });
          }
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
          return true;
        }

        if (effectiveDialogType === 'theme') {
          const selected = filteredThemes[safeSelectedIndex];
          if (selected) {
            const nextTheme = themeManager.getTheme(selected.name);
            themeManager.setTheme(selected.name);
            dispatch({ type: 'SET_THEME', theme: nextTheme });
          }
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
          return true;
        }

        if (effectiveDialogType === 'resume') {
          const selected = filteredThreads[safeSelectedIndex];
          if (selected) {
            threadStore.load(selected.id).then((doc) => {
              if (doc) {
                threadDocRef.current = doc;
                const turns = reconstructTurnsFromMessages(doc.messages);
                dispatch({
                  type: 'LOAD_THREAD',
                  history: turns,
                  modelRef: doc.model,
                  metrics: doc.usage,
                  threadDoc: doc,
                });
              }
            });
          }
          setActiveDialog(null);
          setInputText('');
          setCursorPos(0);
          return true;
        }

        // Standard prompt submit
        const textToSubmit = inputTextRef.current;
        executePrompt(textToSubmit);
        return true;
      }

      // 5. History Navigation (when not in a dialog and input is empty)
      if (effectiveDialogType === null && inputText.length === 0 && !state.activeTurn) {
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

      // 6. Cursor Left/Right
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

      // 7. Backspace / Delete
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
          setDialogSelectedIndex(0);
        } else if (activeDialog !== null) {
          setActiveDialog(null);
        }
        return true;
      }

      // 8. Regular Typing
      if (ev.input) {
        const pos = cursorPosRef.current;
        const current = inputTextRef.current;
        const updated = current.slice(0, pos) + ev.input + current.slice(pos);
        const nextPos = pos + ev.input.length;

        inputTextRef.current = updated;
        cursorPosRef.current = nextPos;
        setInputText(updated);
        setCursorPos(nextPos);
        setDialogSelectedIndex(0);
        return true;
      }
    }

    // 9. Bracketed Paste Handling
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
      setDialogSelectedIndex(0);
      return true;
    }
  });

  const hasStarted = state.history.length > 0 || state.activeTurn !== null;

  // Placeholder text for PromptInput depending on dialog
  let inputPlaceholder: string | undefined;
  if (effectiveDialogType === 'commands') {
    inputPlaceholder = 'Filter commands...';
  } else if (effectiveDialogType === 'model') {
    inputPlaceholder = 'Filter models (e.g. gemini, claude, gpt)...';
  } else if (effectiveDialogType === 'effort') {
    inputPlaceholder = 'Select reasoning effort (none, low, medium, high, max)...';
  } else if (effectiveDialogType === 'theme') {
    inputPlaceholder = 'Select visual theme (default, github)...';
  } else if (effectiveDialogType === 'resume') {
    inputPlaceholder = 'Filter saved threads...';
  }

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

      {/* 4. Active Dialog Panel Floating Above Input */}
      {effectiveDialogType === 'commands' && (
        <CommandPaletteDialog
          commands={filteredCommands}
          selectedIndex={safeSelectedIndex}
          theme={state.theme}
        />
      )}

      {effectiveDialogType === 'model' && (
        <ModelDialog
          models={filteredModels}
          selectedIndex={safeSelectedIndex}
          currentModelId={state.modelRef.modelId}
          theme={state.theme}
        />
      )}

      {effectiveDialogType === 'effort' && (
        <EffortDialog
          currentEffort={state.reasoningEffort}
          selectedIndex={safeSelectedIndex}
          theme={state.theme}
        />
      )}

      {effectiveDialogType === 'theme' && (
        <ThemeDialog
          currentThemeName={state.theme.name}
          selectedIndex={safeSelectedIndex}
          theme={state.theme}
        />
      )}

      {effectiveDialogType === 'resume' && (
        <ResumeDialog
          threads={filteredThreads}
          selectedIndex={safeSelectedIndex}
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
        placeholder={inputPlaceholder}
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
