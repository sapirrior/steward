import { useContext } from '../reconciler/context.js';
import { AppContext, type AppContextValue } from '../runtime/AppContext.js';

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export default useApp;
