import { useContext as useCtx, type Context } from '../reconciler/context.js';

export function useContext<T>(context: Context<T>): T {
  return useCtx(context);
}

export default useContext;
