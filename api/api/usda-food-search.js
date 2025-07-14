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

  const { foodQuery } = req.body;
  const apiKey = process.env.USDA_API_KEY;

  try {
    console.log('Searching USDA for:', foodQuery);
    
    // Search for food in USDA database
    const searchResponse = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: foodQuery,
          pageSize: 3,
          dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy']
        })
      }
    );

    const searchData = await searchResponse.json();
    
    if (searchData.foods && searchData.foods.length > 0) {
      // Get the first result
      const food = searchData.foods[0];
      
      // Extract macros from search results
      const nutrients = food.foodNutrients || [];
      
      const protein = nutrients.find(n => 
        n.nutrientName?.toLowerCase().includes('protein') ||
        n.nutrientNumber === 203
      )?.value || 0;
      
      const carbs = nutrients.find(n => 
        n.nutrientName?.toLowerCase().includes('carbohydrate') ||
        n.nutrientNumber === 205
      )?.value || 0;
      
      const fat = nutrients.find(n => 
        n.nutrientName?.toLowerCase().includes('total lipid') ||
        n.nutrientName?.toLowerCase().includes('fat') ||
        n.nutrientNumber === 204
      )?.value || 0;
      
      const calories = nutrients.find(n => 
        n.nutrientName?.toLowerCase().includes('energy') ||
        n.nutrientNumber === 208
      )?.value || 0;
      
      console.log('USDA Found:', food.description, { protein, carbs, fat, calories });
      
      res.json({
        success: true,
        food: {
          name: food.description,
          protein: protein,
          carbs: carbs,
          fat: fat,
          calories: calories,
          source: 'USDA'
        }
      });
    } else {
      console.log('No USDA results for:', foodQuery);
      res.json({ success: false, error: 'Food not found in USDA database' });
    }
    
  } catch (error) {
    console.error('USDA API Error:', error);
    res.status(500).json({ error: 'Failed to fetch from USDA database' });
  }
}
