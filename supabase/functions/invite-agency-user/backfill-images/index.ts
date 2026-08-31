
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ONE-TIME MIGRATION: re-mirrors every image_cache row that still points
// at a hotlinked Pixabay URL into our own Storage bucket, since Pixabay
// URLs are not permitted for permanent hotlinking and expire/break.
// Call this once (POST, empty body), then delete this function.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIXABAY_API_KEY = Deno.env.get("PIXABAY_API_KEY");
const BUCKET = "destination-images";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

async function mirrorToStorage(sourceUrl: string, keyword: string): Promise<string | null> {
  try {
    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const safeKeyword = keyword.replace(/[^a-z0-9-]/gi, "-");
    const filename = `${safeKeyword}/${crypto.randomUUID()}.${ext}`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!uploadRes.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
  } catch {
    return null;
  }
}

async function fetchFreshPixabayUrls(keyword: string, count: number): Promise<string[]> {
  if (!PIXABAY_API_KEY) return [];
  const res = await fetch(
    `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&lang=en&image_type=photo&per_page=${Math.max(count, 3) * 2}&safesearch=true`
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
  return hits.map((h) => h.largeImageURL ?? h.webformatURL).filter((u): u is string => !!u);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    // pull every row still pointing at a raw pixabay.com URL
    const rowsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/image_cache?image_url=like.*pixabay.com*&select=id,keyword,image_url&order=keyword`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const rows: { id: string; keyword: string; image_url: string }[] = await rowsRes.json();

    let fixed = 0;
    let deleted = 0;
    let failed = 0;
    const keywordFreshPool: Record<string, string[]> = {};

    for (const row of rows) {
      // try the stored url first (some may still be alive)
      let mirroredUrl = await mirrorToStorage(row.image_url, row.keyword);

      // dead -> pull a fresh replacement from Pixabay for this keyword
      if (!mirroredUrl) {
        if (!keywordFreshPool[row.keyword]) {
          keywordFreshPool[row.keyword] = await fetchFreshPixabayUrls(row.keyword, 6);
        }
        const pool = keywordFreshPool[row.keyword];
        while (pool.length > 0 && !mirroredUrl) {
          const candidate = pool.shift()!;
          mirroredUrl = await mirrorToStorage(candidate, row.keyword);
        }
      }

      if (mirroredUrl) {
        const upd = await fetch(`${SUPABASE_URL}/rest/v1/image_cache?id=eq.${row.id}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ image_url: mirroredUrl, source: "pixabay_mirrored" }),
        });
        if (upd.ok) fixed++;
        else failed++;
      } else {
        // no replacement found anywhere -> drop the dead row rather than
        // leave a permanently broken image behind
        const del = await fetch(`${SUPABASE_URL}/rest/v1/image_cache?id=eq.${row.id}`, {
          method: "DELETE",
          headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        });
        if (del.ok) deleted++;
        else failed++;
      }
    }

    return new Response(
      JSON.stringify({ total: rows.length, fixed, deleted, failed }),
      { headers: corsHeaders() }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders() });
  }
});
