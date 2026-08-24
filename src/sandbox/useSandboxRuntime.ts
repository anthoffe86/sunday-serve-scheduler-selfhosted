import { useSyncExternalStore } from 'react';
import {
  getSandboxPersonas,
  getSandboxState,
  resetSandboxState,
  setSandboxPersona,
  subscribeSandboxState,
} from './runtime';

export function useSandboxStateVersion() {
  return useSyncExternalStore(
    subscribeSandboxState,
    () => getSandboxState().version + getSandboxState().assignmentPickCounter,
    () => 0
  );
}

export function useSandboxPersonas() {
  useSyncExternalStore(subscribeSandboxState, () => getSandboxState().currentUserId, () => '');
  return getSandboxPersonas();
}

export function useSandboxActions() {
  return {
    setPersona: setSandboxPersona,
    reset: resetSandboxState,
  };
}
