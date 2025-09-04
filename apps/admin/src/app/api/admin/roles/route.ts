import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ALL_PERMISSION_KEYS } from "@/config/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function validatePermissions(perms: any): string[] | null {
  if (!perms) return [];
  if (!Array.isArray(perms)) return null;
  const set = new Set<string>();
  for (const p of perms) {
    if (typeof p !== "string") return null;
    if (!ALL_PERMISSION_KEYS.includes(p as any)) return null;
    set.add(p);
  }
  return Array.from(set).sort();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
    const offset = (page - 1) * limit;
    const q = (url.searchParams.get("q") || "").trim();
    const sortParam = (url.searchParams.get("sort") || "").trim();

    const [sortFieldRaw, sortOrderRaw] = sortParam.split(":");
    const sortOrder = (sortOrderRaw || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
    const sortFieldMap: Record<string, string> = {
      name: "r.name",
      created_at: "r.created_at",
      id: "r.id",
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || "r.name";
    const orderBy = `${sortField} ${sortOrder}`;

    let where = "";
    const params: any[] = [];
    if (q) {
      where = "WHERE r.name ILIKE $1 OR r.description ILIKE $1";
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT r.id, r.name, r.description, r.permissions, r.created_at
      FROM roles r
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM roles r ${where}`;

    const [listRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({
      data: listRes.rows,
      total: (countRes.rows[0] as any)?.total ?? 0,
      page,
      pageSize: limit,
    });
  } catch (e: any) {
    console.error("Admin roles list error:", e);
    return NextResponse.json({ error: "Failed to list roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, description, permissions } = (body || {}) as {
      name?: string;
      description?: string | null;
      permissions?: string[];
    };

    const nameNorm = String(name || "").trim();
    if (!nameNorm) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const perms = validatePermissions(permissions);
    if (perms === null) return NextResponse.json({ error: "Invalid permissions" }, { status: 400 });

    // Insert role
    const insertSql = `
      INSERT INTO roles (name, description, permissions)
      VALUES ($1, $2, COALESCE($3, '{}'::text[]))
      RETURNING id, name, description, permissions, created_at
    `;

    try {
      const ins = await query(insertSql, [nameNorm, description ?? null, perms]);
      return NextResponse.json(ins.rows[0]);
    } catch (e: any) {
      if (e?.code === "23505") {
        return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
      }
      // Constraint error on permissions set
      if (e?.code === "23514") {
        return NextResponse.json({ error: "One or more permissions are not allowed" }, { status: 400 });
      }
      throw e;
    }
  } catch (e: any) {
    console.error("Admin create role error:", e);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
