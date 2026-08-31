
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIXABAY_API_KEY = Deno.env.get("PIXABAY_API_KEY");

const MIN_IMAGES_PER_KEYWORD = 6;
const BUCKET = "destination-images";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

// Downloads an image from a remote URL and uploads it into our own
// Storage bucket, returning our own permanent public URL.
// Pixabay's API terms explicitly disallow hotlinking their URLs beyond
// transient display of search results, and the URLs do expire/break —
// so we must own a copy of every image we keep.
async function mirrorToStorage(sourceUrl: string, keyword: string): Promise<string | null> {
  try {
    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const safeKeyword = keyword.replace(/[^a-z0-9-]/gi, "-");
    const filename = `${safeKeyword}/${crypto.randomUUID()}.${ext}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`,
      {
        method: "POST",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: bytes,
      }
    );
    if (!uploadRes.ok) return null;

    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const url = new URL(req.url);
    let keyword = url.searchParams.get("keyword");

    if (!keyword && (req.method === "POST" || req.method === "PUT" || req.method === "PATCH")) {
      const body = await req.json().catch(() => ({}));
      keyword = body.keyword;
    }

    if (!keyword || keyword.trim().length === 0) {
      return new Response(JSON.stringify({ error: "keyword is required" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    keyword = keyword.trim().toLowerCase();

    // 1) check how many images we already have cached for this keyword
    const cacheRes = await fetch(
      `${SUPABASE_URL}/rest/v1/image_cache?keyword=eq.${encodeURIComponent(keyword)}&select=image_url`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const cacheRows = await cacheRes.json();
    const existingUrls: string[] = Array.isArray(cacheRows) ? cacheRows.map((r: any) => r.image_url) : [];

    if (existingUrls.length >= MIN_IMAGES_PER_KEYWORD) {
      const pick = existingUrls[Math.floor(Math.random() * existingUrls.length)];
      return new Response(
        JSON.stringify({ image_url: pick, cached: true, count: existingUrls.length }),
        { headers: corsHeaders() }
      );
    }

    // 2) need more images -> fetch a batch from Pixabay (English search, explicit lang=en)
    if (!PIXABAY_API_KEY) {
      if (existingUrls.length > 0) {
        return new Response(
          JSON.stringify({ image_url: existingUrls[0], cached: true, count: existingUrls.length }),
          { headers: corsHeaders() }
        );
      }
      return new Response(
        JSON.stringify({ error: "PIXABAY_API_KEY secret is not configured" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const pixabayRes = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&lang=en&image_type=photo&per_page=${MIN_IMAGES_PER_KEYWORD * 2}&safesearch=true`
    );

    if (!pixabayRes.ok) {
      const errText = await pixabayRes.text().catch(() => "");
      if (existingUrls.length > 0) {
        return new Response(
          JSON.stringify({ image_url: existingUrls[0], cached: true, count: existingUrls.length }),
          { headers: corsHeaders() }
        );
      }
      return new Response(
        JSON.stringify({ error: "Pixabay API request failed", status: pixabayRes.status, detail: errText }),
        { status: 502, headers: corsHeaders() }
      );
    }

    const pixabayData = await pixabayRes.json();
    const hits: any[] = Array.isArray(pixabayData?.hits) ? pixabayData.hits : [];

    const candidateUrls = hits
      .map((h) => h.largeImageURL ?? h.webformatURL)
      .filter((u): u is string => !!u);

    const needed = Math.max(0, MIN_IMAGES_PER_KEYWORD - existingUrls.length);

    // Mirror each candidate into our own Storage bucket instead of
    // storing the Pixabay URL directly (hotlinking is not permitted and
    // the URLs expire).
    const mirrored: string[] = [];
    for (const candidate of candidateUrls) {
      if (mirrored.length >= needed) break;
      const storedUrl = await mirrorToStorage(candidate, keyword);
      if (storedUrl) mirrored.push(storedUrl);
    }

    let cacheWriteError: string | null = null;
    if (mirrored.length > 0) {
      try {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/image_cache`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(
            mirrored.map((image_url) => ({ keyword, image_url, source: "pixabay_mirrored" }))
          ),
        });
        if (!insertRes.ok) {
          cacheWriteError = await insertRes.text().catch(() => `status ${insertRes.status}`);
        }
      } catch (e) {
        cacheWriteError = String(e);
      }
    }

    const allUrls = [...existingUrls, ...mirrored];
    const resultUrl =
      allUrls.length > 0
        ? allUrls[Math.floor(Math.random() * allUrls.length)]
        : null;

    if (!resultUrl) {
      return new Response(
        JSON.stringify({ image_url: null, message: "no image found" }),
        { headers: corsHeaders() }
      );
    }

    return new Response(
      JSON.stringify({
        image_url: resultUrl,
        cached: false,
        count: allUrls.length,
        ...(cacheWriteError ? { cache_write_error: cacheWriteError } : {}),
      }),
      { headers: corsHeaders() }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});
