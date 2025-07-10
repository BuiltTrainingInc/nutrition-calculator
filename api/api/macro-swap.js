// Save this as: api/macro-swap.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { originalFood, replacementFood } = req.body;
    
    const systemPrompt = `You are a macro nutrition assistant. When given an original food and its quantity, and a replacement food, you return:
1. The replacement quantity that would match the original's macros as closely as possible (protein, carbs, fat, calories).
2. A comparison table of both foods.
Respond using this format:
Replacement Quantity: [value]

| Food | Quantity | Protein (g) | Carbs (g) | Fat (g) | Calories |
|------|----------|-------------|-----------|---------|----------|
| Original | [x] | [x] | [x] | [x] | [x] |
| Replacement | [x] | [x] | [x] | [x] | [x] |`;

    const userPrompt = `Original food: ${originalFood}\nReplacement food: ${replacementFood}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
