import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/utils/db';
import { sendMetaEvent, hashData } from '@/utils/metaCapi';
import productsData from '@/data/products.json';
import crypto from 'crypto';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items, utmData, contactData } = body; // Array of { sku, quantity }, Optional Map of UTMs, Optional contact form data

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Invalid items in payload' }, { status: 400 });
        }

        // 1. Fetch all product data and build a flat list of prices for bundle calculation
        const allItemsWithData = [];
        for (const item of items) {
            let dbProduct;
            try {
                const res = await query('SELECT data->>\'title\' as title, data->\'images\' as images, price FROM public.products WHERE sku = $1', [item.sku]);
                if (res.rows.length > 0) {
                    dbProduct = res.rows[0];
                }
            } catch (dbError) {
                console.warn('Database query failed for SKU:', item.sku, dbError);
            }

            // Fallback for JSON products
            if (!dbProduct) {
                const jsonProduct = productsData.products.find(p => p.id === item.sku);
                if (jsonProduct) {
                    dbProduct = {
                        title: jsonProduct.title,
                        images: jsonProduct.images,
                        price: jsonProduct.price
                    };
                }
            }

            if (!dbProduct) {
                return NextResponse.json({ error: `Product SKU not found: ${item.sku}` }, { status: 404 });
            }

            const qty = parseInt(item.quantity || 1, 10);
            allItemsWithData.push({
                ...dbProduct,
                sku: item.sku,
                quantity: qty,
                price: parseFloat(dbProduct.price)
            });
        }

        // 2. Calculate Total Price using Bundle Logic (same as CartContext.tsx)
        let totalItemsCount = 0;
        let allPrices: number[] = [];
        
        allItemsWithData.forEach(item => {
            totalItemsCount += item.quantity;
            for (let i = 0; i < item.quantity; i++) {
                allPrices.push(item.price);
            }
        });

        // Sort descending to apply discounts to most expensive items first (standard practice)
        allPrices.sort((a, b) => b - a);

        let finalTotalPrice = 0;
        let index = 0;

        while (allPrices.length - index >= 5) {
            finalTotalPrice += 99.99;
            index += 5;
        }

        while (allPrices.length - index >= 3) {
            finalTotalPrice += 49.99;
            index += 3;
        }

        while (index < allPrices.length) {
            finalTotalPrice += allPrices[index];
            index++;
        }

        // 3. Create Line Items
        // Since Stripe requires prices per item, we'll calculate the weighted proportion 
        // to ensure the total is exactly what we calculated.
        const rawTotal = allPrices.reduce((a, b) => a + b, 0);
        const discountFactor = rawTotal > 0 ? finalTotalPrice / rawTotal : 1;

        const lineItems = allItemsWithData.map(item => {
            // Handle image URL
            let imageUrls: string[] = [];
            if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const imagePath = item.images[0];
                if (imagePath.startsWith('http')) {
                    imageUrls = [imagePath];
                } else {
                    const encodedPath = imagePath.split('/').map((part: string) => encodeURIComponent(part)).join('/');
                    imageUrls = [`${origin}${encodedPath.startsWith('/') ? '' : '/'}${encodedPath}`];
                }
            }

            // Apply proportional discount to each item's price
            const adjustedUnitPrice = Math.round(item.price * discountFactor * 100);

            return {
                price_data: {
                    currency: process.env.STRIPE_CURRENCY || 'eur',
                    product_data: {
                        name: item.title || `Product SKU: ${item.sku}`,
                        images: imageUrls.length > 0 ? imageUrls : undefined,
                    },
                    unit_amount: adjustedUnitPrice,
                },
                quantity: item.quantity,
            };
        });

        // Ensure the sum matches finalTotalPrice exactly (adjusting for rounding)
        const lineItemsTotal = lineItems.reduce((acc, item) => acc + (item.price_data.unit_amount * item.quantity), 0);
        const diff = Math.round(finalTotalPrice * 100) - lineItemsTotal;
        if (diff !== 0 && lineItems.length > 0) {
            lineItems[lineItems.length - 1].price_data.unit_amount += diff;
        }

        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            line_items: lineItems,
            mode: 'payment',
            locale: 'de',
            customer_email: contactData?.email || undefined,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['DE'], // Exclusively set to Germany per user request
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 0,
                            currency: process.env.STRIPE_CURRENCY || 'eur',
                        },
                        display_name: 'Versandkostenfrei (Free Shipping)',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 5,
                            },
                        },
                    },
                },
            ],
            return_url: `${request.headers.get('origin') || process.env.STRIPE_RETURN_URL || 'http://localhost:3000'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
                utm_source: utmData?.utm_source?.substring(0, 500) || '',
                utm_medium: utmData?.utm_medium?.substring(0, 500) || '',
                utm_campaign: utmData?.utm_campaign?.substring(0, 500) || '',
                utm_content: utmData?.utm_content?.substring(0, 500) || '',
                utm_term: utmData?.utm_term?.substring(0, 500) || '',
                src: utmData?.src?.substring(0, 500) || '',
                sck: utmData?.sck?.substring(0, 500) || '',
            }
        });

        // Fire Meta CAPI InitiateCheckout Event
        const userIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || null;
        const userAgent = request.headers.get('user-agent') || null;
        const totalValue = lineItems.reduce((acc, item) => acc + (item.price_data?.unit_amount || 0) * (item.quantity || 1), 0) / 100;

        const eventId = crypto.randomUUID();

        const userDataParams: any = {};
        if (contactData?.email) userDataParams.em = hashData(contactData.email);
        if (contactData?.phone) userDataParams.ph = hashData(contactData.phone.replace(/\D/g, ''));
        if (contactData?.name) {
            const nameParts = contactData.name.trim().split(' ');
            if (nameParts.length > 0) userDataParams.fn = hashData(nameParts[0]);
            if (nameParts.length > 1) userDataParams.ln = hashData(nameParts.slice(1).join(' '));
        }

        await sendMetaEvent({
            eventName: 'InitiateCheckout',
            eventSourceUrl: request.headers.get('referer') || request.url,
            userIp,
            userAgent,
            eventId,
            userData: Object.keys(userDataParams).length > 0 ? userDataParams : undefined,
            customData: {
                currency: process.env.STRIPE_CURRENCY || 'eur',
                value: totalValue,
                content_ids: items.map((i: any) => i.sku),
                content_type: 'product',
            }
        });

        return NextResponse.json({
            clientSecret: session.client_secret,
            eventId: eventId
        });
    } catch (error: any) {
        console.error('Error creating PaymentIntent:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
