import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import fs from "fs"
import path from "path"

// ============================================================
// POST /api/admin/migrate
// Run database migrations (admin only)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Security: Only allow if user is admin
    // TODO: Add proper admin check
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { migration_number } = body

    if (!migration_number) {
      return NextResponse.json(
        { error: "migration_number required" },
        { status: 400 }
      )
    }

    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      "migrations",
      `${migration_number}_add_reputation_worker_validator_systems.sql`
    )

    if (!fs.existsSync(migrationPath)) {
      return NextResponse.json(
        { error: `Migration file not found: ${migration_number}` },
        { status: 404 }
      )
    }

    const migrationSQL = fs.readFileSync(migrationPath, "utf-8")

    // Execute migration
    await query(migrationSQL)

    console.log(`Migration ${migration_number} executed successfully`)

    return NextResponse.json({
      success: true,
      message: `Migration ${migration_number} executed successfully`,
      migration: migration_number,
    })
  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json(
      {
        error: "Migration failed",
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// GET /api/admin/migrate - List available migrations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const migrationsDir = path.join(process.cwd(), "migrations")

    if (!fs.existsSync(migrationsDir)) {
      return NextResponse.json({ migrations: [] })
    }

    const files = fs.readdirSync(migrationsDir)
    const migrations = files
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({
        file: f,
        number: f.split("_")[0],
        name: f.replace(/^\d+_/, "").replace(".sql", ""),
      }))

    return NextResponse.json({
      success: true,
      migrations,
    })
  } catch (error: any) {
    console.error("Error listing migrations:", error)
    return NextResponse.json(
      { error: "Failed to list migrations" },
      { status: 500 }
    )
  }
}
