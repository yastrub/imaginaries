import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { ALL_PERMISSION_KEYS } from "@/config/permissions";

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = params;
    const res = await query(
      `SELECT r.id, r.name, r.description, r.permissions, r.created_at
       FROM roles r WHERE r.id = $1`,
      [id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error("Admin get role error:", e);
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = params;
    const body = await req.json();
    const { name, description, permissions } = (body || {}) as {
      name?: string;
      description?: string | null;
      permissions?: string[];
    };

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof name === "string") { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (typeof description === "string" || description === null) { updates.push(`description = $${idx++}`); values.push(description ?? null); }
    if (typeof permissions !== "undefined") {
      const perms = validatePermissions(permissions);
      if (perms === null) return NextResponse.json({ error: "Invalid permissions" }, { status: 400 });
      updates.push(`permissions = $${idx++}`); values.push(perms);
    }

    if (updates.length) {
      values.push(id);
      try {
        await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      } catch (e: any) {
        if (e?.code === "23505") {
          return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
        }
        if (e?.code === "23514") {
          return NextResponse.json({ error: "One or more permissions are not allowed" }, { status: 400 });
        }
        throw e;
      }
    }

    const after = await query(
      `SELECT r.id, r.name, r.description, r.permissions, r.created_at FROM roles r WHERE r.id = $1`,
      [id]
    );
    if (!after.rows.length) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(after.rows[0]);
  } catch (e: any) {
    console.error("Admin update role error:", e);
    const status = e?.status || 500;
    return NextResponse.json({ error: status === 400 ? (e?.message || "Bad Request") : "Failed to update role" }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const idNum = parseInt(params.id, 10);
    if (idNum === 1 || idNum === 2) {
      return NextResponse.json({ error: "Cannot delete system roles (id=1,2)" }, { status: 400 });
    }

    const result = await withTransaction(async (tx) => {
      const usage = await tx(`SELECT COUNT(*)::int AS cnt FROM users WHERE role_id = $1`, [idNum]);
      const cnt = (usage.rows[0] as any)?.cnt ?? 0;
      if (cnt > 0) {
        throw Object.assign(new Error("Role is in use by users"), { status: 409 });
      }
      const del = await tx(`DELETE FROM roles WHERE id = $1 RETURNING id`, [idNum]);
      return del.rows[0];
    });

    if (!result) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json({ id: result.id });
  } catch (e: any) {
    console.error("Admin delete role error:", e);
    const status = e?.status || 500;
    const msg = status === 409 ? "Role is in use by users" : (status === 400 ? e?.message || "Bad Request" : "Failed to delete role");
    return NextResponse.json({ error: msg }, { status });
  }
}
