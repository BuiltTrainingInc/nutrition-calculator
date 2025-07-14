<script>
let selectedFoods = {
  original: null,
  replacement: null
};

let searchTimeout;

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

async function searchFood(type) {
  const input = document.getElementById(`${type}FoodInput`);
  const dropdown = document.getElementById(`${type}Dropdown`);
  const searchTerm = input.value.trim();

  console.log('Searching for:', searchTerm); // Debug log

  if (searchTerm.length < 2) {
    dropdown.style.display = 'none';
    return;
  }

  // Show loading
  dropdown.innerHTML = '<div class="food-option" style="color: #4da6d9;">🔍 Searching...</div>';
  dropdown.style.display = 'block';

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      console.log('Making API call...'); // Debug log
      
      const response = await fetch('/api/usda-search-dropdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
      });

      console.log('API response status:', response.status); // Debug log

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API response data:', data); // Debug log
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.foods && data.foods.length > 0) {
        displayFoodOptions(type, data.foods);
      } else {
        dropdown.innerHTML = '<div class="food-option" style="color: #ccc;">No foods found. Try different keywords like "chicken" or "rice".</div>';
        dropdown.style.display = 'block';
      }
    } catch (error) {
      console.error('Search error:', error);
      dropdown.innerHTML = `<div class="food-option" style="color: #e74c3c;">Error: ${error.message}<br><small>Check console (F12) for details</small></div>`;
      dropdown.style.display = 'block';
    }
  }, 500); // Increased timeout to 500ms
}

function displayFoodOptions(type, foods) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  
  console.log('Displaying foods:', foods.length); // Debug log
  
  const foodsHTML = foods.map(food => {
    const foodType = getFoodType(food);
    const typeLabel = getFoodTypeLabel(foodType);
    
    let displayName = food.name;
    if (displayName.length > 60) {
      displayName = displayName.substring(0, 60) + '...';
    }
    
    return `
      <div class="food-option" onclick="selectFood('${type}', ${JSON.stringify(food).replace(/"/g, '&quot;')})">
        <div class="food-name">${displayName} ${typeLabel}</div>
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
  console.log('Selected food:', food); // Debug log
  selectedFoods[type] = food;
  document.getElementById(`${type}FoodInput`).value = food.name;
  document.getElementById(`${type}Dropdown`).style.display = 'none';
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
    return 'protein';
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
  
  console.log('Calculating swap:', { originalFood, replacementFood, strategy }); // Debug log
  
  document.getElementById("replacementQty").innerText = `🔍 Calculating ${strategy} match...`;
  document.getElementById("macroTable").style.display = "none";

  // Calculate original macros
  const originalMacros = {
    protein: (originalFood.protein * originalQty) / 100,
    carbs: (originalFood.carbs * originalQty) / 100,
    fat: (originalFood.fat * originalQty) / 100,
    calories: (originalFood.calories * originalQty) / 100
  };
  
  // Calculate equivalent quantity based on strategy
  let equivalentQty = 100;
  let matchedMacro = '';
  
  switch (strategy) {
    case 'protein':
      if (replacementFood.protein > 0) {
        equivalentQty = (originalMacros.protein / replacementFood.protein) * 100;
        matchedMacro = `${originalMacros.protein.toFixed(1)}g protein`;
      }
      break;
    case 'carbs':
      if (replacementFood.carbs > 0) {
        equivalentQty = (originalMacros.carbs / replacementFood.carbs) * 100;
        matchedMacro = `${originalMacros.carbs.toFixed(1)}g carbs`;
      }
      break;
    case 'fat':
      if (replacementFood.fat > 0) {
        equivalentQty = (originalMacros.fat / replacementFood.fat) * 100;
        matchedMacro = `${originalMacros.fat.toFixed(1)}g fat`;
      }
      break;
    case 'calories':
      if (replacementFood.calories > 0) {
        equivalentQty = (originalMacros.calories / replacementFood.calories) * 100;
        matchedMacro = `${originalMacros.calories.toFixed(0)} calories`;
      }
      break;
  }
  
  // Calculate replacement macros
  const replacementMacros = {
    protein: (replacementFood.protein * equivalentQty) / 100,
    carbs: (replacementFood.carbs * equivalentQty) / 100,
    fat: (replacementFood.fat * equivalentQty) / 100,
    calories: (replacementFood.calories * equivalentQty) / 100
  };
  
  // Display results
  document.getElementById("replacementQty").innerHTML = 
    `<strong>Replacement Quantity:</strong> ${equivalentQty.toFixed(0)}g of ${replacementFood.name}<br>
    <small style="color: #4da6d9; font-weight: bold;">✅ Matched by ${strategy}: ${matchedMacro}</small>`;
  
  // Create comparison table
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
