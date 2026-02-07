/// <reference types="@cloudflare/workers-types" />
interface Env {
    GEMINI_API_KEY: string;
    GEMINI_PROMPT: string;
    GEMINI_BASE_URL?: string;
    GEMINI_MODEL_NAME?: string;
    STATS_KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { GEMINI_API_KEY, GEMINI_PROMPT, GEMINI_BASE_URL, GEMINI_MODEL_NAME } = context.env;

    if (!GEMINI_API_KEY || !GEMINI_BASE_URL || !GEMINI_MODEL_NAME) {
        return new Response(JSON.stringify({ error: 'System configuration error: Missing API Key, Base URL or Model Name.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const blob = await context.request.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Efficient Base64 conversion using chunked processing
        // This avoids string concatenation O(n^2) issues and large memory allocations
        let base64Audio = '';
        const CHUNK_SIZE = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.subarray(i, i + CHUNK_SIZE);
            base64Audio += btoa(String.fromCharCode.apply(null, chunk as unknown as number[]));
        }

        const systemPrompt = GEMINI_PROMPT ||
            "你是一个视频内容分析专家。请分析这段视频音频内容，提供一个简洁扼要的总结（包含核心内容、关键点），并推荐3-5个吸引人的视频标题。请用中文回答。";

        const modelName = GEMINI_MODEL_NAME;
        // Remove trailing slash if present for robustness
        const baseUrl = GEMINI_BASE_URL.replace(/\/$/, "");

        const apiUrl = `${baseUrl}/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        const payload = {
            contents: [{
                parts: [
                    { text: `${systemPrompt}\n\n[音频数据已附加至此请求，Base64 长度: ${base64Audio.length}]` },
                    {
                        inlineData: {
                            mimeType: "audio/mpeg",
                            data: base64Audio
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        };

        console.log('Sending request to Gemini Proxy:', {
            url: apiUrl.replace(GEMINI_API_KEY, 'REDACTED'),
            model: modelName,
            payloadSize: JSON.stringify(payload).length
        });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
            },
            body: JSON.stringify(payload)
        });

        const data: any = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error Detail:', {
                status: response.status,
                url: apiUrl.replace(GEMINI_API_KEY, 'REDACTED'),
                error: data
            });
            throw new Error(data.error?.message || `Gemini API Error (Status ${response.status})`);
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "分析失败，请稍后重试。";

        // Update usage count
        try {
            const count = await context.env.STATS_KV.get('usage_count') || '0';
            await context.env.STATS_KV.put('usage_count', (parseInt(count) + 1).toString());
        } catch (e) {
            console.error('Failed to update stats', e);
        }

        return new Response(JSON.stringify({ result: aiText }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
