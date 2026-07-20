const CHANNEL_ID = 'UCncQOR50FgXzGUPMVkcGQlg';

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    ...extra,
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(extraHeaders),
  });
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse(
        { success: false, error: 'Método não permitido.' },
        405,
        { Allow: 'GET, OPTIONS' }
      );
    }

    try {
      const feedUrl =
        `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

      const youtubeResponse = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PortalLuizVitorino/1.0)',
          Accept: 'application/atom+xml, application/xml, text/xml',
        },
      });

      if (!youtubeResponse.ok) {
        throw new Error(
          `O YouTube respondeu com status ${youtubeResponse.status}.`
        );
      }

      const xml = await youtubeResponse.text();
      const firstEntryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);

      if (!firstEntryMatch) {
        throw new Error('Nenhum vídeo foi localizado no feed.');
      }

      const entryXml = firstEntryMatch[1];
      const videoIdMatch = entryXml.match(
        /<yt:videoId>([^<]+)<\/yt:videoId>/
      );
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const publishedMatch = entryXml.match(
        /<published>([^<]+)<\/published>/
      );
      const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);

      if (!videoIdMatch?.[1]) {
        throw new Error('O ID do vídeo mais recente não foi localizado.');
      }

      const videoId = videoIdMatch[1].trim();
      const title = decodeXml(titleMatch?.[1]?.trim() || '');

      return jsonResponse(
        {
          success: true,
          channelId: CHANNEL_ID,
          videoId,
          title,
          publishedAt: publishedMatch?.[1]?.trim() || null,
          updatedAt: updatedMatch?.[1]?.trim() || null,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        },
        200,
        {
          'Cache-Control':
            'public, s-maxage=600, stale-while-revalidate=3600',
        }
      );
    } catch (error) {
      console.error('Erro ao consultar o feed do YouTube:', error);

      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Não foi possível consultar o YouTube.',
        },
        500,
        { 'Cache-Control': 'no-store' }
      );
    }
  },
};
