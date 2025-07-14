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

  const { searchTerm, pageNumber = 1 } = req.body;
  const apiKey = process.env.USDA_API_KEY;

  if (!searchTerm || searchTerm.length < 2) {
    return res.json({ foods: [], totalPages: 0 });
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
          pageNumber: pageNumber,
          dataType: [
            'Survey (FNDDS)',
            'Foundation',
            'SR Legacy',
            'Branded'
          ],
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        })
      }
    );

    const searchData = await searchResponse.json();
    console.log('USDA Response:', JSON.stringify(searchData, null, 2));
    
    if (searchData.foods && searchData.foods.length > 0) {
      const foods = searchData.foods.map(food => {
        const nutrients = food.foodNutrients || [];
        console.log('Food:', food.description, 'Nutrients:', nutrients);
        
        // Multiple ways to find nutrients - USDA API is inconsistent
        let protein = 0, carbs = 0, fat = 0, calories = 0;

        // Method 1: Search by nutrient number (most reliable)
        const proteinNutrient = nutrients.find(n => n.nutrientNumber === 203);
        const fatNutrient = nutrients.find(n => n.nutrientNumber === 204);
        const carbNutrient = nutrients.find(n => n.nutrientNumber === 205);
        const calorieNutrient = nutrients.find(n => n.nutrientNumber === 208);

        if (proteinNutrient) protein = proteinNutrient.value || 0;
        if (fatNutrient) fat = fatNutrient.value || 0;
        if (carbNutrient) carbs = carbNutrient.value || 0;
        if (calorieNutrient) calories = calorieNutrient.value || 0;

        // Method 2: Search by nutrient name (fallback)
        if (protein === 0) {
          const proteinByName = nutrients.find(n => 
            n.nutrientName?.toLowerCase().includes('protein')
          );
          if (proteinByName) protein = proteinByName.value || 0;
        }

        if (fat === 0) {
          const fatByName = nutrients.find(n => 
            n.nutrientName?.toLowerCase().includes('total lipid') ||
            n.nutrientName?.toLowerCase().includes('fat')
          );
          if (fatByName) fat = fatByName.value || 0;
        }

        if (carbs === 0) {
          const carbsByName = nutrients.find(n => 
            n.nutrientName?.toLowerCase().includes('carbohydrate')
          );
          if (carbsByName) carbs = carbsByName.value || 0;
        }

        if (calories === 0) {
          const caloriesByName = nutrients.find(n => 
            n.nutrientName?.toLowerCase().includes('energy')
          );
          if (caloriesByName) calories = caloriesByName.value || 0;
        }

        console.log('Extracted:', { protein, fat, carbs, calories });

        return {
          id: food.fdcId,
          name: food.description,
          protein: protein,
          carbs: carbs,
          fat: fat,
          calories: calories,
          dataType: food.dataType,
          brandOwner: food.brandOwner || null,
          // Keep raw nutrients for debugging
          rawNutrients: nutrients.map(n => ({
            name: n.nutrientName,
            number: n.nutrientNumber,
            value: n.value
          }))
        };
      });

      // Filter out foods with no nutrition data
      const validFoods = foods.filter(food => 
        food.protein > 0 || food.carbs > 0 || food.fat > 0 || food.calories > 0
      );

      // Sort by data type priority
      validFoods.sort((a, b) => {
        const priority = {
          'Foundation': 1,
          'SR Legacy': 2,
          'Survey (FNDDS)': 3,
          'Branded': 4
        };
        return (priority[a.dataType] || 5) - (priority[b.dataType] || 5);
      });

      res.json({ 
        foods: validFoods,
        totalHits: searchData.totalHits,
        totalPages: Math.ceil(searchData.totalHits / 15),
        currentPage: pageNumber,
        debug: {
          originalCount: foods.length,
          validCount: validFoods.length
        }
      });
    } else {
      res.json({ foods: [], totalPages: 0, totalHits: 0 });
    }
    
  } catch (error) {
    console.error('USDA Search Error:', error);
    res.status(500).json({ error: 'Failed to search USDA database', details: error.message });
  }
}
