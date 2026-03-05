"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { TemplatePreviewDialog } from "./TemplatePreviewDialog"

interface Template {
  id: number
  name: string
  description: string
  category: string
  icon: string
  structure: any
  usage_count: number
  is_public: boolean
}

interface TemplateSelectorProps {
  onApply: (template: Template) => void
  onClose: () => void
}

export function TemplateSelector({ onApply, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [selectedCategory])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const url = selectedCategory
        ? `/api/templates?category=${selectedCategory}`
        : "/api/templates"
      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setTemplates(data.templates || [])
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      defi: "DeFi",
      nft: "NFT",
      work: "Work & Contribution",
      advanced: "Advanced",
      custom: "Custom",
    }
    return labels[category] || category
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Template Library</h2>
          <p className="text-sm text-gray-400 mt-1">
            Choose from pre-built requirement templates
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Categories */}
          <div className="w-48 border-r border-gray-700 bg-gray-800/50 p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
              Categories
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`
                  w-full text-left px-3 py-2 rounded transition-all text-sm
                  ${
                    selectedCategory === null
                      ? "bg-blue-500 text-white"
                      : "text-gray-400 hover:bg-gray-700"
                  }
                `}
              >
                All Templates
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setSelectedCategory(cat.category)}
                  className={`
                    w-full text-left px-3 py-2 rounded transition-all text-sm flex items-center justify-between
                    ${
                      selectedCategory === cat.category
                        ? "bg-blue-500 text-white"
                        : "text-gray-400 hover:bg-gray-700"
                    }
                  `}
                >
                  <span>{getCategoryLabel(cat.category)}</span>
                  <span className="text-xs opacity-60">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main - Templates Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">📚</div>
                <p>No templates found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-700 rounded-lg p-4 bg-gray-700/30 hover:border-blue-500/50 hover:bg-gray-700/50 transition-all cursor-pointer group"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="text-3xl">{template.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {template.name}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-gray-600/50 rounded text-xs text-gray-300">
                        {getCategoryLabel(template.category)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Used {template.usage_count}x
                      </span>
                    </div>

                    {/* Preview Structure (simplified) */}
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="text-xs text-gray-400">
                        {template.structure.conditions?.length || 0} condition(s)
                        {template.structure.groups &&
                          `, ${template.structure.groups.length} group(s)`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Template Preview Dialog */}
      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          onApply={() => {
            onApply(previewTemplate)
            setPreviewTemplate(null)
          }}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  )
}
