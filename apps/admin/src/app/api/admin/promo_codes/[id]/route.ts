import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { authorized } = await requireAdmin(_req);
    if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const res = await query("SELECT id, plan, is_valid, description, discount::float AS discount, created_at FROM promo_codes WHERE id = $1", [params.id]);
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e) {
    console.error("Admin promo_codes get error:", e);
    return NextResponse.json({ error: "Failed to get promo code" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { authorized } = await requireAdmin(req);
    if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { plan, is_valid, description, discount } = (body || {}) as { plan?: string; is_valid?: boolean; description?: string | null; discount?: number };

    const result = await withTransaction(async (tx) => {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (typeof plan === "string") { fields.push(`plan = $${idx++}`); values.push(plan); }
      if (typeof is_valid === "boolean") { fields.push(`is_valid = $${idx++}`); values.push(is_valid); }
      if (typeof description !== "undefined") { fields.push(`description = $${idx++}`); values.push(description); }
      if (typeof discount !== "undefined") { fields.push(`discount = $${idx++}`); values.push(Math.max(0, Math.min(1, Number(discount)))); }
      if (!fields.length) {
        const res = await tx("SELECT id, plan, is_valid, description, discount::float AS discount, created_at FROM promo_codes WHERE id = $1", [params.id]);
        if (!res.rows.length) throw Object.assign(new Error("Not found"), { status: 404 });
        return res.rows[0];
      }
      values.push(params.id);
      await tx(`UPDATE promo_codes SET ${fields.join(", ")} WHERE id = $${idx}`, values);
      const out = await tx("SELECT id, plan, is_valid, description, discount::float AS discount, created_at FROM promo_codes WHERE id = $1", [params.id]);
      return out.rows[0];
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Admin promo_codes update error:", e);
    const status = e?.status || 500;
    return NextResponse.json({ error: status === 404 ? "Not found" : "Failed to update promo code" }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { authorized } = await requireAdmin(req);
    if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const res = await query("DELETE FROM promo_codes WHERE id = $1 RETURNING id", [params.id]);
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: params.id });
  } catch (e) {
    console.error("Admin promo_codes delete error:", e);
    return NextResponse.json({ error: "Failed to delete promo code" }, { status: 500 });
  }
}
