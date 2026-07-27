import { getStripeClient } from "@/lib/server/stripe";

function formatRecurringPriceLabel(price: {
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
}): string | null {
  if (price.unit_amount == null || !price.recurring) return null;

  const currency = price.currency.toUpperCase();
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price.unit_amount / 100);

  const interval = price.recurring.interval;
  const intervalCount = price.recurring.interval_count;

  if (intervalCount <= 1) {
    return `${formattedAmount}/${interval}`;
  }

  return `${formattedAmount} every ${intervalCount} ${interval}s`;
}

export async function GET(): Promise<Response> {
  const priceId = process.env.STRIPE_PLUS_PRICE_ID;
  if (!priceId) {
    return Response.json({ plus: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const stripe = getStripeClient();
    const price = await stripe.prices.retrieve(priceId);

    const priceLabel = formatRecurringPriceLabel({
      currency: price.currency,
      unit_amount: price.unit_amount,
      recurring: price.recurring
        ? {
            interval: price.recurring.interval,
            interval_count: price.recurring.interval_count,
          }
        : null,
    });

    return Response.json(
      {
        plus: {
          priceId: price.id,
          priceLabel,
          currency: price.currency.toUpperCase(),
          interval: price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? null,
          unitAmount: price.unit_amount,
        },
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch {
    return Response.json({ plus: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
