export default async function handler(req, res) {
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
    const searchResponse = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchTerm,
          pageSize: 15,
          dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy', 'Branded']
        })
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`USDA API returned ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    if (searchData.foods && searchData.foods.length > 0) {
      const foods = searchData.foods.map(food => {
        const nutrients = food.foodNutrients || [];
        
        let protein = 0, carbs = 0, fat = 0, calories = 0;

        // Extract nutrients by number (most reliable)
        nutrients.forEach(nutrient => {
          switch(nutrient.nutrientNumber) {
            case 203: protein = nutrient.value || 0; break;
            case 204: fat = nutrient.value || 0; break;
            case 205: carbs = nutrient.value || 0; break;
            case 208: calories = nutrient.value || 0; break;
          }
        });

        // Fallback: extract by name if numbers didn't work
        if (protein === 0 || carbs === 0 || fat === 0 || calories === 0) {
          nutrients.forEach(nutrient => {
            const name = (nutrient.nutrientName || '').toLowerCase();
            if (protein === 0 && name.includes('protein')) protein = nutrient.value || 0;
            if (carbs === 0 && name.includes('carbohydrate')) carbs = nutrient.value || 0;
            if (fat === 0 && (name.includes('total lipid') || name.includes('fat'))) fat = nutrient.value || 0;
            if (calories === 0 && name.includes('energy')) calories = nutrient.value || 0;
          });
        }

        return {
          id: food.fdcId,
          name: food.description,
          protein: Math.max(0, protein),
          carbs: Math.max(0, carbs),
          fat: Math.max(0, fat),
          calories: Math.max(0, calories),
          dataType: food.dataType,
          brandOwner: food.brandOwner || null
        };
      });

      // Filter foods with some nutrition data
      const validFoods = foods.filter(food => 
        food.protein > 0 || food.carbs > 0 || food.fat > 0 || food.calories > 0
      );

      // Sort by data type priority
      validFoods.sort((a, b) => {
        const priority = { 'Foundation': 1, 'SR Legacy': 2, 'Survey (FNDDS)': 3, 'Branded': 4 };
        return (priority[a.dataType] || 5) - (priority[b.dataType] || 5);
      });

      res.json({ foods: validFoods });
    } else {
      res.json({ foods: [] });
    }
    
  } catch (error) {
    console.error('USDA Search Error:', error);
    res.status(500).json({ error: 'Failed to search USDA database' });
  }
}
