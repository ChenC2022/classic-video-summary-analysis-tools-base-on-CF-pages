/// <reference types="@cloudflare/workers-types" />

export const onRequest: PagesFunction<{ STATS_KV: KVNamespace }> = async (context) => {
    const { STATS_KV } = context.env;

    if (context.request.method === 'POST') {
        const count = await STATS_KV.get('usage_count') || '0';
        const newCount = parseInt(count) + 1;
        await STATS_KV.put('usage_count', newCount.toString());
        return new Response(JSON.stringify({ count: newCount }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const count = await STATS_KV.get('usage_count') || '0';
    return new Response(JSON.stringify({ count: parseInt(count) }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
