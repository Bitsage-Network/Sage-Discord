"use client"

interface LogicGateSelectorProps {
  value: "AND" | "OR" | "NOT"
  onChange: (value: "AND" | "OR" | "NOT") => void
}

export function LogicGateSelector({ value, onChange }: LogicGateSelectorProps) {
  const options = [
    {
      value: "AND" as const,
      label: "AND",
      description: "All conditions must pass",
      icon: "∧",
      color: "blue" as const,
    },
    {
      value: "OR" as const,
      label: "OR",
      description: "Any condition can pass",
      icon: "∨",
      color: "green" as const,
    },
    {
      value: "NOT" as const,
      label: "NOT",
      description: "No conditions should pass",
      icon: "¬",
      color: "red" as const,
    },
  ]

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-400">Logic Gate:</label>
      <div className="flex gap-2">
        {options.map((option) => {
          const isSelected = value === option.value
          const colorClasses = {
            blue: {
              bg: "bg-blue-500/20 border-blue-500/50 text-blue-300",
              hover: "hover:bg-blue-500/30",
              border: "border-blue-500",
            },
            green: {
              bg: "bg-green-500/20 border-green-500/50 text-green-300",
              hover: "hover:bg-green-500/30",
              border: "border-green-500",
            },
            red: {
              bg: "bg-red-500/20 border-red-500/50 text-red-300",
              hover: "hover:bg-red-500/30",
              border: "border-red-500",
            },
          }[option.color]

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                px-4 py-2 rounded-lg border-2 transition-all
                ${
                  isSelected
                    ? `${colorClasses.bg} ${colorClasses.border} font-semibold shadow-lg`
                    : `border-gray-600 bg-gray-700/30 text-gray-400 ${colorClasses.hover}`
                }
              `}
              title={option.description}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono">{option.icon}</span>
                <span className="font-semibold">{option.label}</span>
              </div>
              {isSelected && (
                <div className="text-xs mt-0.5 opacity-80">{option.description}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
