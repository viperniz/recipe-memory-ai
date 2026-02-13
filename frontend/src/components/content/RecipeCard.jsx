import React, { useState } from 'react'
import { Clock, Users, ChefHat, Flame, Check, AlertCircle, Lightbulb, Refrigerator, Printer } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import TimestampLink from './TimestampLink'

function RecipeCard({ recipe, onPrint, sourceUrl }) {
  const [checkedIngredients, setCheckedIngredients] = useState(new Set())
  const [checkedSteps, setCheckedSteps] = useState(new Set())

  if (!recipe) return null

  const toggleIngredient = (idx) => {
    const newChecked = new Set(checkedIngredients)
    if (newChecked.has(idx)) {
      newChecked.delete(idx)
    } else {
      newChecked.add(idx)
    }
    setCheckedIngredients(newChecked)
  }

  const toggleStep = (idx) => {
    const newChecked = new Set(checkedSteps)
    if (newChecked.has(idx)) {
      newChecked.delete(idx)
    } else {
      newChecked.add(idx)
    }
    setCheckedSteps(newChecked)
  }

  // Group ingredients by group field if present
  const groupedIngredients = (recipe.ingredients || []).reduce((acc, ing, idx) => {
    const group = ing.group || 'Main'
    if (!acc[group]) acc[group] = []
    acc[group].push({ ...ing, originalIdx: idx })
    return acc
  }, {})

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    hard: 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  return (
    <div className="recipe-card">
      {/* Header */}
      <div className="recipe-header">
        <div className="recipe-header-content">
          <h1 className="recipe-title">{recipe.title}</h1>
          {recipe.description && (
            <p className="recipe-description">{recipe.description}</p>
          )}

          <div className="recipe-meta">
            {recipe.prep_time && (
              <div className="recipe-meta-item">
                <Clock className="w-4 h-4" />
                <span>Prep: {recipe.prep_time}</span>
              </div>
            )}
            {recipe.cook_time && (
              <div className="recipe-meta-item">
                <Flame className="w-4 h-4" />
                <span>Cook: {recipe.cook_time}</span>
              </div>
            )}
            {recipe.servings && (
              <div className="recipe-meta-item">
                <Users className="w-4 h-4" />
                <span>{recipe.servings}</span>
              </div>
            )}
            {recipe.difficulty && (
              <Badge className={difficultyColors[recipe.difficulty] || difficultyColors.medium}>
                {recipe.difficulty}
              </Badge>
            )}
          </div>

          {/* Diet tags */}
          {recipe.diet_tags && recipe.diet_tags.length > 0 && (
            <div className="recipe-diet-tags">
              {recipe.diet_tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="recipe-diet-tag">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {onPrint && (
          <Button variant="outline" size="sm" onClick={onPrint} className="recipe-print-btn">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        )}
      </div>

      {/* Chef info */}
      {recipe.chef_name && recipe.chef_name !== 'Unknown' && (
        <div className="recipe-chef">
          <ChefHat className="w-4 h-4" />
          <span>By {recipe.chef_name}</span>
        </div>
      )}

      {/* Equipment */}
      {recipe.equipment && recipe.equipment.length > 0 && (
        <div className="recipe-section">
          <h3 className="recipe-section-title">Equipment Needed</h3>
          <div className="recipe-equipment">
            {recipe.equipment.map((item, idx) => (
              <span key={idx} className="recipe-equipment-item">{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="recipe-section">
        <h3 className="recipe-section-title">Ingredients</h3>
        {Object.entries(groupedIngredients).map(([group, ingredients]) => (
          <div key={group} className="recipe-ingredient-group">
            {Object.keys(groupedIngredients).length > 1 && (
              <h4 className="recipe-ingredient-group-title">{group}</h4>
            )}
            <ul className="recipe-ingredients">
              {ingredients.map((ing) => (
                <li
                  key={ing.originalIdx}
                  className={`recipe-ingredient ${checkedIngredients.has(ing.originalIdx) ? 'checked' : ''}`}
                  onClick={() => toggleIngredient(ing.originalIdx)}
                >
                  <span className="recipe-ingredient-checkbox">
                    {checkedIngredients.has(ing.originalIdx) ? (
                      <Check className="w-3 h-3" />
                    ) : null}
                  </span>
                  <span className="recipe-ingredient-text">
                    {ing.amount && <strong>{ing.amount} </strong>}
                    {ing.unit && <strong>{ing.unit} </strong>}
                    {ing.item}
                    {ing.preparation && <span className="recipe-ingredient-prep">, {ing.preparation}</span>}
                    {ing.optional && <span className="recipe-ingredient-optional"> (optional)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="recipe-section">
        <h3 className="recipe-section-title">Instructions</h3>
        <ol className="recipe-steps">
          {(recipe.steps || []).map((step, idx) => (
            <li
              key={idx}
              className={`recipe-step ${checkedSteps.has(idx) ? 'checked' : ''}`}
              onClick={() => toggleStep(idx)}
            >
              <div className="recipe-step-header">
                <span className="recipe-step-number">{step.number || idx + 1}</span>
                {step.timestamp && (
                  <TimestampLink timestamp={step.timestamp} sourceUrl={sourceUrl} />
                )}
                {step.duration && (
                  <span className="recipe-step-duration">{step.duration}</span>
                )}
              </div>
              <div className="recipe-step-content">
                <p className="recipe-step-instruction">{step.instruction}</p>
                {step.temperature && (
                  <div className="recipe-step-temp">
                    <Flame className="w-3 h-3" />
                    {step.temperature}
                  </div>
                )}
                {step.tip && (
                  <div className="recipe-step-tip">
                    <Lightbulb className="w-3 h-3" />
                    {step.tip}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Tips */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div className="recipe-section">
          <h3 className="recipe-section-title">
            <Lightbulb className="w-4 h-4 inline mr-2" />
            Chef's Tips
          </h3>
          <ul className="recipe-tips">
            {recipe.tips.map((tip, idx) => (
              <li key={idx} className="recipe-tip">
                {typeof tip === 'object' ? tip.tip : tip}
                {typeof tip === 'object' && tip.timestamp && (
                  <> <TimestampLink timestamp={tip.timestamp} sourceUrl={sourceUrl} /></>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Substitutions */}
      {recipe.substitutions && recipe.substitutions.length > 0 && (
        <div className="recipe-section">
          <h3 className="recipe-section-title">Substitutions</h3>
          <div className="recipe-substitutions">
            {recipe.substitutions.map((sub, idx) => (
              <div key={idx} className="recipe-substitution">
                <span className="recipe-sub-original">{sub.original}</span>
                <span className="recipe-sub-arrow">→</span>
                <span className="recipe-sub-substitute">{sub.substitute}</span>
                {sub.notes && <span className="recipe-sub-notes">{sub.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage */}
      {recipe.storage && (
        <div className="recipe-section">
          <h3 className="recipe-section-title">
            <Refrigerator className="w-4 h-4 inline mr-2" />
            Storage
          </h3>
          <div className="recipe-storage">
            {recipe.storage.refrigerator && (
              <div className="recipe-storage-item">
                <strong>Refrigerator:</strong> {recipe.storage.refrigerator}
              </div>
            )}
            {recipe.storage.freezer && (
              <div className="recipe-storage-item">
                <strong>Freezer:</strong> {recipe.storage.freezer}
              </div>
            )}
            {recipe.storage.reheating && (
              <div className="recipe-storage-item">
                <strong>Reheating:</strong> {recipe.storage.reheating}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nutrition */}
      {recipe.nutrition && (
        <div className="recipe-section">
          <h3 className="recipe-section-title">Nutrition (per serving)</h3>
          <div className="recipe-nutrition">
            {recipe.nutrition.calories && (
              <div className="recipe-nutrition-item">
                <span className="recipe-nutrition-value">{recipe.nutrition.calories}</span>
                <span className="recipe-nutrition-label">Calories</span>
              </div>
            )}
            {recipe.nutrition.protein && (
              <div className="recipe-nutrition-item">
                <span className="recipe-nutrition-value">{recipe.nutrition.protein}</span>
                <span className="recipe-nutrition-label">Protein</span>
              </div>
            )}
            {recipe.nutrition.carbs && (
              <div className="recipe-nutrition-item">
                <span className="recipe-nutrition-value">{recipe.nutrition.carbs}</span>
                <span className="recipe-nutrition-label">Carbs</span>
              </div>
            )}
            {recipe.nutrition.fat && (
              <div className="recipe-nutrition-item">
                <span className="recipe-nutrition-value">{recipe.nutrition.fat}</span>
                <span className="recipe-nutrition-label">Fat</span>
              </div>
            )}
          </div>
          {recipe.nutrition.note && (
            <p className="recipe-nutrition-note">{recipe.nutrition.note}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default RecipeCard
