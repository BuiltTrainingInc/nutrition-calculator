<script>
let selectedFoods = {
  original: null,
  replacement: null
};

let searchTimeout;

// Preparation factor system
const preparationFactors = {
  'cooked': {
    'rice': 0.28,        // 100g dry rice = ~280g cooked rice
    'pasta': 0.31,       // 100g dry pasta = ~310g cooked pasta
    'oats': 0.33,        // 100g dry oats = ~330g cooked oats
    'quinoa': 0.25,      // 100g dry quinoa = ~250g cooked quinoa
    'lentils': 0.4,      // 100g dry lentils = ~400g cooked lentils
    'beans': 0.45,       // 100g dry beans = ~450g cooked beans
    'barley': 0.3,       // 100g dry barley = ~300g cooked barley
    'default': 0.75      // general cooked factor
  },
  
  'fried': {
    'chicken': 1.3,      // adds ~30% calories from oil
    'fish': 1.25,        // adds ~25% calories from oil
    'vegetables': 1.4,   // adds ~40% calories from oil
    'potato': 1.5,       // french fries
    'default': 1.2
  },
  
  'grilled': {
    'chicken': 0.85,     // loses some fat
    'beef': 0.8,         // loses more fat
    'fish': 0.9,         // loses less fat
    'pork': 0.82,        // loses fat
    'default': 0.85
  },
  
  'baked': {
    'chicken': 0.9,      // slight moisture loss
    'fish': 0.85,        // more moisture loss
    'potato': 0.8,       // water evaporation
    'vegetables': 0.9,   // slight moisture loss
    'default': 0.85
  },
  
  'steamed': {
    'vegetables': 0.95,  // minimal nutrient loss
    'fish': 0.9,         // slight moisture loss
    'default': 0.9
  },
  
  'roasted': {
    'chicken': 0.88,     // fat and moisture loss
    'vegetables': 0.85,  // moisture loss
    'nuts': 1.0,         // no change
    'default': 0.85
  },
  
  'raw': {
    'default': 1.0       // no change
  }
};

function detectPreparation(foodName) {
  const name = foodName.toLowerCase();
  
  // Check for cooking method keywords in user input OR USDA name
  if (name.includes('cooked') || name.includes('boiled') || name.includes('prepared')) return 'cooked';
  if (name.includes('fried') || name.includes('deep-fried') || name.includes('pan-fried')) return 'fried';
  if (name.includes('grilled') || name.includes('barbecued') || name.includes('bbq')) return 'grilled';
  if (name.includes('baked') || name.includes('roasted')) return 'baked';
  if (name.includes('steamed')) return 'steamed';
  if (name.includes('raw') || name.includes('fresh') || name.includes('dry') || name.includes('uncooked')) return 'raw';
  
  // For rice/pasta/grains, be more specific
  if (name.includes('rice') || name.includes('pasta') || name.includes('oats') || name.includes('quinoa')) {
    // If USDA name explicitly says raw/dry, it's raw
    if (name.includes('dry') || name.includes('uncooked') || name.includes('raw')) return 'raw';
    // If USDA name explicitly says cooked/boiled/prepared, it's cooked
    if (name.includes('cooked') || name.includes('boiled') || name.includes('prepared')) return 'cooked';
    // Default assumption: if it's a grain and doesn't specify, assume cooked
    return 'cooked';
  }
  
  return 'raw'; // default
}

function detectFoodType(foodName) {
  const name = foodName.toLowerCase();
  
  if (name.includes('rice')) return 'rice';
  if (name.includes('pasta') || name.includes('noodle')) return 'pasta';
  if (name.includes('oats') || name.includes('oatmeal')) return 'oats';
  if (name.includes('quinoa')) return 'quinoa';
  if (name.includes('lentil')) return 'lentils';
  if (name.includes('bean')) return 'beans';
  if (name.includes('barley')) return 'barley';
  if (name.includes('chicken')) return 'chicken';
  if (name.includes('beef')) return 'beef';
  if (name.includes('fish') || name.includes('salmon') || name.includes('tuna') || name.includes('cod')) return 'fish';
  if (name.includes('pork')) return 'pork';
  if (name.includes('potato')) return 'potato';
  if (name.includes('vegetable')) return 'vegetables';
  if (name.includes('nuts') || name.includes('almond') || name.includes('walnut')) return 'nuts';
  
  return 'default';
}

