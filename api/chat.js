export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).end();
  const body = {...req.body, model: "llama-3.3-70b-versatile"};
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