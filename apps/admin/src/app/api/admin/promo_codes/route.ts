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
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
    const offset = (page - 1) * limit;
    const q = (url.searchParams.get("q") || "").trim();
    const sortParam = (url.searchParams.get("sort") || "").trim();

    const [sortFieldRaw, sortOrderRaw] = sortParam.split(":");
    const sortOrder = (sortOrderRaw || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortFieldMap: Record<string, string> = {
      id: 'id',
      plan: 'plan',
      is_valid: 'is_valid',
      discount: 'discount',
      created_at: 'created_at',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 'created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = "";
    const params: any[] = [];
    if (q) {
      where = "WHERE id ILIKE $1 OR description ILIKE $1";
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT id, plan, is_valid, description, discount::float AS discount, created_at
      FROM promo_codes
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM promo_codes ${where}`;

    const [listRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: listRes.rows, total: (countRes.rows[0] as any)?.total ?? 0 });
  } catch (e) {
    console.error("Admin promo_codes list error:", e);
    return NextResponse.json({ error: "Failed to list promo codes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, plan, is_valid = true, description = null, discount = 0 } = body || {} as { id?: string; plan?: string; is_valid?: boolean; description?: string | null; discount?: number };
    if (!id || !plan) {
      return NextResponse.json({ error: "id and plan are required" }, { status: 400 });
    }

    const d = Math.max(0, Math.min(1, Number.isFinite(discount as number) ? Number(discount) : 0));
    const insertSql = `
      INSERT INTO promo_codes (id, plan, is_valid, description, discount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, plan, is_valid, description, discount::float AS discount, created_at
    `;
    const res = await query(insertSql, [id, plan, !!is_valid, description, d]);
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error("Admin promo_codes create error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create promo code" }, { status: 500 });
  }
}
