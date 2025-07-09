// Save this as: api/calculate-nutrition.js
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
    const { meals } = req.body;
    
    const systemPrompt = `
You are a nutrition assistant called the "Daily Food Log Calculator."
Your job is to help users calculate the total calories, protein, carbs, and fats based on a list of foods they ate during the day.

You are friendly, straightforward, and give clear, step-by-step responses.

When a user inputs their food log and separates it by meals (e.g., Meal 1, Meal 2, etc.), you must:
1. Break down each meal individually with its own macro and calorie summary.
2. At the end, give a final **daily total**.
3. Format each meal with clear titles.
4. Use bolded macro names and clean tables.
5. Avoid overly detailed nutrition explanations — just give the breakdown.

End every response with:
"Let me know if you want to adjust anything or need suggestions."
`;

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
          { role: "user", content: meals }
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
