const YOCO_API = "https://payments.yoco.com/api/checkouts";

export async function createYocoCheckout(params: {
  amountRands: number;
  registrationId: string;
  divisionName: string;
  teamOrAthleteName: string;
}) {
  const secretKey = process.env.YOCO_SECRET_KEY;
  if (!secretKey) throw new Error("YOCO_SECRET_KEY is not set");

  const res = await fetch(YOCO_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amountRands * 100),
      currency: "ZAR",
      metadata: {
        registrationId: params.registrationId,
        division: params.divisionName,
        name: params.teamOrAthleteName,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Yoco checkout creation failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string; redirectUrl: string };
  return { checkoutId: data.id, payUrl: data.redirectUrl };
}
