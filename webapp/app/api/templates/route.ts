import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/templates
// List all rule templates (public + user's private templates)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let whereClause = "is_public = TRUE"
    const queryParams: any[] = []

    // Include user's private templates if logged in
    if (session?.user?.discordId) {
      whereClause += ` OR created_by IN (SELECT id FROM guilds WHERE owner_discord_id = $${queryParams.length + 1})`
      queryParams.push(session.user.discordId)
    }

    // Filter by category
    if (category) {
      whereClause = `(${whereClause}) AND category = $${queryParams.length + 1}`
      queryParams.push(category)
    }

    const templatesResult = await query(
      `SELECT
         id,
         name,
         description,
         category,
         icon,
         structure,
         usage_count,
         is_public,
         created_by,
         created_at,
         updated_at
       FROM rule_templates
       WHERE ${whereClause}
       ORDER BY usage_count DESC, created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM rule_templates WHERE ${whereClause}`,
      queryParams
    )

    const total = parseInt(countResult.rows[0]?.total || "0")

    // Get categories with counts
    const categoriesResult = await query(
      `SELECT category, COUNT(*) as count
       FROM rule_templates
       WHERE ${whereClause}
       GROUP BY category
       ORDER BY count DESC`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      templates: templatesResult.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      categories: categoriesResult.rows,
    })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/templates
// Create a new template (user-created)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, icon, structure, is_public, guild_id } = body

    // Validate required fields
    if (!name || !structure) {
      return NextResponse.json(
        { error: "name and structure are required" },
        { status: 400 }
      )
    }

    // Validate structure is valid JSON
    try {
      JSON.parse(JSON.stringify(structure))
    } catch {
      return NextResponse.json(
        { error: "Invalid structure format" },
        { status: 400 }
      )
    }

    // Create template
    const result = await query(
      `INSERT INTO rule_templates (name, description, category, icon, structure, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        description || null,
        category || "custom",
        icon || "⭐",
        JSON.stringify(structure),
        is_public || false,
        guild_id || null,
      ]
    )

    return NextResponse.json({
      success: true,
      template: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}
