import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = false;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Metrics SQL
    const metricsNewUsers24hSql = `
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE created_at >= NOW() - interval '24 hours'
    `;
    const metricsTotalUsersSql = `
      SELECT COUNT(*)::int AS count
      FROM users
    `;
    const metricsActiveSubsSql = `
      SELECT COUNT(*)::int AS count
      FROM subscriptions s
      WHERE s.status IN ('active', 'trialing')
        AND (s.cancel_at IS NULL OR s.cancel_at > NOW())
    `;
    const metricsRevenue30dSql = `
      SELECT COALESCE(SUM(i.amount_total), 0)::bigint AS cents
      FROM invoices i
      WHERE i.created_at >= NOW() - interval '30 days'
        AND i.status IN ('paid', 'succeeded')
    `;
    const metricsTotalImagesSql = `
      SELECT COUNT(*)::int AS count
      FROM images
    `;

    const topLikedSql = `
      SELECT 
        i.id,
        i.prompt,
        i.image_url,
        i.watermarked_url,
        COALESCE(lc.likes_count, 0)::bigint AS likes_count
      FROM images i
      LEFT JOIN (
        SELECT image_id, COUNT(*)::bigint AS likes_count
        FROM likes
        GROUP BY image_id
      ) lc ON lc.image_id = i.id
      ORDER BY COALESCE(lc.likes_count, 0) DESC, i.created_at DESC
      LIMIT 8
    `;

    const newImagesSql = `
      SELECT 
        i.id,
        i.prompt,
        i.image_url,
        i.watermarked_url,
        i.created_at
      FROM images i
      ORDER BY i.created_at DESC
      LIMIT 12
    `;

    const popularTypesSql = `
      WITH keywords(label, keyword) AS (
        VALUES
          ('Ring','ring'),
          ('Necklace','necklace'),
          ('Earrings','earring'),
          ('Earrings','earrings'),
          ('Bracelet','bracelet'),
          ('Pendant','pendant'),
          ('Brooch','brooch'),
          ('Anklet','anklet'),
          ('Tiara','tiara'),
          ('Cuff','cuff'),
          ('Bangle','bangle')
      ), matches AS (
        SELECT k.label, i.id
        FROM keywords k
        JOIN images i ON i.prompt IS NOT NULL AND i.prompt ILIKE '%' || k.keyword || '%'
      )
      SELECT label, COUNT(DISTINCT id)::int AS count
      FROM matches
      GROUP BY label
      ORDER BY count DESC, label ASC
      LIMIT 10
    `;

    const imagesPerDaySql = `
      WITH bounds AS (
        SELECT COALESCE(MIN(created_at)::date, CURRENT_DATE) AS start_date, CURRENT_DATE AS end_date FROM images
      ), series AS (
        SELECT generate_series(start_date, end_date, interval '1 day')::date AS day FROM bounds
      ), counts AS (
        SELECT created_at::date AS day, COUNT(*)::int AS count
        FROM images
        GROUP BY created_at::date
      )
      SELECT to_char(s.day, 'YYYY-MM-DD') AS date, COALESCE(c.count, 0)::int AS count
      FROM series s
      LEFT JOIN counts c ON c.day = s.day
      ORDER BY s.day
    `;

    const [
      topLikedRes,
      newImagesRes,
      popularRes,
      imagesPerDayRes,
      newUsers24hRes,
      totalUsersRes,
      totalImagesRes,
      activeSubsRes,
      revenue30dRes,
    ] = await Promise.all([
      query(topLikedSql),
      query(newImagesSql),
      query(popularTypesSql),
      query(imagesPerDaySql),
      query(metricsNewUsers24hSql),
      query(metricsTotalUsersSql),
      query(metricsTotalImagesSql),
      query(metricsActiveSubsSql),
      query(metricsRevenue30dSql),
    ]);

    return NextResponse.json({
      topLikedImages: topLikedRes.rows,
      newImages: newImagesRes.rows,
      popularJewelryTypes: popularRes.rows,
      imagesPerDay: imagesPerDayRes.rows,
      metrics: {
        newUsers24h: (newUsers24hRes.rows[0] as any)?.count ?? 0,
        totalUsers: (totalUsersRes.rows[0] as any)?.count ?? 0,
        totalImages: (totalImagesRes.rows[0] as any)?.count ?? 0,
        activeSubscriptions: (activeSubsRes.rows[0] as any)?.count ?? 0,
        revenue30dCents: (revenue30dRes.rows[0] as any)?.cents ?? 0,
      },
    });
  } catch (e: any) {
    console.error("Admin dashboard data error:", e);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
