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

        // Normalize API endpoint: many proxies work better with /v1/ instead of /v1beta/
        const normalizedBaseUrl = baseUrl.replace(/\/v1beta$/, "/v1");
        const apiUrl = `${normalizedBaseUrl}/models/${modelName}:generateContent`;

        const isSkKey = GEMINI_API_KEY.startsWith('sk-');

        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
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

        console.log('Requesting Gemini via Proxy:', {
            url: apiUrl,
            model: modelName,
            authMode: isSkKey ? 'Bearer' : 'KeyParam',
            payloadSize: JSON.stringify(payload).length
        });

        const fetchUrl = isSkKey ? apiUrl : `${apiUrl}?key=${GEMINI_API_KEY}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (isSkKey) {
            headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const data: any = await response.json();

        // Check for error both in status and in payload (some proxies return 200 with error body)
        if (!response.ok || data.error) {
            console.error('Gemini API Error Detail:', {
                status: response.status,
                error: data.error || data
            });
            const errorMsg = data.error?.message || data.message || `API Error (Status ${response.status})`;
            throw new Error(errorMsg);
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
