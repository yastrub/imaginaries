import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const pageRaw = url.searchParams.get("page") || url.searchParams.get("current") || url.searchParams.get("currentPage") || "1";
    const limitRaw = url.searchParams.get("limit") || url.searchParams.get("pageSize") || "20";
    const page = parseInt(pageRaw, 10) || 1;
    const limit = Math.min(parseInt(limitRaw, 10) || 20, 100);
    const offset = (page - 1) * limit;
    const q = (url.searchParams.get("q") || "").trim();
    const sortParam = (url.searchParams.get("sort") || "").trim();

    // Determine ORDER BY with safe field mapping
    const [sortFieldRaw, sortOrderRaw] = sortParam.split(":");
    const sortOrder = (sortOrderRaw || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortFieldMap: Record<string, string> = {
      created_at: "i.created_at",
      prompt: "i.prompt",
      user_email: "u.email",
      is_private: "i.is_private",
      likes_count: "COALESCE(lc.likes_count, 0)",
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || "i.created_at";
    const orderBy = `${sortField} ${sortOrder}`;

    const params: any[] = [];
    let where = "";
    if (q) {
      where = "WHERE (i.prompt ILIKE $1 OR u.email ILIKE $1)";
      params.push(`%${q}%`);
    }

    const listSql = `
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
      LEFT JOIN (
        SELECT image_id, COUNT(*)::bigint AS likes_count
        FROM likes
        GROUP BY image_id
      ) lc ON lc.image_id = i.id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countSql = `SELECT COUNT(*)::int AS total FROM images i LEFT JOIN users u ON u.id = i.user_id ${where}`;

    const [listRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({
      data: listRes.rows,
      total: (countRes.rows[0] as any).total,
      page,
      pageSize: limit,
    });
  } catch (e: any) {
    console.error("Admin images list error:", e);
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 });
  }
}
