import { AI_SUMMARY } from '../config/constants.js';
import { forwardToDO } from '../utils/do.js';

const SYSTEM_PROMPT = `당신은 채팅 요약 도우미입니다. 아래 채팅 메시지들을 읽고 3~5문장으로 자연스럽게 요약해주세요.

절대 규칙:
1. 오직 한국어로만 답변하세요. 어떤 다른 언어도 사용하지 마세요.
2. 요약 텍스트 외에 설명, 인사말, 접두사나 접미사 없이 순수한 요약만 출력하세요. ("요약:", "대화 내용:" 같은 머리말 금지)
3. 당신이 AI임을 언급하지 마세요.
4. 대화에 없는 내용을 창작하지 마세요.
5. 개인정보(이름, 전화번호, 이메일 등)는 절대 포함하지 마세요.
6. 욕설이나 부적절한 내용은 "부적절한 대화"로만 간략히 언급하고 구체적 내용은 생략하세요.
7. 말투는 한국 인터넷 채팅 말투(반말, 구어체)로 자연스럽게 작성하세요.
8. 대화가 충분히 있다면 "아직 대화가 충분하지 않아요"라고 말하지 마세요.`;

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

async function broadcastSummary(env, content) {
    const resp = await forwardToDO(env, '/broadcast-summary', {
        method: 'POST',
        json: { content }
    });
    return resp.ok;
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

        let summary;
        if (!messages || messages.length === 0) {
            summary = '아직 대화가 충분하지 않아요. 조금 더 채팅한 후에 요약을 요청해주세요.';
        } else {
            summary = await callAI(env, messages);
        }

        const ok = await broadcastSummary(env, summary);
        if (!ok) {
            throw new Error('Failed to broadcast summary');
        }

        return new Response(null, { status: 204, headers: corsHeaders });
    } catch (err) {
        console.error('Summary handler error:', err);
        return new Response(JSON.stringify({ error: '요약 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
