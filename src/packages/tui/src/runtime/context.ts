export interface Context<T> {
  id: symbol;
  defaultValue: T;
  Provider: (props: { value: T; children: any }) => any;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const id = Symbol('stitchable.context');
  const context: Context<T> = {
    id,
    defaultValue,
    Provider: ({ value, children }: { value: T; children: any }) => {
      return {
        type: 'ContextProvider',
        context,
        value,
        children: Array.isArray(children) ? children : [children],
      };
    },
  };
  return context;
}

export interface AppContextValue {
  exit: (errorOrValue?: any) => void;
}

export const AppContext = createContext<AppContextValue>({
  exit: () => {},
});

export interface StdoutContextValue {
  stdout?: any;
  write: (data: string) => void;
}

export const StdoutContext = createContext<StdoutContextValue>({
  write: () => {},
});

export interface StdinContextValue {
  stdin?: any;
  isRawModeSupported: boolean;
  setRawMode: (on: boolean) => void;
}

export const StdinContext = createContext<StdinContextValue>({
  isRawModeSupported: true,
  setRawMode: () => {},
});

export interface FocusContextValue {
  activeId: string | null;
  isFocusEnabled: boolean;
  register: (id: string, autoFocus?: boolean) => void;
  unregister: (id: string) => void;
  focus: (id: string) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  enableFocus: () => void;
  disableFocus: () => void;
}

export const FocusContext = createContext<FocusContextValue>({
  activeId: null,
  isFocusEnabled: true,
  register: () => {},
  unregister: () => {},
  focus: () => {},
  focusNext: () => {},
  focusPrevious: () => {},
  enableFocus: () => {},
  disableFocus: () => {},
});