function applyPreparationFactor(food, quantity) {
  const preparation = detectPreparation(food.name);
  const foodType = detectFoodType(food.name);
  const usdaName = food.name.toLowerCase();
  
  // Check if USDA data is already in the cooked state
  const isAlreadyCooked = usdaName.includes('cooked') || 
                         usdaName.includes('boiled') || 
                         usdaName.includes('steamed') ||
                         usdaName.includes('prepared');
  
  // Check if USDA data is raw/dry
  const isAlreadyRaw = usdaName.includes('raw') || 
                      usdaName.includes('dry') || 
                      usdaName.includes('uncooked');
  
  // Get the appropriate factor
  const factors = preparationFactors[preparation] || {};
  const factor = factors[foodType] || factors['default'] || 1.0;
  
  let adjustedFood = { ...food };
  let explanation = '';
  
  // For grains/legumes - handle cooked vs raw conversion
  if (['rice', 'pasta', 'oats', 'quinoa', 'lentils', 'beans', 'barley'].includes(foodType)) {
    
    // Case 1: USDA data is already cooked, no conversion needed
    if (isAlreadyCooked) {
      explanation = `USDA data already shows cooked values - no conversion needed`;
      return {
        adjustedQuantity: quantity,
        adjustedFood: adjustedFood,
        factor: 1.0,
        explanation: explanation,
        preparation: preparation
      };
    }
    
    // Case 2: USDA data is raw, but user wants cooked equivalent
    else if (preparation === 'cooked' && (isAlreadyRaw || !isAlreadyCooked)) {
      const dryEquivalent = quantity * factor;
      explanation = `${quantity}g cooked ≈ ${dryEquivalent.toFixed(0)}g dry weight (USDA raw data)`;
      return {
        adjustedQuantity: dryEquivalent,
        adjustedFood: adjustedFood,
        factor: factor,
        explanation: explanation,
        preparation: preparation
      };
    }
    
    // Case 3: Both USDA data and user input are the same state
    else {
      explanation = `Using ${preparation} values as-is`;
      return {
        adjustedQuantity: quantity,
        adjustedFood: adjustedFood,
        factor: 1.0,
        explanation: explanation,
        preparation: preparation
      };
    }
  } 
  
  // For fried foods, increase fat and calories
  else if (preparation === 'fried' && !usdaName.includes('fried')) {
    adjustedFood.fat *= factor;
    adjustedFood.calories *= factor;
    explanation = `+${((factor - 1) * 100).toFixed(0)}% calories from cooking oil`;
    return {
      adjustedQuantity: quantity,
      adjustedFood: adjustedFood,
      factor: factor,
      explanation: explanation,
      preparation: preparation
    };
  }
  
  // For grilled/baked foods, reduce fat slightly (only if not already cooked this way)
  else if (['grilled', 'baked', 'roasted'].includes(preparation) && 
           !usdaName.includes('grilled') && !usdaName.includes('baked') && !usdaName.includes('roasted')) {
    adjustedFood.fat *= factor;
    adjustedFood.calories = adjustedFood.protein * 4 + adjustedFood.carbs * 4 + adjustedFood.fat * 9;
    explanation = `${preparation} preparation: ${((1 - factor) * 100).toFixed(0)}% fat/moisture reduction`;
    return {
      adjustedQuantity: quantity,
      adjustedFood: adjustedFood,
      factor: factor,
      explanation: explanation,
      preparation: preparation
    };
  }
  
  // No adjustment needed
  else {
    explanation = isAlreadyCooked ? 'USDA data already cooked' : 
                 isAlreadyRaw ? 'USDA data is raw' : 
                 preparation === 'raw' ? '' : `${preparation} preparation detected`;
    return {
      adjustedQuantity: quantity,
      adjustedFood: adjustedFood,
      factor: 1.0,
      explanation: explanation,
      preparation: preparation
    };
  }
}

function getFoodType(food) {
  const protein = food.protein || 0;
  const carbs = food.carbs || 0;
  const fat = food.fat || 0;
  
  const totalMacros = protein * 4 + carbs * 4 + fat * 9;
  if (totalMacros === 0) return 'mixed';
  
  const proteinPercent = (protein * 4 / totalMacros) * 100;
  const carbPercent = (carbs * 4 / totalMacros) * 100;
  const fatPercent = (fat * 9 / totalMacros) * 100;
  
  if (proteinPercent >= 40) return 'protein';
  if (carbPercent >= 50) return 'carb';
  if (fatPercent >= 50) return 'fat';
  return 'mixed';
}

function getFoodTypeLabel(type) {
  const labels = {
    'protein': '<span class="macro-type protein-source">PROTEIN</span>',
    'carb': '<span class="macro-type carb-source">CARB</span>',
    'fat': '<span class="macro-type fat-source">FAT</span>',
    'mixed': '<span class="macro-type mixed-source">MIXED</span>'
  };
  return labels[type] || '';
}

