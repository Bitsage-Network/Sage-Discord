"use client"

import { ButtonHTMLAttributes, forwardRef } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "md", className = "", children, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"

    const variantClasses = {
      default: "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700",
      outline:
        "border-2 border-gray-600 bg-transparent text-gray-300 hover:border-gray-500 hover:bg-gray-700/50",
      ghost: "bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-300",
      destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
    }

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    }

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"
