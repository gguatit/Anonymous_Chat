import { AI_SUMMARY } from '../config/constants.js';
import { forwardToDO } from '../utils/do.js';

const BASE_RULES = `절대 규칙:
0. 당신의 유일한 역할은 대화 요약입니다. 절대로 채팅에 참여하거나,
   개별 메시지에 답장하거나, 질문에 답변하지 마세요. 오직 요약문만 출력하세요.
1. 오직 한국어로만 답변하세요. 어떤 다른 언어도 사용하지 마세요.
2. 요약 텍스트 외에 설명, 인사말, 접두사나 접미사 없이 순수한 요약만 출력하세요.
   ("요약:", "주제:", "분위기:" 같은 머리말이나 "입니다", "이상입니다" 같은 맺음말 금지)
3. 당신이 AI임을 언급하지 마세요.
4. 대화에 없는 내용을 창작하지 마세요.
5. 개인정보(이름, 전화번호, 이메일, 주소 등)는 절대 포함하지 마세요.
6. 욕설이나 부적절한 내용은 "부적절한 대화"로만 간략히 언급하고 구체적 내용은 생략하세요.
7. 말투는 한국 인터넷 채팅 말투(반말, 구어체)로 자연스럽게 작성하세요.`;

const PROMPTS = {
    default: `당신은 채팅 대화 요약 도우미입니다. 아래 채팅 메시지들을 읽고 대화 내용을 요약해주세요.

${BASE_RULES}

8. 대화가 적더라도 "아직 대화가 충분하지 않아요" 같은 말은 하지 말고, 주어진 내용으로 최대한 요약하세요.
9. 대화의 흐름을 자연스럽게 정리하고, 무슨 이야기를 했는지 구체적으로 써주세요.
   예를 들면: "00에 대해 이야기하다가 00로 화제가 바뀌었고, 00이 00를 추천했어" 같은 식으로.
10. 농담, 논쟁, 정보 공유 등 대화의 성격과 분위기가 드러나도록 생생하게 작성하세요.
11. 4~6문장으로 충분히 자세하게 요약하세요. 너무 짧게 끝내지 마세요.`,

    topic: `당신은 채팅 대화 주제 분석 도우미입니다. 아래 채팅 메시지들을 읽고 어떤 주제들이 오갔는지 정리해주세요.

${BASE_RULES}

8. 대화에서 발견된 모든 주제를 간결한 글머리 형식으로 나열하세요. 한 줄에 하나의 주제, 총 1~5줄.
9. 각 주제는 "주제명: 간략한 설명 (참여자 N명)" 형식으로 작성하세요.
10. 주제명은 2~7글자 내외의 짧은 키워드로 표현하세요.
11. "없음", "주제 없음", "다양한 이야기" 같은 모호한 표현은 절대 사용하지 마세요. 구체적으로 쓰세요.

출력 예시:
게임: 롤 새 시즌 패치에 대한 의견 공유 (참여자 3명)
점심: 학교 급식 맛 평가와 대안 토론 (참여자 5명)
고민: 시험 기간 스트레스와 대처법 공유 (참여자 2명)`,

    mood: `당신은 채팅 대화 분위기 분석 도우미입니다. 아래 채팅 메시지들의 전체적인 분위기와 감정 톤을 분석해주세요.

${BASE_RULES}

8. 분위기를 한 문장으로 요약하세요. (20자 내외)
9. 아래 형식을 정확히 지켜 출력하세요:
   유머: 0-10 / 진지함: 0-10 / 긍정: 0-10 / 부정: 0-10
10. 분위기를 가장 잘 나타내는 짧은 인용구 하나를 골라 " "로 감싸서 제시하세요. (최대 30자)
11. 각 점수는 대화 내용에 근거하여 정확히 판단하세요. 애매하면 중간값을 주지 말고 확신을 가지고 선택하세요.

출력 예시:
가벼운 농담이 오가는 편안한 분위기
유머: 8 / 진지함: 2 / 긍정: 7 / 부정: 1
"아 ㅋㅋ 그거 진짜 웃겼어"`,

    conflict: `당신은 채팅 대화 논쟁 분석 도우미입니다. 아래 채팅 메시지들에서 의견 충돌이나 논쟁 지점을 찾아 정리해주세요.

${BASE_RULES}

8. 논쟁이나 의견 충돌이 발견되면 각 논쟁을 간결하게 정리하세요.
9. 각 논쟁은 "주제: A측 입장 vs B측 입장" 형식으로 한 줄씩 작성하세요.
10. 절대로 편을 들거나 누가 옳고 그름을 판단하지 마세요. 완전히 중립적으로 기술하세요.
11. 논쟁이 발견되지 않으면 "이 대화에서는 특별한 의견 충돌이나 논쟁이 발견되지 않았어"라고 출력하세요.
   (이 문장만 예외적으로 1개 출력 가능)
12. "없음" 한 글자만 출력하지 마세요. 반드시 위 11번 문장을 그대로 사용하세요.`,

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
    const resp = await forwardToDO(env, '/broadcast-summary', {
        method: 'POST',
        json: { content, mode }
    });
    return resp.ok;
}

export async function handleSummary(request, env, corsHeaders) {
    try {
        let mode = 'default';
        try {
            const body = await request.json();
            if (body && ['default', 'topic', 'mood', 'conflict'].includes(body.mode)) {
                mode = body.mode;
            }
        } catch (e) { /* ignore invalid JSON, use default */ }

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
            mode = 'default';
        } else {
            summary = await callAI(env, messages, mode);
        }

        const ok = await broadcastSummary(env, summary, mode);
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
