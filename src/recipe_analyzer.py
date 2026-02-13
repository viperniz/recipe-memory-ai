"""
Recipe Analyzer Module
Uses LLM (OpenAI or Ollama) to extract structured recipe data from video content
"""

import json
import os
from typing import List, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Recipe:
    """Structured recipe data"""
    id: str
    name: str
    description: str
    cuisine: str
    difficulty: str  # easy, medium, hard
    prep_time_minutes: int
    cook_time_minutes: int
    servings: int
    ingredients: List[dict]  # [{name, quantity, unit, notes}]
    instructions: List[dict]  # [{step, description, timestamp, tips}]
    tips: List[str]
    tags: List[str]
    source_url: Optional[str] = None
    source_video: Optional[str] = None
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)


EXTRACTION_PROMPT = """You are a culinary AI assistant that extracts structured recipe information from cooking video transcripts and visual descriptions.

Given the following transcript and frame descriptions from a cooking video, extract the complete recipe information.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Extract and return a JSON object with this EXACT structure:
{{
    "name": "Recipe name",
    "description": "Brief 1-2 sentence description",
    "cuisine": "Type of cuisine (Italian, Mexican, etc.)",
    "difficulty": "easy|medium|hard",
    "prep_time_minutes": number,
    "cook_time_minutes": number,
    "servings": number,
    "ingredients": [
        {{"name": "ingredient", "quantity": "amount", "unit": "unit", "notes": "optional prep notes"}}
    ],
    "instructions": [
        {{"step": 1, "description": "Step description", "timestamp": "MM:SS if known", "tips": "optional tips"}}
    ],
    "tips": ["Any cooking tips mentioned"],
    "tags": ["relevant", "tags", "for", "searching"]
}}

Be thorough - extract ALL ingredients and steps mentioned. If quantities aren't specified, make reasonable estimates based on context.
Return ONLY the JSON object, no other text."""


class RecipeAnalyzer:
    def __init__(self, provider: str = "openai", model: str = None):
        """
        Initialize the recipe analyzer

        Args:
            provider: "openai" or "ollama"
            model: Model name (default: gpt-4o-mini for openai, llama3.1 for ollama)
        """
        self.provider = provider

        if provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()  # Uses OPENAI_API_KEY env var
            self.model = model or "gpt-4o-mini"
        elif provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def analyze_frames(self, frames: List[Tuple[float, str]]) -> List[str]:
        """
        Analyze video frames using vision model
        Returns descriptions of what's happening in each frame
        """
        descriptions = []

        for timestamp, base64_image in frames:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",  # Vision-capable model
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"This is a frame from a cooking video at {timestamp:.0f} seconds. "
                                           "Briefly describe what cooking action, ingredients, or technique is shown. "
                                           "Focus on: ingredients visible, cooking technique, equipment used, state of the dish."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}",
                                        "detail": "low"  # Faster/cheaper
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=150
                )
                description = response.choices[0].message.content
            else:
                # Ollama with vision model (llava)
                response = self.client.chat(
                    model="llava",
                    messages=[
                        {
                            "role": "user",
                            "content": f"This is a frame from a cooking video at {timestamp:.0f} seconds. "
                                       "Briefly describe what cooking action, ingredients, or technique is shown.",
                            "images": [base64_image]
                        }
                    ]
                )
                description = response["message"]["content"]

            descriptions.append(f"[{timestamp:.0f}s] {description}")
            print(f"  Analyzed frame at {timestamp:.0f}s")

        return descriptions

    def extract_recipe(
        self,
        transcript: str,
        frame_descriptions: List[str] = None,
        video_path: str = None,
        source_url: str = None
    ) -> Recipe:
        """
        Extract structured recipe from transcript and frame descriptions
        """
        frame_text = "\n".join(frame_descriptions) if frame_descriptions else "No visual descriptions available."

        prompt = EXTRACTION_PROMPT.format(
            transcript=transcript,
            frame_descriptions=frame_text
        )

        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
        else:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format="json"
            )
            content = response["message"]["content"]

        # Parse JSON response
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Could not parse recipe JSON from response: {content[:500]}")

        # Generate unique ID
        recipe_id = f"recipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return Recipe(
            id=recipe_id,
            name=data.get("name", "Unknown Recipe"),
            description=data.get("description", ""),
            cuisine=data.get("cuisine", "Unknown"),
            difficulty=data.get("difficulty", "medium"),
            prep_time_minutes=data.get("prep_time_minutes", 0),
            cook_time_minutes=data.get("cook_time_minutes", 0),
            servings=data.get("servings", 4),
            ingredients=data.get("ingredients", []),
            instructions=data.get("instructions", []),
            tips=data.get("tips", []),
            tags=data.get("tags", []),
            source_url=source_url,
            source_video=video_path
        )


def analyze_video_for_recipe(
    transcript: str,
    frames: List[Tuple[float, str]] = None,
    provider: str = "openai",
    video_path: str = None,
    source_url: str = None
) -> Recipe:
    """Convenience function to analyze a video and extract recipe"""
    analyzer = RecipeAnalyzer(provider=provider)

    frame_descriptions = []
    if frames:
        print("Analyzing video frames...")
        frame_descriptions = analyzer.analyze_frames(frames)

    print("Extracting recipe from content...")
    recipe = analyzer.extract_recipe(
        transcript=transcript,
        frame_descriptions=frame_descriptions,
        video_path=video_path,
        source_url=source_url
    )

    return recipe


if __name__ == "__main__":
    # Test with sample data
    sample_transcript = """
    Today we're making a classic pasta carbonara.
    You'll need 400 grams of spaghetti, 200 grams of guanciale or pancetta,
    4 egg yolks, 100 grams of pecorino romano cheese, and black pepper.

    First, bring a large pot of salted water to boil.
    While waiting, cut the guanciale into small cubes.
    Cook the guanciale in a pan over medium heat until crispy.

    Mix the egg yolks with grated pecorino in a bowl.
    Add plenty of black pepper.

    Cook the pasta until al dente, reserve some pasta water.
    Add the hot pasta to the guanciale pan, remove from heat.
    Pour the egg mixture over and toss quickly.
    Add pasta water if needed for creaminess.
    Serve immediately with more pecorino and pepper.
    """

    try:
        analyzer = RecipeAnalyzer(provider="openai")
        recipe = analyzer.extract_recipe(sample_transcript)
        print(recipe.to_json())
    except Exception as e:
        print(f"Error (expected if no API key): {e}")
