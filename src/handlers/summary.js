import { AI_SUMMARY } from '../config/constants.js';
import { forwardToDO } from '../utils/do.js';
import { safeJson } from '../utils/helpers.js';

const BASE_RULES = `절대 규칙:
0. 당신의 유일한 역할은 대화 요약입니다. 절대로 채팅에 참여하거나,
   개별 메시지에 답장하거나, 질문에 답변하지 마세요. 오직 요약문만 출력하세요.
1. 오직 한국어로만 답변하세요. 어떤 다른 언어도 사용하지 마세요.
2. 요약 텍스트 외에 설명, 인사말, 접두사나 접미사 없이 순수한 요약만 출력하세요.
   ("요약:", "주제:", "분위기:" 같은 머리말이나 "입니다", "이상입니다" 같은 맺음말 금지)
3. 당신이 AI임을 언급하지 마세요.
4. 대화에 없는 내용을 창작하지 마세요.
5. 개인정보(이름, 전화번호, 이메일, 주소 등)는 절대 포함하지 마세요.
6. [코드]라고 표시된 메시지는 대화 맥락상 코드를 주고받았다는 정도로만 언급하고, 코드의 기능이나 내용을 절대 설명하지 마세요.
7. 각 메시지의 닉네임을 정확히 구분하세요. 누가 어떤 말을 했는지 혼동하지 말고, 닉네임을 바꿔서 언급하지 마세요.
8. 말투는 한국 인터넷 채팅 말투(반말, 구어체)로 자연스럽게 작성하세요.`;

const PROMPTS = {
    default: `당신은 채팅 대화 요약 도우미입니다. 아래 채팅 메시지들을 읽고 대화 내용을 요약해주세요.

${BASE_RULES}

9. 대화가 적더라도 "아직 대화가 충분하지 않아요" 같은 말은 하지 말고, 주어진 내용으로 최대한 요약하세요.
10. 대화의 흐름을 자연스럽게 정리하고, 무슨 이야기를 했는지 구체적으로 써주세요.
    예를 들면: "00에 대해 이야기하다가 00로 화제가 바뀌었고, 00이 00를 추천했어" 같은 식으로.
11. 농담, 논쟁, 정보 공유 등 대화의 성격과 분위기가 드러나도록 생생하게 작성하세요.
12. 4~6문장으로 충분히 자세하게 요약하세요. 너무 짧게 끝내지 마세요.`,

    topic: `당신은 채팅 대화 주제 분석 도우미입니다. 아래 채팅 메시지들을 읽고 어떤 주제들이 오갔는지 정리해주세요.

${BASE_RULES}

9. 무슨 이야기를 했는지 3~5문장의 자연스러운 문단으로 설명하세요. 절대로 글머리 기호나 "주제:" 같은 형식을 사용하지 마세요.
10. 각 대화 주제를 구체적으로 언급하고, 누가 어떤 의견을 냈는지 흐름을 따라가며 서술하세요.
    "00에 대한 이야기로 시작해서 00이 00를 추천했고, 이후에는 00에 대한 농담이 오갔어" 같은 식으로.
11. "주제 없음", "없음" 같은 모호한 표현은 절대 사용하지 마세요. 대화가 적더라도 있는 내용을 구체적으로 쓰세요.`,

    mood: `당신은 채팅 대화 분위기 분석 도우미입니다. 아래 채팅 메시지들의 전체적인 분위기와 감정 톤을 분석해주세요.

${BASE_RULES}

9. 분위기를 한 문장으로 요약하세요. (20자 내외)
10. 분위기의 세부 요소를 아래 각각 한 문장씩, 총 4문장으로 설명하세요:
   - 전체적인 톤 (가벼움/진지함/딱딱함 등)
   - 감정적 색채 (긍정적/부정적/중립적/복합적)
   - 소통 방식 (서로 공감하는지, 농담을 주고받는지, 정보만 주고받는지 등)
   - 특이사항 (눈에 띄는 감정 변화, 특정 주제에서의 반응 등)
    예시: "서로 공감하며 편안하게 대화를 이어가고 있어", "가벼운 농담이 오가는 유쾌한 분위기야"
11. 분위기를 가장 잘 나타내는 짧은 인용구 하나를 골라 " "로 감싸서 제시하세요. (최대 30자)
12. 절대로 숫자나 점수로 표현하지 마세요. 문장으로만 표현하세요.`,


    conflict: `당신은 채팅 대화 논쟁 분석 도우미입니다. 아래 채팅 메시지들에서 의견 충돌이나 논쟁 지점을 찾아 정리해주세요.

${BASE_RULES}

9. 논쟁이나 의견 충돌이 발견되면 자연스러운 문단으로 서술하세요. 절대로 "주제:" 같은 글머리 형식을 사용하지 마세요.
10. 각 논쟁에서 누가 어떤 입장을 취했는지 구체적으로 설명하고, 양측 주장을 균형 있게 다루세요.
    예: "윤석열 지지자와 문재인 지지자 간에 경제 정책을 두고 의견이 갈렸어. 한쪽은 감세를, 다른 쪽은 복지 확대를 주장했지."
11. 절대로 편을 들거나 누가 옳고 그름을 판단하지 마세요. 완전히 중립적으로 기술하세요.
12. 논쟁이 발견되지 않으면 "이 대화에서는 특별한 의견 충돌이나 논쟁이 발견되지 않았어"라고 출력하세요.
13. "없음" 한 글자만 출력하지 마세요. 반드시 위 12번 문장을 그대로 사용하세요.`,

};

