"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

interface CreateGroupDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (groupData: CreateGroupData) => Promise<void>
  guildId: string
}

export interface CreateGroupData {
  name: string
  description: string
  logic_operator: "AND" | "OR" | "NOT"
}

export function CreateGroupDialog({
  open,
  onClose,
  onCreate,
  guildId,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logicOperator, setLogicOperator] = useState<"AND" | "OR" | "NOT">("AND")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Name is required"
    } else if (name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters"
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must be less than 100 characters"
    }

    if (description.length > 500) {
      newErrors.description = "Description must be less than 500 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        logic_operator: logicOperator,
      })

      // Reset form
      setName("")
      setDescription("")
      setLogicOperator("AND")
      setErrors({})
    } catch (error) {
      console.error("Error creating group:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const logicOperatorOptions = [
    {
      value: "AND" as const,
      label: "AND",
      description: "All conditions must be true",
      icon: "∧",
    },
    {
      value: "OR" as const,
      label: "OR",
      description: "At least one condition must be true",
      icon: "∨",
    },
    {
      value: "NOT" as const,
      label: "NOT",
      description: "Negate all conditions",
      icon: "¬",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Requirement Group</DialogTitle>
          <DialogDescription>
            Set up a new requirement group with logic gates and conditions to define who
            qualifies for roles.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Staker Requirements"
              className={errors.name ? "border-red-500" : ""}
              disabled={isSubmitting}
              maxLength={100}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {name.length}/100 characters
            </p>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description to explain this requirement group..."
              className={errors.description ? "border-red-500" : ""}
              disabled={isSubmitting}
              maxLength={500}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters
            </p>
          </div>

          {/* Logic Operator Selection */}
          <div className="space-y-2">
            <Label>Logic Operator</Label>
            <div className="grid gap-2">
              {logicOperatorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLogicOperator(option.value)}
                  disabled={isSubmitting}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    logicOperator === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary text-xl font-bold flex-shrink-0">
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{option.label}</span>
                      {logicOperator === option.value && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
