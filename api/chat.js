export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Allow model to be set per-request (needed for vision model calls)
  // Fall back to llama-3.3-70b-versatile if not specified
  const body = {
    model: "llama-3.3-70b-versatile",
    ...req.body,
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    // Always try to parse JSON — Groq returns error details as JSON too
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: { message: `Non-JSON response from Groq (${response.status}): ${text.slice(0, 200)}` }
      });
    }

    // Forward Groq's status code so client can distinguish 429/500/etc.
    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(503).json({
      error: { message: `Could not reach Groq API: ${err.message}` }
    });
  }
}