function buildPrompt(messages) {
    const lines = messages.map((msg, i) =>
        `[${i + 1}] ${msg.nickname}: ${msg.content}`
    );
    return lines.join('\n');
}

async function callAI(env, messages, mode) {
    const prompt = buildPrompt(messages);
    const systemPrompt = PROMPTS[mode] || PROMPTS.default;

    try {
        const result = await env.AI.run(AI_SUMMARY.MODEL_PRIMARY, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 600,
            temperature: 0.4
        });

        return result.response || result;
    } catch (primaryErr) {
        console.warn('Primary AI model failed, trying fallback:', primaryErr.message);

        try {
            const result = await env.AI.run(AI_SUMMARY.MODEL_FALLBACK, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 600,
                temperature: 0.4
            });

            return result.response || result;
        } catch (fallbackErr) {
            console.error('Fallback AI model also failed:', fallbackErr.message);
            throw fallbackErr;
        }
    }
}

async function broadcastSummary(env, content, mode) {
    try {
        const resp = await forwardToDO(env, '/broadcast-summary', {
            method: 'POST',
            json: { content, mode }
        });
        return resp.ok;
    } catch (err) {
        console.error('Summary: broadcastSummary DO call failed:', err.message);
        return false;
    }
}

export async function handleSummary(request, env, corsHeaders) {
    let mode = 'default';
    try {
        const body = await safeJson(request);
        if (body && ['default', 'topic', 'mood', 'conflict'].includes(body.mode)) {
            mode = body.mode;
        }
    } catch (_e) { /* expected: invalid JSON body, fall back to default mode */ }

    let doResp;
    try {
        doResp = await forwardToDO(env, '/messages/recent', { method: 'GET' });
    } catch (err) {
        console.error('Summary: Failed to fetch messages from DO:', err.message);
        return new Response(JSON.stringify({ error: '메시지를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!doResp.ok) {
        return new Response(JSON.stringify({ error: '대화 데이터를 불러올 수 없습니다.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let messages;
    try {
        messages = await doResp.json();
    } catch (err) {
        console.error('Summary: Failed to parse messages JSON:', err.message);
        return new Response(JSON.stringify({ error: '대화 데이터 처리 중 오류가 발생했습니다.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let summary;
    if (!messages || messages.length === 0) {
        summary = '아직 대화가 충분하지 않아요. 조금 더 채팅한 후에 요약을 요청해주세요.';
        mode = 'default';
    } else {
        try {
            summary = await callAI(env, messages, mode);
        } catch (err) {
            console.error('Summary: AI model call failed:', err.message);
            return new Response(JSON.stringify({ error: 'AI 요약 모델이 현재 사용 불가능합니다. 잠시 후 다시 시도해주세요.' }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    try {
        await broadcastSummary(env, summary, mode);
    } catch (err) {
        console.error('Summary: Broadcast failed:', err.message);
    }

    return new Response(null, { status: 204, headers: corsHeaders });
}