function getPreparationBadge(preparation) {
  if (preparation === 'raw') return '';
  return `<span class="preparation-badge">${preparation.toUpperCase()}</span>`;
}

async function searchFood(type) {
  const input = document.getElementById(`${type}FoodInput`);
  const dropdown = document.getElementById(`${type}Dropdown`);
  const searchTerm = input.value.trim();

  if (searchTerm.length < 2) {
    dropdown.style.display = 'none';
    return;
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch('/api/usda-search-dropdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
      });

      const data = await response.json();
      
      if (data.foods && data.foods.length > 0) {
        displayFoodOptions(type, data.foods);
      } else {
        dropdown.innerHTML = '<div class="food-option" style="color: #ccc;">No foods found. Try different keywords.</div>';
        dropdown.style.display = 'block';
      }
    } catch (error) {
      console.error('Search error:', error);
      dropdown.innerHTML = '<div class="food-option" style="color: #e74c3c;">Error searching foods. Please try again.</div>';
      dropdown.style.display = 'block';
    }
  }, 300);
}

function displayFoodOptions(type, foods) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  
  const foodsHTML = foods.map(food => {
    const foodType = getFoodType(food);
    const typeLabel = getFoodTypeLabel(foodType);
    const preparation = detectPreparation(food.name);
    const prepBadge = getPreparationBadge(preparation);
    
    let displayName = food.name;
    if (displayName.length > 60) {
      displayName = displayName.substring(0, 60) + '...';
    }
    
    return `
      <div class="food-option" onclick="selectFood('${type}', ${JSON.stringify(food).replace(/"/g, '&quot;')})">
        <div class="food-name">${displayName} ${typeLabel} ${prepBadge}</div>
        <div class="food-macros">
          P: ${food.protein.toFixed(1)}g | C: ${food.carbs.toFixed(1)}g | F: ${food.fat.toFixed(1)}g | Cal: ${food.calories.toFixed(0)}
        </div>
        <div class="food-type">${food.dataType}</div>
      </div>
    `;
  }).join('');
  
  dropdown.innerHTML = foodsHTML;
  dropdown.style.display = 'block';
}

function selectFood(type, food) {
  selectedFoods[type] = food;
  document.getElementById(`${type}FoodInput`).value = food.name;
  document.getElementById(`${type}Dropdown`).style.display = 'none';
  
  // Show preparation info
  const prep = applyPreparationFactor(food, 100);
  const infoDiv = document.getElementById(`${type}PreparationInfo`);
  if (prep.explanation) {
    infoDiv.innerHTML = `🔧 ${prep.explanation}`;
    infoDiv.style.display = 'block';
  } else {
    infoDiv.style.display = 'none';
  }
}

// Hide dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.food-search-container')) {
    document.querySelectorAll('.food-dropdown').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }
});

function getMatchingStrategy() {
  const selected = document.querySelector('input[name="matchingStrategy"]:checked').value;
  
  if (selected === 'auto' && selectedFoods.original) {
    const foodType = getFoodType(selectedFoods.original);
    if (foodType === 'protein') return 'protein';
    if (foodType === 'carb') return 'carbs';
    if (foodType === 'fat') return 'fat';
    return 'protein'; // default fallback
  }
  
  return selected;
}

