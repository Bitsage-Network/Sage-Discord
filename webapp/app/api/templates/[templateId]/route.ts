import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/templates/[templateId]
// Get a specific template
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const templateId = parseInt(params.templateId)

    const result = await query(
      `SELECT * FROM rule_templates WHERE id = $1`,
      [templateId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const template = result.rows[0]

    // Check if template is accessible (public or owned by user)
    const session = await getServerSession(authOptions)
    if (!template.is_public) {
      if (!session?.user?.discordId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Check if user owns this template
      const ownerCheck = await query(
        `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2`,
        [template.created_by, session.user.discordId]
      )

      if (ownerCheck.rows.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Increment usage count
    await query(
      `UPDATE rule_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId]
    )

    return NextResponse.json({
      success: true,
      template,
    })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/templates/[templateId]
// Update a template (only if owned by user)
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templateId = parseInt(params.templateId)

    // Get template
    const templateResult = await query(
      `SELECT * FROM rule_templates WHERE id = $1`,
      [templateId]
    )

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const template = templateResult.rows[0]

    // Check ownership
    if (template.created_by) {
      const ownerCheck = await query(
        `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2`,
        [template.created_by, session.user.discordId]
      )

      if (ownerCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden - you don't own this template" },
          { status: 403 }
        )
      }
    } else {
      // System template - can't be modified
      return NextResponse.json(
        { error: "Cannot modify system templates" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, category, icon, structure, is_public } = body

    // Update template
    await query(
      `UPDATE rule_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           icon = COALESCE($4, icon),
           structure = COALESCE($5, structure),
           is_public = COALESCE($6, is_public),
           updated_at = NOW()
       WHERE id = $7`,
      [
        name,
        description,
        category,
        icon,
        structure ? JSON.stringify(structure) : null,
        is_public,
        templateId,
      ]
    )

    // Get updated template
    const updated = await query(
      `SELECT * FROM rule_templates WHERE id = $1`,
      [templateId]
    )

    return NextResponse.json({
      success: true,
      template: updated.rows[0],
    })
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/templates/[templateId]
// Delete a template (only if owned by user)
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templateId = parseInt(params.templateId)

    // Get template
    const templateResult = await query(
      `SELECT * FROM rule_templates WHERE id = $1`,
      [templateId]
    )

    if (templateResult.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const template = templateResult.rows[0]

    // Check ownership
    if (template.created_by) {
      const ownerCheck = await query(
        `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2`,
        [template.created_by, session.user.discordId]
      )

      if (ownerCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden - you don't own this template" },
          { status: 403 }
        )
      }
    } else {
      // System template - can't be deleted
      return NextResponse.json(
        { error: "Cannot delete system templates" },
        { status: 403 }
      )
    }

    // Delete template
    await query(`DELETE FROM rule_templates WHERE id = $1`, [templateId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}
