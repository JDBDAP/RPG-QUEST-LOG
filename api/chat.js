export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).end();

  // Extract Anthropic-format request fields
  const { messages, system, max_tokens, tools } = req.body;

  // Build OpenAI-format messages for Groq
  const openaiMessages = [];
  if(system) openaiMessages.push({ role: "system", content: system });
  if(messages) openaiMessages.push(...messages);

  const groqBody = {
    model: "llama-3.3-70b-versatile",
    max_tokens: max_tokens || 1000,
    messages: openaiMessages,
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

    if(!response.ok){
      return res.status(response.status).json({ error: data });
    }

    // Translate OpenAI response back to Anthropic format the app expects
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
