"use client"

import * as React from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7)
    const newToast: Toast = { ...toast, id }

    setToasts((prev) => [...prev, newToast])

    // Auto-remove after duration (default 5s)
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onClose: () => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const [isExiting, setIsExiting] = React.useState(false)

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 200) // Wait for animation
  }

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }[toast.type]

  const styles = {
    success: "bg-emerald-500/10 border-emerald-500/50 text-emerald-500",
    error: "bg-red-500/10 border-red-500/50 text-red-500",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-500",
    warning: "bg-orange-500/10 border-orange-500/50 text-orange-500",
  }[toast.type]

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm transition-all duration-200",
        styles,
        isExiting
          ? "opacity-0 translate-x-full"
          : "opacity-100 translate-x-0 animate-in slide-in-from-right"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Helper functions for common use cases
export function toast

(options: Omit<Toast, "id">) {
  // This will be called from components using useToast hook
  // Keeping this for future reference if we want imperative API
}

export const toastHelpers = {
  success: (title: string, description?: string) => ({
    type: "success" as ToastType,
    title,
    description,
  }),
  error: (title: string, description?: string) => ({
    type: "error" as ToastType,
    title,
    description,
  }),
  info: (title: string, description?: string) => ({
    type: "info" as ToastType,
    title,
    description,
  }),
  warning: (title: string, description?: string) => ({
    type: "warning" as ToastType,
    title,
    description,
  }),
}
