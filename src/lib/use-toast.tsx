"use client";

import * as React from "react";
import type { ToastActionElement } from "@/types/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

export type ToastVariant = "default" | "success" | "destructive";

export type ToastProps = {
  id: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: ToastVariant;
};

type ToastState = {
  toasts: ToastProps[];
};

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToastProps }
  | { type: "REMOVE_TOAST"; id: string };

const ToastContext = React.createContext<{
  state: ToastState;
  dispatch: React.Dispatch<ToastAction>;
} | null>(null);

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "REMOVE_TOAST":
      return {
        toasts: state.toasts.filter((toast) => toast.id !== action.id),
      };
    default:
      return state;
  }
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  return (
    <ToastContext.Provider value={{ state, dispatch }}>
      {children}
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  const { state, dispatch } = context;

  const toast = React.useCallback(
    ({ title, description, action, variant }: Omit<ToastProps, "id">) => {
      const id = Math.random().toString(36).slice(2, 9);
      dispatch({ type: "ADD_TOAST", toast: { id, title, description, action, variant } });
      window.setTimeout(() => dispatch({ type: "REMOVE_TOAST", id }), TOAST_REMOVE_DELAY);
    },
    [dispatch]
  );

  return {
    toast,
    toasts: state.toasts,
  };
}

export { ToastProvider, useToast };
