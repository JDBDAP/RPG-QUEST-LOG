export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { system, messages = [], tools, model, ...rest } = req.body;

    // Convert Anthropic top-level `system` → OpenAI system message
    const normalizedMessages = system
      ? [{ role: "system", content: system }, ...messages]
      : messages;

    // Convert Anthropic tool format → OpenAI/Groq tool format
    // Anthropic: { name, description, input_schema }
    // OpenAI:    { type: "function", function: { name, description, parameters } }
    const normalizedTools = tools
      ? tools.map(t => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description || "",
            parameters: t.input_schema || { type: "object", properties: {} }
          }
        }))
      : undefined;

    const body = {
      ...rest,
      model: "llama-3.3-70b-versatile",
      messages: normalizedMessages,
      ...(normalizedTools ? { tools: normalizedTools } : {}),
    };

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error || data,
        _debug: `Groq ${groqRes.status}`
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
