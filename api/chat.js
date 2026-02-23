export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).end();

  const { messages, system, max_tokens, tools } = req.body;

  // Build OpenAI-format messages for Groq
  const openaiMessages = [];
  if(system) openaiMessages.push({ role: "system", content: system });
  if(messages) openaiMessages.push(...messages);

  // Convert Anthropic tool format to OpenAI tool format
  const openaiTools = tools?.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }
  }));

  const groqBody = {
    model: "llama-3.3-70b-versatile",
    max_tokens: max_tokens || 1000,
    messages: openaiMessages,
    ...(openaiTools?.length ? { tools: openaiTools, tool_choice: "auto" } : {}),
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(groqBody)
    });

    const data = await response.json();
    if(!response.ok) return res.status(response.status).json({ error: data });

    const msg = data.choices?.[0]?.message;
    const content = [];

    // Add text content if present
    if(msg?.content) content.push({ type: "text", text: msg.content });

    // Convert OpenAI tool_calls back to Anthropic tool_use format
    if(msg?.tool_calls?.length) {
      for(const tc of msg.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }
    }

    if(!content.length) content.push({ type: "text", text: "" });
    res.json({ content });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
