export async function handleTurnstileVerify(request, env, corsHeaders) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const token = body.token;

        if (!token || typeof token !== 'string') {
            return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (token.length > 2048) {
            return new Response(JSON.stringify({ success: false, error: 'Token too long' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const secretKey = env.TURNSTILE_SECRET_KEY;
        if (!secretKey) {
            console.error('TURNSTILE_SECRET_KEY is not configured');
            return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const clientIP = request.headers.get('CF-Connecting-IP') || '';

        const formData = new FormData();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (clientIP) {
            formData.append('remoteip', clientIP);
        }

        const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result = await verifyResponse.json();

        if (result.success) {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            console.warn('Turnstile verification failed:', result['error-codes']);
            return new Response(JSON.stringify({
                success: false,
                error: 'Verification failed',
                errorCodes: result['error-codes'] || []
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Turnstile verify error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}