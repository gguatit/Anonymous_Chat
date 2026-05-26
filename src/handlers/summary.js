import { AI_SUMMARY } from '../config/constants.js';
import { forwardToDO } from '../utils/do.js';

const SYSTEM_PROMPT = `당신은 채팅 요약 도우미입니다. 아래 채팅 메시지들을 읽고 3~5문장으로 자연스럽게 요약해주세요.
규칙:
- 대화의 주요 주제와 흐름을 파악하세요.
- 개인정보(이름, 전화번호, 이메일 등)가 있어도 절대 포함하지 마세요.
- 친근하고 자연스러운 한국어 말투로 작성하세요.
- 욕설이나 부적절한 내용은 "부적절한 대화"로만 간략히 언급하고 구체적인 내용은 생략하세요.
- 메시지가 너무 적으면 "아직 대화가 충분하지 않아요."라고 답변하세요.`;

function buildPrompt(messages) {
    const lines = messages.map((msg, i) =>
        `[${i + 1}] ${msg.nickname}: ${msg.content}`
    );
    return lines.join('\n');
}

async function callAI(env, messages) {
    const prompt = buildPrompt(messages);

    try {
        const result = await env.AI.run(AI_SUMMARY.MODEL_PRIMARY, {
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.7
        });

        return result.response || result;
    } catch (primaryErr) {
        console.warn('Primary AI model failed, trying fallback:', primaryErr.message);

        try {
            const result = await env.AI.run(AI_SUMMARY.MODEL_FALLBACK, {
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.7
            });

            return result.response || result;
        } catch (fallbackErr) {
            console.error('Fallback AI model also failed:', fallbackErr.message);
            throw fallbackErr;
        }
    }
}

export async function handleSummary(request, env, corsHeaders) {
    try {
        const doResp = await forwardToDO(env, '/messages/recent', { method: 'GET' });

        if (!doResp.ok) {
            return new Response(JSON.stringify({ error: '메시지를 가져올 수 없습니다.' }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const messages = await doResp.json();

        if (!messages || messages.length < 3) {
            return new Response(JSON.stringify({ summary: '아직 대화가 충분하지 않아요. 조금 더 채팅한 후에 요약을 요청해주세요.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const summary = await callAI(env, messages);

        return new Response(JSON.stringify({ summary }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Summary handler error:', err);
        return new Response(JSON.stringify({ error: '요약 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
