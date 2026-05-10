export interface TikTokEventData {
    event: string;
    eventId?: string;
    eventTime?: number;
    eventSourceUrl: string;
    userIp?: string | null;
    userAgent?: string | null;
    ttclid?: string | null;
    properties?: {
        currency?: string;
        value?: number;
        contents?: Array<{
            content_id?: string;
            content_name?: string;
            quantity?: number;
            price?: number;
        }>;
        content_type?: string;
    };
}

export async function sendTikTokEvent(data: TikTokEventData) {
    const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
    const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

    if (!TIKTOK_PIXEL_ID || !TIKTOK_ACCESS_TOKEN) {
        console.warn('TikTok CAPI not configured. Missing NEXT_PUBLIC_TIKTOK_PIXEL_ID or TIKTOK_ACCESS_TOKEN.');
        return null;
    }

    const user: Record<string, string> = {};
    if (data.userIp) user.ip = data.userIp;
    if (data.userAgent) user.user_agent = data.userAgent;
    if (data.ttclid) user.ttclid = data.ttclid;

    const payload = {
        pixel_code: TIKTOK_PIXEL_ID,
        event_source: 'web',
        partner_name: 'TikTokBusinessNextjs',
        data: [
            {
                event: data.event,
                event_id: data.eventId || `${data.event}_${Date.now()}`,
                event_time: data.eventTime || Math.floor(Date.now() / 1000),
                user,
                page: { url: data.eventSourceUrl },
                properties: data.properties || {}
            }
        ]
    };

    try {
        const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Access-Token': TIKTOK_ACCESS_TOKEN
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.code !== 0) {
            console.error(`TikTok CAPI Error [${data.event}]:`, result);
        } else {
            console.log(`TikTok CAPI Success [${data.event}]:`, result.message);
        }
        return result;
    } catch (error) {
        console.error('TikTok CAPI Request Failed:', error);
        return null;
    }
}
