import { put } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const data = JSON.parse(body);

    const id = `fpg-game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const blob = await put(`games/${id}.json`, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
    });

    return res.status(200).json({ id, url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Save failed" });
  }
}
