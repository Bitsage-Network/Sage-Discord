"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { ConditionCard } from "./ConditionCard"
import { LogicGateSelector } from "./LogicGateSelector"
import { ConditionBuilder } from "./ConditionBuilder"
import { EditConditionDialog } from "./EditConditionDialog"
import { Button } from "@/components/ui/button"
import { RuleGroup, Condition, Role } from "@/types/requirement-builder"

interface RequirementGroupProps {
  group: RuleGroup
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<RuleGroup>) => void
  onDelete: () => void
  guildId: string
}

export function RequirementGroup({
  group,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  guildId,
}: RequirementGroupProps) {
  const [showConditionBuilder, setShowConditionBuilder] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [localName, setLocalName] = useState(group.name)
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  // Set up drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleNameSave = () => {
    if (localName.trim() !== group.name) {
      onUpdate({ name: localName.trim() })
    }
    setEditingName(false)
  }

  const handleLogicOperatorChange = (newOperator: "AND" | "OR" | "NOT") => {
    onUpdate({ logic_operator: newOperator })
  }

  const handleAddCondition = (condition: Condition) => {
    const newConditions = [
      ...group.conditions,
      { ...condition, position: group.conditions.length },
    ]
    onUpdate({ conditions: newConditions })
    setShowConditionBuilder(false)
  }

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...group.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onUpdate({ conditions: newConditions })
  }

  const handleDeleteCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index)
    onUpdate({ conditions: newConditions })
  }

  const handleToggleNegate = (index: number) => {
    handleUpdateCondition(index, { negate: !group.conditions[index].negate })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = group.conditions.findIndex((c) => c.id === active.id)
    const newIndex = group.conditions.findIndex((c) => c.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistic update - reorder locally
    const reorderedConditions = arrayMove(group.conditions, oldIndex, newIndex)
    onUpdate({ conditions: reorderedConditions })

    // Call API to persist the reorder
    setIsReordering(true)
    try {
      const conditionIds = reorderedConditions.map((c) => c.id).filter((id): id is number => id !== undefined)

      const response = await fetch(
        `/api/guilds/${guildId}/rule-groups/${group.id}/conditions/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conditionIds }),
        }
      )

      if (!response.ok) {
        // Revert on error
        onUpdate({ conditions: group.conditions })
        console.error("Failed to reorder conditions")
      }
    } catch (error) {
      // Revert on error
      onUpdate({ conditions: group.conditions })
      console.error("Error reordering conditions:", error)
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
          : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {editingName ? (
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave()
                if (e.key === "Escape") {
                  setLocalName(group.name)
                  setEditingName(false)
                }
              }}
              autoFocus
              className="w-full bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <h3
              className="text-lg font-semibold text-white cursor-text hover:text-blue-400"
              onClick={(e) => {
                e.stopPropagation()
                setEditingName(true)
              }}
            >
              {group.name}
            </h3>
          )}
          <p className="text-sm text-gray-400 mt-1">{group.description}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            🗑️
          </Button>
        </div>
      </div>

      {/* Logic Gate Selector */}
      <div className="mb-4">
        <LogicGateSelector
          value={group.logic_operator}
          onChange={handleLogicOperatorChange}
        />
      </div>

      {/* Conditions */}
      <div className="space-y-2 mb-4">
        {group.conditions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg">
            <p className="text-gray-500 mb-2">No conditions yet</p>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowConditionBuilder(true)
              }}
            >
              ➕ Add First Condition
            </Button>
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={group.conditions.map((c) => c.id || `temp-${Math.random()}`)}
                strategy={verticalListSortingStrategy}
              >
                {group.conditions.map((condition, index) => (
                  <div key={condition.id || index}>
                    {index > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <span className="text-xs font-mono font-semibold px-2 py-1 bg-gray-700 rounded text-gray-300">
                          {group.logic_operator}
                        </span>
                      </div>
                    )}
                    <ConditionCard
                      condition={condition}
                      conditionIndex={index}
                      onUpdate={(updates) => handleUpdateCondition(index, updates)}
                      onDelete={() => handleDeleteCondition(index)}
                      onToggleNegate={() => handleToggleNegate(index)}
                      onEdit={setEditingConditionIndex}
                      guildId={guildId}
                    />
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowConditionBuilder(true)
              }}
              className="w-full"
              disabled={isReordering}
            >
              ➕ Add Condition
            </Button>
          </>
        )}
      </div>

      {/* Role Assignments */}
      {group.roles && group.roles.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Assigned Roles</h4>
          <div className="flex flex-wrap gap-2">
            {group.roles.map((role, index) => (
              <div
                key={index}
                className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full text-sm text-blue-300"
              >
                {role.role_name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Condition Builder Modal */}
      {showConditionBuilder && (
        <ConditionBuilder
          onAdd={handleAddCondition}
          onClose={() => setShowConditionBuilder(false)}
          guildId={guildId}
        />
      )}

      {/* Edit Condition Dialog */}
      {editingConditionIndex !== null && (
        <EditConditionDialog
          condition={group.conditions[editingConditionIndex]}
          conditionIndex={editingConditionIndex}
          onUpdate={handleUpdateCondition}
          onClose={() => setEditingConditionIndex(null)}
          guildId={guildId}
        />
      )}
    </div>
  )
}
