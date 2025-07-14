export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { searchTerm } = req.body;
  const apiKey = process.env.USDA_API_KEY;

  if (!searchTerm || searchTerm.length < 2) {
    return res.json({ foods: [] });
  }

  try {
    console.log('Searching USDA for:', searchTerm);
    
    // Use GET request instead of POST (simpler)
    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(searchTerm)}&pageSize=10`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      console.error('USDA API Error:', searchResponse.status, searchResponse.statusText);
      return res.status(500).json({ error: `USDA API returned ${searchResponse.status}` });
    }

    const searchData = await searchResponse.json();
    console.log('USDA Response received');
    
    if (searchData.foods && searchData.foods.length > 0) {
      const foods = searchData.foods.slice(0, 8).map(food => {
        const nutrients = food.foodNutrients || [];
        
        // Extract nutrients
        let protein = 0, carbs = 0, fat = 0, calories = 0;

        nutrients.forEach(nutrient => {
          const value = nutrient.value || 0;
          
          // By nutrient number (most reliable)
          if (nutrient.nutrientNumber === 203) protein = value;
          if (nutrient.nutrientNumber === 204) fat = value;
          if (nutrient.nutrientNumber === 205) carbs = value;
          if (nutrient.nutrientNumber === 208) calories = value;
          
          // By name (backup)
          if (nutrient.nutrientName) {
            const name = nutrient.nutrientName.toLowerCase();
            if (protein === 0 && name.includes('protein')) protein = value;
            if (carbs === 0 && name.includes('carbohydrate')) carbs = value;
            if (fat === 0 && (name.includes('total lipid') || name.includes('fat'))) fat = value;
            if (calories === 0 && name.includes('energy')) calories = value;
          }
        });

        return {
          id: food.fdcId,
          name: food.description,
          protein: Math.max(0, protein || 0),
          carbs: Math.max(0, carbs || 0),
          fat: Math.max(0, fat || 0),
          calories: Math.max(0, calories || 0),
          dataType: food.dataType || 'USDA'
        };
      });

      // Filter out foods with no nutrition data
      const validFoods = foods.filter(food => 
        food.protein > 0 || food.carbs > 0 || food.fat > 0 || food.calories > 0
      );

      console.log('Valid foods found:', validFoods.length);

      res.json({ foods: validFoods });
    } else {
      console.log('No foods found in USDA response');
      res.json({ foods: [] });
    }
    
  } catch (error) {
    console.error('USDA Search Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to search USDA database',
      details: error.message 
    });
  }
}
