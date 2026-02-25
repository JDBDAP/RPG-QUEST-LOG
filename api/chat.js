export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).end();

  const { system, messages = [], tools, ...rest } = req.body;

  // Convert Anthropic-style top-level `system` to OpenAI system message
  const normalizedMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  // Build clean OpenAI-compatible body, drop Anthropic-only fields
  const body = {
    ...rest,
    model: "llama-3.3-70b-versatile",
    messages: normalizedMessages,
    ...(tools ? { tools } : {}),
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  res.json(data);
}
