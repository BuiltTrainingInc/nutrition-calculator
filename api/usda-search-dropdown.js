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
          pageSize: 10,
          dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy'],
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        })
      }
    );

    const searchData = await searchResponse.json();
    
    if (searchData.foods && searchData.foods.length > 0) {
      const foods = searchData.foods.map(food => {
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

        return {
          id: food.fdcId,
          name: food.description,
          protein: protein,
          carbs: carbs,
          fat: fat,
          calories: calories,
          dataType: food.dataType
        };
      });

      res.json({ foods });
    } else {
      res.json({ foods: [] });
    }
    
  } catch (error) {
    console.error('USDA Search Error:', error);
    res.status(500).json({ error: 'Failed to search USDA database' });
  }
}
