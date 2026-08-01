// Deploy with: supabase functions deploy fetch-news --no-verify-jwt
// Proxies an Indian stock-market news RSS feed server-side so the browser
// never hits Google's CORS-blocked RSS endpoint directly.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  if (!match) return ''
  return match[1].replace('<![CDATA[', '').replace(']]>', '').trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rssUrl =
      'https://news.google.com/rss/search?q=NSE%20OR%20BSE%20OR%20%22stock%20market%22%20India%20when:2d&hl=en-IN&gl=IN&ceid=IN:en'
    const res = await fetch(rssUrl)
    const xml = await res.text()

    const items: Array<{ title: string; link: string; pubDate: string; source: string }> = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null
    while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
      const block = match[1]
      items.push({
        title: extractTag(block, 'title'),
        link: extractTag(block, 'link'),
        pubDate: extractTag(block, 'pubDate'),
        source: extractTag(block, 'source'),
      })
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