async function swapMacros() {
  const originalQty = parseFloat(document.getElementById('originalQty').value) || 100;
  
  if (!selectedFoods.original || !selectedFoods.replacement) {
    document.getElementById("replacementQty").innerText = "Please select both foods from the dropdown options.";
    return;
  }

  const strategy = getMatchingStrategy();
  const originalFood = selectedFoods.original;
  const replacementFood = selectedFoods.replacement;
  
  document.getElementById("replacementQty").innerText = `🔍 Calculating ${strategy} match with preparation adjustments...`;
  document.getElementById("macroTable").style.display = "none";

  // Apply preparation factors
  const originalPrep = applyPreparationFactor(originalFood, originalQty);
  const replacementPrep = applyPreparationFactor(replacementFood, 100);

  // Calculate original macros using adjusted values
  const originalMacros = {
    protein: (originalPrep.adjustedFood.protein * originalPrep.adjustedQuantity) / 100,
    carbs: (originalPrep.adjustedFood.carbs * originalPrep.adjustedQuantity) / 100,
    fat: (originalPrep.adjustedFood.fat * originalPrep.adjustedQuantity) / 100,
    calories: (originalPrep.adjustedFood.calories * originalPrep.adjustedQuantity) / 100
  };
  
  // Calculate equivalent quantity based on selected strategy
  let equivalentQty = 100;
  let matchedMacro = '';
  
  switch (strategy) {
    case 'protein':
      if (replacementPrep.adjustedFood.protein > 0) {
        equivalentQty = (originalMacros.protein / replacementPrep.adjustedFood.protein) * 100;
        matchedMacro = `${originalMacros.protein.toFixed(1)}g protein`;
      }
      break;
    case 'carbs':
      if (replacementPrep.adjustedFood.carbs > 0) {
        equivalentQty = (originalMacros.carbs / replacementPrep.adjustedFood.carbs) * 100;
        matchedMacro = `${originalMacros.carbs.toFixed(1)}g carbs`;
      }
      break;
    case 'fat':
      if (replacementPrep.adjustedFood.fat > 0) {
        equivalentQty = (originalMacros.fat / replacementPrep.adjustedFood.fat) * 100;
        matchedMacro = `${originalMacros.fat.toFixed(1)}g fat`;
      }
      break;
    case 'calories':
      if (replacementPrep.adjustedFood.calories > 0) {
        equivalentQty = (originalMacros.calories / replacementPrep.adjustedFood.calories) * 100;
        matchedMacro = `${originalMacros.calories.toFixed(0)} calories`;
      }
      break;
  }
  
  // Apply preparation factor to replacement quantity if needed
  const finalReplacementPrep = applyPreparationFactor(replacementFood, equivalentQty);
  
  // Calculate replacement macros
  const replacementMacros = {
    protein: (finalReplacementPrep.adjustedFood.protein * finalReplacementPrep.adjustedQuantity) / 100,
    carbs: (finalReplacementPrep.adjustedFood.carbs * finalReplacementPrep.adjustedQuantity) / 100,
    fat: (finalReplacementPrep.adjustedFood.fat * finalReplacementPrep.adjustedQuantity) / 100,
    calories: (finalReplacementPrep.adjustedFood.calories * finalReplacementPrep.adjustedQuantity) / 100
  };
  
  // Display results with preparation info
  let resultHTML = `<strong>Replacement Quantity:</strong> ${equivalentQty.toFixed(0)}g of ${replacementFood.name}<br>`;
  resultHTML += `<small style="color: #4da6d9; font-weight: bold;">✅ Matched by ${strategy}: ${matchedMacro}</small><br>`;
  
  if (originalPrep.explanation) {
    resultHTML += `<small style="color: #ffa500;">Original: ${originalPrep.explanation}</small><br>`;
  }
  if (finalReplacementPrep.explanation && finalReplacementPrep.explanation !== originalPrep.explanation) {
    resultHTML += `<small style="color: #ffa500;">Replacement: ${finalReplacementPrep.explanation}</small>`;
  }
  
  document.getElementById("replacementQty").innerHTML = resultHTML;
  
  // Create comparison table with highlighting
  const tableHTML = `
    <tr>
      <td style='padding: 10px; border: 1px solid #333;'>${originalFood.name}</td>
      <td style='padding: 10px; border: 1px solid #333;'>${originalQty.toFixed(0)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'protein' ? 'background: #e74c3c; color: white;' : ''}'>${originalMacros.protein.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'carbs' ? 'background: #f39c12; color: white;' : ''}'>${originalMacros.carbs.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'fat' ? 'background: #9b59b6; color: white;' : ''}'>${originalMacros.fat.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'calories' ? 'background: #2ecc71; color: white;' : ''}'>${originalMacros.calories.toFixed(0)}</td>
    </tr>
    <tr>
      <td style='padding: 10px; border: 1px solid #333;'>${replacementFood.name}</td>
      <td style='padding: 10px; border: 1px solid #333;'>${equivalentQty.toFixed(0)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'protein' ? 'background: #e74c3c; color: white;' : ''}'>${replacementMacros.protein.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'carbs' ? 'background: #f39c12; color: white;' : ''}'>${replacementMacros.carbs.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'fat' ? 'background: #9b59b6; color: white;' : ''}'>${replacementMacros.fat.toFixed(1)}g</td>
      <td style='padding: 10px; border: 1px solid #333; ${strategy === 'calories' ? 'background: #2ecc71; color: white;' : ''}'>${replacementMacros.calories.toFixed(0)}</td>
    </tr>
  `;
  
  document.getElementById("macroTableBody").innerHTML = tableHTML;
  document.getElementById("macroTable").style.display = "block";
}
</script>
