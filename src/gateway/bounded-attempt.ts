import { AsyncLocalStorage } from 'node:async_hooks'
/** Server-owned hook. Never serialized into prompts, tool schemas or client metadata. */
export interface AttemptInvocation { stage: 'tier'|'coding'|'guardrail'; provider: string; request: unknown }
export interface AttemptBoundary { invoke<T>(input: AttemptInvocation, run: () => Promise<T>): Promise<T> }
const active = new AsyncLocalStorage<AttemptBoundary>()
export function withAttemptBoundary<T>(boundary: AttemptBoundary, run: () => Promise<T>): Promise<T> { return active.run(boundary, run) }
export function invokeBoundedAttempt<T>(input: AttemptInvocation, run: () => Promise<T>): Promise<T> { const b=active.getStore();return b?b.invoke(input,run):run() }
