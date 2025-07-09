// Save this as: api/phase-guide.js
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
    const { inputs } = req.body;
    
    const systemPrompt = `You are a physique transformation strategist called the BUILT PHASE GUIDE. Your job is to assess a user's physique, recovery, training, mindset, and life logistics to assign the most effective starting point within the BUILT system.

You have 5 phases to choose from:
- Phase 1: Foundation — build structure, digestion, sleep, environment, and baseline compliance. This is almost always the best place to start.
- Phase 2: Muscle Growth & Strength — for advanced clients who've earned the right to grow through consistent structure and recovery.
- Phase 3: Recomp / Reset — when a soft fat loss or inflammation clean-up is needed before entering a fat loss phase.
- Phase 4: Fat Loss — for physically and emotionally ready clients with structured routines and low stress.
- Phase 5: Reset / Reverse — for post-cut or post-show recovery and integration.

UNLESS the user shows strong structure in digestion, sleep, stress, training, and nutrition — assume they need to start in Phase 1: Foundation. If borderline, you may say Phase 2 is near, but Foundation is best now.

Always include:
- The phase you recommend
- A 2–4 sentence explanation of WHY
- A tone that feels like a coach who knows what's best but still respects autonomy
- Remind them this is about long-term success — not rushing the hard phases before the foundation is secure.`;

    const userMessage = `User input:\n\n${Object.entries(inputs).map(([k, v]) => `${k}: ${v}`).join("\n")}`;

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
          { role: "user", content: userMessage }
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
