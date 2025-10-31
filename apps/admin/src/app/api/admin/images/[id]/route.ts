import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const sql = `
      WITH like_counts AS (
        SELECT image_id, COUNT(*)::bigint AS likes_count
        FROM likes
        GROUP BY image_id
      )
      SELECT 
        i.id,
        i.user_id,
        u.email AS user_email,
        i.prompt,
        i.image_url,
        i.watermarked_url,
        i.estimated_cost,
        i.created_at,
        i.is_private,
        COALESCE(lc.likes_count, 0)::bigint AS likes_count
      FROM images i
      LEFT JOIN users u ON u.id = i.user_id
      LEFT JOIN like_counts lc ON lc.image_id = i.id
      WHERE i.id = $1
      LIMIT 1
    `;

    const res = await query(sql, [id]);
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(res.rows[0]);
  } catch (e) {
    console.error("Admin image details error:", e);
    return NextResponse.json({ error: "Failed to load image details" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.is_private !== 'boolean') {
      return NextResponse.json({ error: "Missing or invalid 'is_private' boolean" }, { status: 400 });
    }

    const sql = `UPDATE images SET is_private = $1 WHERE id = $2 RETURNING id, is_private`;
    const res = await query(sql, [body.is_private, id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(res.rows[0]);
  } catch (e) {
    console.error('Admin image update error:', e);
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 });
  }
}

