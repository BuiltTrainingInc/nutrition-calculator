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
          pageSize: 25, // Increased for more results
          pageNumber: pageNumber,
          // Include ALL data types for complete database access
          dataType: [
            'Survey (FNDDS)',    // What We Eat in America
            'Foundation',        // Foundation Foods
            'SR Legacy',         // Standard Reference Legacy
            'Branded'            // Branded Food Products
          ],
          // Better sorting for relevance
          sortBy: 'dataType.keyword',
          sortOrder: 'asc',
          // Include all nutrients
          nutrients: [203, 204, 205, 208] // Protein, Fat, Carbs, Calories
        })
      }
    );

    const searchData = await searchResponse.json();
    
    if (searchData.foods && searchData.foods.length > 0) {
      // Get detailed nutrition data for each food
      const foodPromises = searchData.foods.slice(0, 15).map(async (food) => {
        try {
          // Get full nutrition details
          const detailResponse = await fetch(
            `https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${apiKey}&nutrients=203,204,205,208`
          );
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            const nutrients = detailData.foodNutrients || [];
            
            const protein = nutrients.find(n => n.nutrient?.number === 203)?.amount || 0;
            const fat = nutrients.find(n => n.nutrient?.number === 204)?.amount || 0;
            const carbs = nutrients.find(n => n.nutrient?.number === 205)?.amount || 0;
            const calories = nutrients.find(n => n.nutrient?.number === 208)?.amount || 0;
            
            return {
              id: food.fdcId,
              name: detailData.description || food.description,
              protein: protein,
              carbs: carbs,
              fat: fat,
              calories: calories,
              dataType: food.dataType,
              brandOwner: food.brandOwner || null,
              ingredients: food.ingredients || null
            };
          } else {
            // Fallback to search result nutrients if detail call fails
            const nutrients = food.foodNutrients || [];
            
            const protein = nutrients.find(n => 
              n.nutrientName?.toLowerCase().includes('protein') ||
              n.nutrientNumber === 203
            )?.value || 0;
            
            const fat = nutrients.find(n => 
              n.nutrientName?.toLowerCase().includes('total lipid') ||
              n.nutrientName?.toLowerCase().includes('fat') ||
              n.nutrientNumber === 204
            )?.value || 0;
            
            const carbs = nutrients.find(n => 
              n.nutrientName?.toLowerCase().includes('carbohydrate') ||
              n.nutrientNumber === 205
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
              dataType: food.dataType,
              brandOwner: food.brandOwner || null,
              ingredients: food.ingredients || null
            };
          }
        } catch (error) {
          console.error(`Error fetching details for food ${food.fdcId}:`, error);
          return null;
        }
      });

      const foods = (await Promise.all(foodPromises)).filter(food => food !== null);
      
      // Sort by data type priority (Foundation > SR Legacy > Survey > Branded)
      foods.sort((a, b) => {
        const priority = {
          'Foundation': 1,
          'SR Legacy': 2,
          'Survey (FNDDS)': 3,
          'Branded': 4
        };
        return (priority[a.dataType] || 5) - (priority[b.dataType] || 5);
      });

      res.json({ 
        foods,
        totalHits: searchData.totalHits,
        totalPages: Math.ceil(searchData.totalHits / 25),
        currentPage: pageNumber
      });
    } else {
      res.json({ foods: [], totalPages: 0, totalHits: 0 });
    }
    
  } catch (error) {
    console.error('USDA Search Error:', error);
    res.status(500).json({ error: 'Failed to search USDA database' });
  }
}
