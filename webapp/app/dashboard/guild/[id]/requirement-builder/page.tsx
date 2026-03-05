"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { RequirementGroup } from "@/components/requirement-builder/RequirementGroup"
import { TemplateSelector } from "@/components/requirement-builder/TemplateSelector"
import { LivePreview } from "@/components/requirement-builder/LivePreview"
import { CreateGroupDialog, CreateGroupData } from "@/components/requirement-builder/CreateGroupDialog"
import { Button } from "@/components/ui/button"
import { RuleGroup } from "@/types/requirement-builder"

export default function RequirementBuilderPage() {
  const params = useParams()
  const guildId = params.id as string

  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<RuleGroup | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing rule groups
  useEffect(() => {
    fetchGroups()
  }, [guildId])

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/guilds/${guildId}/rule-groups`)
      const data = await res.json()

      if (data.success) {
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error("Error fetching groups:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (groupData: CreateGroupData) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/rule-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupData.name,
          description: groupData.description,
          logic_operator: groupData.logic_operator,
          position: groups.length,
          conditions: [],
          roles: [],
        }),
      })

      const data = await res.json()

      if (data.success) {
        await fetchGroups()
        setSelectedGroup(data.group)
        setShowCreateDialog(false)
      }
    } catch (error) {
      console.error("Error creating group:", error)
      throw error // Re-throw to let dialog handle it
    }
  }

  const handleUpdateGroup = async (groupId: number, updates: Partial<RuleGroup>) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/rule-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await res.json()

      if (data.success) {
        await fetchGroups()
      }
    } catch (error) {
      console.error("Error updating group:", error)
    }
  }

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm("Are you sure you want to delete this requirement group?")) {
      return
    }

    try {
      const res = await fetch(`/api/guilds/${guildId}/rule-groups/${groupId}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (data.success) {
        await fetchGroups()
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null)
        }
      }
    } catch (error) {
      console.error("Error deleting group:", error)
    }
  }

  const handleApplyTemplate = async (template: any) => {
    try {
      // Transform template conditions to API format
      const transformedConditions = (template.structure.conditions || []).map((cond: any, index: number) => ({
        condition_type: cond.type,
        condition_data: cond.params || {},
        negate: false,
        position: index,
        label: cond.label || null,
      }))

      // Create a new group from template
      const res = await fetch(`/api/guilds/${guildId}/rule-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          logic_operator: template.structure.operator || "AND",
          position: groups.length,
          conditions: transformedConditions,
          roles: [],
        }),
      })

      const data = await res.json()

      if (data.success) {
        await fetchGroups()
        setSelectedGroup(data.group)
        setShowTemplates(false)
      }
    } catch (error) {
      console.error("Error applying template:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading requirement builder...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-800/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Visual Requirement Builder</h1>
            <p className="text-sm text-gray-400 mt-1">
              Design complex access requirements with logic gates and nested conditions
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTemplates(true)}
            >
              📚 Templates
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              👁️ {showPreview ? "Hide" : "Show"} Preview
            </Button>

            <Button onClick={() => setShowCreateDialog(true)}>
              ➕ New Requirement Group
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Rule Groups */}
        <div className="flex-1 overflow-y-auto p-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                No requirement groups yet
              </h2>
              <p className="text-gray-400 mb-6 max-w-md">
                Create your first requirement group to start defining access rules with
                logic gates, nested conditions, and role assignments.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setShowCreateDialog(true)}>
                  ➕ Create First Group
                </Button>
                <Button variant="outline" onClick={() => setShowTemplates(true)}>
                  📚 Browse Templates
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <RequirementGroup
                  key={group.id}
                  group={group}
                  isSelected={selectedGroup?.id === group.id}
                  onSelect={() => setSelectedGroup(group)}
                  onUpdate={(updates) => handleUpdateGroup(group.id, updates)}
                  onDelete={() => handleDeleteGroup(group.id)}
                  guildId={guildId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Preview (collapsible) */}
        {showPreview && selectedGroup && (
          <div className="w-96 border-l border-gray-800 bg-gray-800/30 overflow-y-auto">
            <LivePreview guildId={guildId} groupId={selectedGroup.id} />
          </div>
        )}
      </div>

      {/* Template Selector Modal */}
      {showTemplates && (
        <TemplateSelector
          onApply={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateGroup}
        guildId={guildId}
      />
    </div>
  )
}
