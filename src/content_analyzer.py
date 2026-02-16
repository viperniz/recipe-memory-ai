"""
Content Analyzer Module
Uses LLM (OpenAI or Ollama) to extract structured information from video content
"""

import json
import os
from typing import List, Tuple, Optional
from dataclasses import dataclass, asdict, field
from datetime import datetime


@dataclass
class ContentExtract:
    """Structured content extraction from video"""
    id: str
    title: str
    summary: str
    content_type: str  # tutorial, lecture, interview, how-to, review, etc.
    mode: str = "general"  # general, recipe, learn, creator, meeting
    speaker: str = ""  # main speaker/presenter name
    topics: List[str] = field(default_factory=list)
    key_points: List[dict] = field(default_factory=list)  # [{point, timestamp, details}]
    entities: List[dict] = field(default_factory=list)  # [{name, type, description}] - people, products, concepts
    action_items: List[str] = field(default_factory=list)  # actionable takeaways
    quotes: List[dict] = field(default_factory=list)  # [{text, speaker, timestamp}]
    resources: List[dict] = field(default_factory=list)  # [{name, url, description}] - mentioned links, tools, etc.
    tags: List[str] = field(default_factory=list)
    transcript: str = ""  # full transcript (formatted with timestamps)
    frame_descriptions: List[str] = field(default_factory=list)  # visual analysis of frames
    frame_analyses: Optional[List[dict]] = None  # [{timestamp, caption, description}] - new format with captions
    timeline: Optional[list] = None  # unified chronological view of transcript + vision
    duration_seconds: Optional[int] = None
    source_url: Optional[str] = None
    source_video: Optional[str] = None
    created_at: str = None
    metadata: dict = field(default_factory=dict)
    # Mode-specific fields (only populated in respective modes)
    recipe: Optional[dict] = None  # Full recipe data for recipe mode
    learn: Optional[dict] = None   # Learning content for learn mode
    creator: Optional[dict] = None # Creator content for creator mode
    meeting: Optional[dict] = None # Meeting minutes for meeting mode
    deepdive: Optional[dict] = None # Deep dive analysis data

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)


# =============================================
# Mode-specific extraction prompts
# =============================================

EXTRACTION_MODES = ["general", "recipe", "learn", "creator", "meeting", "deepdive"]

# =============================================
# Mode Auto-Detection Prompt
# =============================================
MODE_DETECTION_PROMPT = """Analyze this video transcript and determine what type of content it is.

TRANSCRIPT (first 2000 characters):
{transcript_preview}

Based on the content, classify this video into ONE of these categories:

- "recipe" - Cooking videos, food preparation, recipes with ingredients and steps
- "learn" - Educational content, tutorials, lectures, courses, explanations of concepts
- "creator" - Podcasts, interviews, vlogs, entertainment, content meant to be repurposed
- "meeting" - Business meetings, team discussions, webinars with action items
- "general" - Anything that doesn't clearly fit the above categories

CLASSIFICATION RULES:
1. If the video mentions ingredients, cooking steps, temperatures, or food preparation → "recipe"
2. If the video teaches concepts, has a clear educational structure, explains how things work → "learn"
3. If the video is a conversation, interview, podcast, or entertainment content → "creator"
4. If the video discusses tasks, decisions, deadlines, team updates → "meeting"
5. If unclear or mixed content → "general"

Return ONLY a JSON object:
{{"mode": "recipe|learn|creator|meeting|general", "confidence": 0.0-1.0, "reason": "brief explanation"}}"""


EXTRACTION_PROMPT = """You are an AI assistant that extracts structured information from video transcripts and visual descriptions.

Given the following transcript and frame descriptions from a video, extract comprehensive information about the content.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Extract and return a JSON object with this EXACT structure:
{{
    "title": "A clear, descriptive title for this content",
    "summary": "2-3 sentence summary of the main content and purpose",
    "content_type": "tutorial|lecture|interview|how-to|review|presentation|vlog|other",
    "speaker": "Name of the main speaker/presenter if identifiable from context, or 'Unknown' if truly unclear",
    "topics": ["main topic 1", "main topic 2", ...],
    "key_points": [
        {{"point": "Main point or insight", "timestamp": "MM:SS if known", "details": "Additional context"}}
    ],
    "entities": [
        {{"name": "Person/Product/Tool/Concept name", "type": "person|product|tool|company|concept", "description": "Brief description"}}
    ],
    "action_items": ["Actionable takeaway 1", "Actionable takeaway 2", ...],
    "quotes": [
        {{"text": "Notable quote", "speaker": "Use the main speaker name identified above, or specific name if different speaker", "timestamp": "MM:SS if known"}}
    ],
    "resources": [
        {{"name": "Resource name", "url": "URL if mentioned", "description": "What it's for"}}
    ],
    "tags": ["relevant", "searchable", "tags"]
}}

SPEAKER IDENTIFICATION:
- Look for self-introductions ("Hi, I'm [name]", "My name is [name]")
- Check if they mention their channel/brand name
- Look for names in the visual descriptions (text overlays, titles)
- If it's clearly one person talking throughout, attribute all quotes to them
- Only use "Unknown" if you truly cannot determine who is speaking

Be thorough - extract ALL key points, entities, and actionable information mentioned.
Return ONLY the JSON object, no other text."""


# =============================================
# RECIPE MODE - Extract structured recipe data
# =============================================
RECIPE_EXTRACTION_PROMPT = """You are a culinary expert extracting a complete, cookable recipe from a cooking video.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Extract a complete recipe with ALL details needed to cook this dish. Be thorough and precise.

Return a JSON object with this EXACT structure:
{{
    "title": "Recipe name (e.g., 'Creamy Garlic Tuscan Chicken')",
    "description": "Brief 1-2 sentence description of the dish",
    "prep_time": "Prep time in minutes (e.g., '15 minutes')",
    "cook_time": "Cook time in minutes (e.g., '30 minutes')",
    "total_time": "Total time (e.g., '45 minutes')",
    "servings": "Number of servings (e.g., '4 servings')",
    "difficulty": "easy|medium|hard",
    "cuisine": "Cuisine type (e.g., 'Italian', 'Mexican', 'American')",
    "diet_tags": ["vegetarian", "gluten-free", "keto", "dairy-free", "vegan", "low-carb"],
    "ingredients": [
        {{
            "item": "all-purpose flour",
            "amount": "2",
            "unit": "cups",
            "preparation": "sifted",
            "optional": false,
            "group": "For the sauce"
        }}
    ],
    "equipment": ["Large skillet", "Meat thermometer", "Cutting board"],
    "steps": [
        {{
            "number": 1,
            "instruction": "Preheat oven to 375°F (190°C)",
            "timestamp": "0:45",
            "duration": "10 minutes",
            "temperature": "375°F / 190°C",
            "tip": "Use convection if available"
        }}
    ],
    "tips": [
        {{
            "tip": "You can substitute Greek yogurt for cream for a lighter version",
            "timestamp": "12:30"
        }}
    ],
    "substitutions": [
        {{
            "original": "heavy cream",
            "substitute": "Greek yogurt or coconut cream",
            "notes": "For dairy-free version"
        }}
    ],
    "storage": {{
        "refrigerator": "3-4 days in airtight container",
        "freezer": "Up to 3 months",
        "reheating": "Reheat in skillet with splash of cream"
    }},
    "nutrition": {{
        "calories": "450",
        "protein": "35g",
        "carbs": "12g",
        "fat": "28g",
        "note": "Per serving, estimated"
    }},
    "chef_name": "Name of the chef/presenter if mentioned",
    "source_notes": "Any special notes about the recipe source"
}}

IMPORTANT RULES:
1. Extract EXACT measurements - convert vague terms ("some", "a bit") to estimated amounts
2. Include ALL ingredients, even garnishes and optional items
3. Note timestamps for each step so users can jump to that part of the video
4. Include temperatures in both Fahrenheit and Celsius
5. Capture ALL tips, tricks, and warnings mentioned
6. If the chef mentions substitutions, include them
7. Group ingredients if the recipe has multiple components (e.g., "For the sauce", "For the marinade")
8. If nutrition info isn't mentioned, estimate based on ingredients or omit
9. Mark optional ingredients clearly

Return ONLY the JSON object, no other text."""


# =============================================
# LEARN MODE - Extract educational content
# =============================================
LEARN_EXTRACTION_PROMPT = """You are an expert educator creating comprehensive study materials from an educational video.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Extract structured learning content to help someone study and retain this material.

Return a JSON object with this EXACT structure:
{{
    "title": "Course/Lecture title",
    "subject": "Main subject area (e.g., Computer Science, Biology, History)",
    "instructor": "Instructor name if mentioned",
    "difficulty_level": "beginner|intermediate|advanced",
    "duration_minutes": 0,
    "learning_objectives": [
        "What the student will learn #1",
        "What the student will learn #2"
    ],
    "prerequisites": ["Prior knowledge needed"],
    "chapter_markers": [
        {{
            "timestamp": "0:00",
            "title": "Introduction",
            "summary": "Brief summary of this section"
        }}
    ],
    "key_concepts": [
        {{
            "concept": "Concept name",
            "definition": "Clear, concise definition",
            "timestamp": "5:23",
            "importance": "critical|important|supplementary",
            "example": "Concrete example if provided",
            "related_concepts": ["Related concept 1"]
        }}
    ],
    "definitions": [
        {{
            "term": "Technical term",
            "definition": "What it means",
            "timestamp": "MM:SS"
        }}
    ],
    "examples": [
        {{
            "description": "What the example demonstrates",
            "timestamp": "12:30",
            "code_or_formula": "Any code or formula shown (if applicable)"
        }}
    ],
    "flashcards": [
        {{
            "front": "Question or term",
            "back": "Answer or definition",
            "difficulty": "easy|medium|hard"
        }}
    ],
    "practice_questions": [
        {{
            "question": "Test question",
            "answer": "Expected answer",
            "timestamp": "Reference timestamp if applicable"
        }}
    ],
    "key_takeaways": ["Main point 1", "Main point 2"],
    "resources": [
        {{
            "name": "Resource name",
            "url": "URL if mentioned",
            "description": "What it's for"
        }}
    ],
    "summary": "2-3 paragraph comprehensive summary of the content"
}}

RULES:
1. Generate 10-20 flashcards covering all important concepts
2. Create 3-5 practice questions to test understanding
3. Include timestamps for all major concepts so students can review
4. Define ALL technical terms mentioned
5. Identify the difficulty level based on assumed prior knowledge
6. Break content into logical chapter markers for navigation

Return ONLY the JSON object, no other text."""


# =============================================
# CREATOR MODE - Extract content for repurposing
# =============================================
CREATOR_EXTRACTION_PROMPT = """You are a content strategist helping creators repurpose video content for maximum reach across platforms.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

{youtube_stats}

Extract content that can be repurposed into social media posts, clips, and written content. If YouTube statistics are provided, use them to inform your analysis of what's working (high engagement = good hooks, viral potential, etc.).

Return a JSON object with this EXACT structure:
{{
    "title": "Original content title",
    "content_type": "podcast|interview|vlog|presentation|other",
    "host": "Host/creator name",
    "guests": ["Guest name 1", "Guest name 2"],
    "duration_minutes": 0,
    "hook": "Attention-grabbing opening line (first 3 seconds)",
    "one_liner": "Single sentence summary of the entire content",
    "elevator_pitch": "30-second description of what this content is about",
    "viral_moments": [
        {{
            "timestamp_start": "12:34",
            "timestamp_end": "13:45",
            "duration_seconds": 71,
            "hook": "The moment that grabs attention",
            "description": "What happens in this clip",
            "emotion": "surprise|inspiration|humor|outrage|curiosity",
            "clip_title": "Suggested title for this clip",
            "platforms": ["tiktok", "youtube_shorts", "instagram_reels", "twitter"]
        }}
    ],
    "quotable_quotes": [
        {{
            "quote": "The exact quote",
            "speaker": "Who said it",
            "timestamp": "MM:SS",
            "context": "Brief context",
            "tweet_ready": "Quote formatted for Twitter with emoji"
        }}
    ],
    "key_points": [
        {{
            "point": "Main insight or takeaway",
            "timestamp": "MM:SS",
            "tweetable": "This point as a tweet"
        }}
    ],
    "controversial_takes": [
        {{
            "take": "The controversial opinion",
            "speaker": "Who said it",
            "timestamp": "MM:SS",
            "engagement_potential": "high|medium|low"
        }}
    ],
    "stories": [
        {{
            "title": "Story title",
            "timestamp_start": "MM:SS",
            "timestamp_end": "MM:SS",
            "summary": "What the story is about",
            "lesson": "Key lesson from the story"
        }}
    ],
    "statistics": [
        {{
            "stat": "The statistic or data point",
            "context": "What it means",
            "timestamp": "MM:SS"
        }}
    ],
    "tweet_thread": [
        "Tweet 1: Hook that grabs attention",
        "Tweet 2: First key point",
        "Tweet 3: Supporting detail or example",
        "Tweet 4: Another key point",
        "Tweet 5: Call to action or conclusion"
    ],
    "linkedin_post": "Full LinkedIn post with formatting (use line breaks)",
    "blog_outline": {{
        "title": "Blog post title",
        "meta_description": "SEO meta description",
        "sections": [
            {{
                "heading": "H2 heading",
                "key_points": ["Point to cover"],
                "timestamp_reference": "MM:SS"
            }}
        ]
    }},
    "youtube_shorts_ideas": [
        {{
            "title": "Short title",
            "hook": "Opening hook",
            "timestamp": "Source timestamp"
        }}
    ],
    "hashtags": ["relevant", "hashtags", "for", "reach"],
    "call_to_action": "Suggested CTA for the content"
}}

RULES:
1. Identify 3-5 viral clip opportunities (60-90 seconds each)
2. Extract 5-10 quotable quotes that work standalone
3. Create a complete Twitter thread (8-12 tweets)
4. Write a LinkedIn post that's professional but engaging
5. Focus on moments that trigger emotion: surprise, inspiration, humor, or curiosity
6. For viral clips, the hook must work in the first 3 seconds

Return ONLY the JSON object, no other text."""


# =============================================
# MEETING MODE - Extract meeting minutes
# =============================================
MEETING_EXTRACTION_PROMPT = """You are an executive assistant creating actionable meeting minutes. Your goal: Someone who missed this meeting should know EXACTLY what happened, what was decided, and what they need to do.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Extract comprehensive meeting minutes with all actionable information.

Return a JSON object with this EXACT structure:
{{
    "title": "Meeting title/topic",
    "meeting_type": "standup|planning|review|brainstorm|training|all-hands|one-on-one|other",
    "date": "Meeting date if mentioned",
    "duration_minutes": 0,
    "tldr": "2-3 sentence summary a busy executive can read in 10 seconds",
    "attendees": [
        {{
            "name": "Person name",
            "role": "Their role if mentioned",
            "speaking_time": "approximate"
        }}
    ],
    "agenda": [
        {{
            "topic": "Agenda item",
            "timestamp_start": "MM:SS",
            "timestamp_end": "MM:SS",
            "presenter": "Who led this section"
        }}
    ],
    "decisions": [
        {{
            "decision": "What was decided",
            "made_by": "Who made/approved it",
            "timestamp": "MM:SS",
            "reasoning": "Why this decision was made",
            "alternatives_considered": ["Option A", "Option B"],
            "impact": "What this decision affects"
        }}
    ],
    "action_items": [
        {{
            "task": "Clear, specific task description",
            "owner": "Person responsible (or 'TBD' if unclear)",
            "deadline": "Due date if mentioned (or 'TBD')",
            "priority": "high|medium|low",
            "timestamp": "MM:SS",
            "context": "Additional context about the task",
            "dependencies": ["What this depends on"]
        }}
    ],
    "key_discussions": [
        {{
            "topic": "Discussion topic",
            "timestamp_start": "MM:SS",
            "timestamp_end": "MM:SS",
            "summary": "What was discussed",
            "participants": ["Who participated"],
            "outcome": "What was concluded"
        }}
    ],
    "blockers": [
        {{
            "issue": "The blocker or risk",
            "raised_by": "Who raised it",
            "timestamp": "MM:SS",
            "severity": "critical|high|medium|low",
            "mitigation": "Proposed solution if any",
            "owner": "Who's addressing it"
        }}
    ],
    "questions_raised": [
        {{
            "question": "The question asked",
            "asked_by": "Who asked",
            "answered": true,
            "answer": "The answer if provided",
            "timestamp": "MM:SS"
        }}
    ],
    "parking_lot": ["Items deferred for later discussion"],
    "next_steps": [
        {{
            "step": "What happens next",
            "owner": "Who's responsible",
            "timeline": "When"
        }}
    ],
    "follow_up_meeting": {{
        "needed": true,
        "suggested_date": "If mentioned",
        "topics": ["Topics to cover"]
    }},
    "sentiment": {{
        "overall": "productive|neutral|tense|positive",
        "energy": "high|medium|low",
        "alignment": "aligned|mixed|disagreement"
    }},
    "key_quotes": [
        {{
            "quote": "Important statement",
            "speaker": "Who said it",
            "timestamp": "MM:SS",
            "context": "Why it matters"
        }}
    ]
}}

RULES FOR ACTION ITEMS:
1. Be SPECIFIC - not "follow up" but "send email to client with revised pricing by Friday"
2. Always identify an owner - use "TBD - needs assignment" if unclear
3. Include deadline if mentioned, otherwise note "TBD"
4. Rate priority based on urgency discussed

RULES FOR DECISIONS:
1. Only include ACTUAL decisions, not ongoing discussions
2. Note if decision was unanimous or contested
3. Include the reasoning and alternatives considered

GENERAL RULES:
1. Capture ALL action items mentioned - these are critical
2. Identify speakers by name when possible
3. Note timestamps so people can jump to specific discussions
4. If something is unclear or needs follow-up, note it in questions_raised
5. The TL;DR should be actionable - what do I need to know RIGHT NOW?

Return ONLY the JSON object, no other text."""


DEEPDIVE_EXTRACTION_PROMPT = """You are a research analyst performing a deep, rigorous analysis of video content. Go beyond surface-level summary — identify the core thesis, map how ideas connect, evaluate the strength of arguments, and surface insights the casual viewer would miss.

TRANSCRIPT:
{transcript}

VISUAL DESCRIPTIONS FROM KEY FRAMES:
{frame_descriptions}

Return a JSON object with this EXACT structure:
{{
    "title": "Descriptive analytical title",
    "content_type": "deep-dive",
    "speaker": "Primary speaker/presenter name",
    "thesis": "The central argument or core message of this content in 2-3 sentences",
    "summary": "Comprehensive 3-4 paragraph summary covering all major points",
    "themes": [
        {{
            "theme": "Major theme or topic thread",
            "description": "How this theme is developed throughout the content",
            "timestamps": ["MM:SS", "MM:SS"],
            "significance": "Why this theme matters"
        }}
    ],
    "arguments": [
        {{
            "claim": "A specific claim or argument made",
            "speaker": "Who made it",
            "evidence": "Supporting evidence or reasoning provided",
            "strength": "strong|moderate|weak|unsupported",
            "timestamp": "MM:SS"
        }}
    ],
    "counterpoints": [
        {{
            "point": "A nuance, counterargument, or limitation acknowledged",
            "context": "What it responds to",
            "timestamp": "MM:SS"
        }}
    ],
    "frameworks": [
        {{
            "name": "Framework, model, or mental model presented",
            "description": "How it works and when to apply it",
            "timestamp": "MM:SS"
        }}
    ],
    "evidence": [
        {{
            "type": "statistic|example|case_study|analogy|expert_opinion|research",
            "content": "The specific evidence or example",
            "supports": "Which argument or theme it supports",
            "timestamp": "MM:SS"
        }}
    ],
    "connections": [
        {{
            "from": "Idea or theme A",
            "to": "Idea or theme B",
            "relationship": "How they connect (causes, enables, contradicts, extends, etc.)",
            "insight": "Why this connection matters"
        }}
    ],
    "key_insights": [
        {{
            "insight": "A non-obvious takeaway or implication",
            "reasoning": "Why this is significant",
            "timestamp": "MM:SS"
        }}
    ],
    "questions_raised": [
        "Open questions or unresolved tensions in the content"
    ],
    "practical_applications": [
        {{
            "application": "How this knowledge can be applied",
            "context": "In what situation",
            "difficulty": "easy|moderate|advanced"
        }}
    ],
    "related_concepts": ["Concepts, books, theories, or fields related to this content"],
    "tags": ["searchable", "tags"]
}}

ANALYSIS RULES:
1. The thesis should capture the CORE argument, not just the topic
2. Themes should show how ideas develop — not just list topics mentioned
3. Rate argument strength honestly — "unsupported" if no evidence is given
4. Connections should reveal non-obvious relationships between ideas
5. Key insights should go DEEPER than what's explicitly stated — draw inferences
6. Include at least 3-5 themes, 3-5 arguments, and 3-5 key insights
7. Questions raised should identify genuine gaps or tensions, not rhetorical questions

Return ONLY the JSON object, no other text."""


class ContentAnalyzer:
    def __init__(self, provider: str = "openai", model: str = None, tier: str = "free"):
        """
        Initialize the content analyzer

        Args:
            provider: "openai" or "ollama"
            model: Model name (default: tier-based for openai, llama3.1 for ollama)
            tier: User's subscription tier (pro/team get gpt-4o, free/starter get gpt-4o-mini)
        """
        self.provider = provider
        self.tier = tier

        if provider == "openai":
            from openai import OpenAI  # type: ignore[import-untyped]
            self.client = OpenAI()  # Uses OPENAI_API_KEY env var
            # Tier-based model selection: Pro/Team get gpt-4o, others get gpt-4o-mini
            if model:
                self.model = model
            elif tier in ("pro", "team"):
                self.model = "gpt-4o"
            else:
                self.model = "gpt-4o-mini"
        elif provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def _analyze_single_frame(
        self, timestamp: float, base64_image: str, with_captions: bool = True
    ) -> dict:
        """Analyze a single video frame using vision model.

        Returns:
            dict with keys: timestamp, caption, description, formatted
            or None on failure.
        """
        caption_instruction = (
            "First, write a short caption (max 15 words) summarizing the key visual. "
            "Then write ||| on its own. "
            "Then write a full description of what you see."
        ) if with_captions else ""

        if self.provider == "openai":
            vision_model = self.model if self.tier in ("pro", "team") else "gpt-4o-mini"

            prompt_text = (
                f"This is a frame from a video at {timestamp:.0f} seconds. "
                "Focus on the CONTENT being presented, not the people. "
                "Describe: text on screen, slides, diagrams, charts, code, "
                "products, demonstrations, websites, apps, or any visual information. "
                "Do NOT describe people's appearance, clothing, or physical features. "
                "If the frame only shows a person talking with no visual content, "
                "just say 'Speaker talking, no visual content on screen.' "
            )
            if with_captions:
                prompt_text += caption_instruction
            else:
                prompt_text += "Be concise and focus on informational content."

            response = self.client.chat.completions.create(
                model=vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt_text
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=200
            )
            raw = response.choices[0].message.content
        else:
            response = self.client.chat(
                model="llava",
                messages=[
                    {
                        "role": "user",
                        "content": f"This is a frame from a video at {timestamp:.0f} seconds. "
                                   "Briefly describe what you see: people, text, diagrams, demonstrations.",
                        "images": [base64_image]
                    }
                ]
            )
            raw = response["message"]["content"]

        # Parse caption ||| description if present
        if with_captions and "|||" in raw:
            parts = raw.split("|||", 1)
            caption = parts[0].strip()
            description = parts[1].strip()
        else:
            caption = ""
            description = raw.strip()

        return {
            "timestamp": timestamp,
            "caption": caption,
            "description": description,
            "formatted": f"[{timestamp:.0f}s] {description}"
        }

    def analyze_frames(self, frames: List[Tuple[float, str]], with_captions: bool = True) -> List[str]:
        """
        Analyze video frames using vision model (sequential, one at a time).
        Returns descriptions of what's happening in each frame.

        When with_captions=True, also populates self._last_frame_analyses with
        [{timestamp, caption, description}] for richer timeline data.
        """
        descriptions = []
        self._last_frame_analyses = []

        for timestamp, base64_image in frames:
            try:
                result = self._analyze_single_frame(timestamp, base64_image, with_captions)

                descriptions.append(result["formatted"])
                self._last_frame_analyses.append({
                    "timestamp": result["timestamp"],
                    "caption": result["caption"],
                    "description": result["description"]
                })

                print(f"  Analyzed frame at {timestamp:.0f}s")

            except Exception as frame_err:
                print(f"  WARNING: Frame at {timestamp:.0f}s failed ({type(frame_err).__name__}), skipping")

        return descriptions

    def analyze_frames_parallel(
        self,
        frames: List[Tuple[float, str]],
        with_captions: bool = True,
        max_workers: int = 5,
        progress_callback: callable = None
    ) -> List[str]:
        """
        Analyze video frames using vision model in parallel using ThreadPoolExecutor.
        Returns descriptions in the same order as input frames.

        Args:
            frames: List of (timestamp, base64_image) tuples
            with_captions: Whether to generate captions
            max_workers: Max concurrent API calls (default 5)
            progress_callback: Optional callback(completed, total) for progress

        When with_captions=True, also populates self._last_frame_analyses.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        descriptions = [None] * len(frames)
        analyses = [None] * len(frames)
        self._last_frame_analyses = []
        completed_count = 0

        def analyze_with_index(idx, timestamp, base64_image):
            return idx, self._analyze_single_frame(timestamp, base64_image, with_captions)

        try:
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(analyze_with_index, i, ts, img): i
                    for i, (ts, img) in enumerate(frames)
                }

                for future in as_completed(futures):
                    idx = futures[future]
                    try:
                        i, result = future.result()
                        descriptions[i] = result["formatted"]
                        analyses[i] = {
                            "timestamp": result["timestamp"],
                            "caption": result["caption"],
                            "description": result["description"]
                        }
                        completed_count += 1
                        print(f"  Analyzed frame at {result['timestamp']:.0f}s ({completed_count}/{len(frames)})")
                        if progress_callback:
                            progress_callback(completed_count, len(frames))
                    except Exception as frame_err:
                        ts = frames[idx][0]
                        print(f"  WARNING: Frame at {ts:.0f}s failed ({type(frame_err).__name__}), skipping")
                        completed_count += 1
                        if progress_callback:
                            progress_callback(completed_count, len(frames))

        except Exception as e:
            print(f"  Parallel analysis failed ({e}), falling back to sequential")
            return self.analyze_frames(frames, with_captions)

        # Filter out None entries (failed frames)
        self._last_frame_analyses = [a for a in analyses if a is not None]
        return [d for d in descriptions if d is not None]

    def detect_mode(self, transcript: str) -> dict:
        """
        Auto-detect the content mode from transcript

        Returns:
            dict with keys: mode, confidence, reason
        """
        # Use first 2000 chars for detection (faster, cheaper)
        transcript_preview = transcript[:2000] if len(transcript) > 2000 else transcript

        prompt = MODE_DETECTION_PROMPT.format(transcript_preview=transcript_preview)

        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=100
                )
                content = response.choices[0].message.content
            else:
                response = self.client.chat(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    format="json"
                )
                content = response["message"]["content"]

            result = json.loads(content)
            detected_mode = result.get("mode", "general")

            # Validate mode
            if detected_mode not in EXTRACTION_MODES:
                detected_mode = "general"

            print(f"  Auto-detected mode: {detected_mode} (confidence: {result.get('confidence', 'N/A')})")
            print(f"  Reason: {result.get('reason', 'N/A')}")

            return {
                "mode": detected_mode,
                "confidence": result.get("confidence", 0.5),
                "reason": result.get("reason", "")
            }
        except Exception as e:
            print(f"  Mode detection failed, defaulting to 'general': {e}")
            return {"mode": "general", "confidence": 0.0, "reason": f"Detection failed: {e}"}

    def extract_content(
        self,
        transcript: str,
        frame_descriptions: List[str] = None,
        video_path: str = None,
        source_url: str = None,
        duration_seconds: int = None,
        formatted_transcript: str = None,
        save_frame_descriptions: bool = True,
        mode: str = "auto",
        youtube_stats: dict = None,
        language: str = None
    ) -> ContentExtract:
        """
        Extract structured content from transcript and frame descriptions

        Args:
            mode: Extraction mode - "auto" (detect), "general", "recipe", "learn", "creator", "meeting"
        """
        frame_text = "\n".join(frame_descriptions) if frame_descriptions else "No visual descriptions available."

        # Auto-detect mode if not specified
        if mode == "auto" or mode not in EXTRACTION_MODES:
            print("  Detecting content type...")
            detection = self.detect_mode(transcript)
            mode = detection.get("mode", "general")

        # Select prompt based on mode
        if mode == "recipe":
            prompt = RECIPE_EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text
            )
        elif mode == "learn":
            prompt = LEARN_EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text
            )
        elif mode == "creator":
            # Build YouTube stats context for creator mode
            stats_text = "No YouTube stats available."
            if youtube_stats and youtube_stats.get("view_count"):
                stats_text = (
                    f"YOUTUBE VIDEO STATISTICS:\n"
                    f"- Views: {youtube_stats.get('view_count', 0):,}\n"
                    f"- Likes: {youtube_stats.get('like_count', 0):,}\n"
                    f"- Comments: {youtube_stats.get('comment_count', 0):,}\n"
                    f"- Channel subscribers: {youtube_stats.get('subscriber_count', 0):,}\n"
                    f"- Upload date: {youtube_stats.get('upload_date', 'Unknown')}\n"
                    f"- Channel: {youtube_stats.get('channel', 'Unknown')}\n"
                    f"- Categories: {', '.join(youtube_stats.get('categories', []))}\n"
                )
            prompt = CREATOR_EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text,
                youtube_stats=stats_text
            )
        elif mode == "meeting":
            prompt = MEETING_EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text
            )
        elif mode == "deepdive":
            prompt = DEEPDIVE_EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text
            )
        else:
            # Default to general extraction
            prompt = EXTRACTION_PROMPT.format(
                transcript=transcript,
                frame_descriptions=frame_text
            )

        # Prepend language instruction if a specific language is requested
        LANGUAGE_NAMES = {
            "af": "Afrikaans", "am": "Amharic", "ar": "Arabic", "as": "Assamese",
            "az": "Azerbaijani", "bg": "Bulgarian", "bn": "Bengali", "bs": "Bosnian",
            "ca": "Catalan", "cs": "Czech", "cy": "Welsh", "da": "Danish",
            "de": "German", "el": "Greek", "en": "English", "es": "Spanish",
            "et": "Estonian", "fa": "Persian", "fi": "Finnish", "fr": "French",
            "gl": "Galician", "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi",
            "hr": "Croatian", "hu": "Hungarian", "hy": "Armenian", "id": "Indonesian",
            "is": "Icelandic", "it": "Italian", "ja": "Japanese", "ka": "Georgian",
            "kk": "Kazakh", "km": "Khmer", "kn": "Kannada", "ko": "Korean",
            "lt": "Lithuanian", "lv": "Latvian", "mk": "Macedonian", "ml": "Malayalam",
            "mn": "Mongolian", "mr": "Marathi", "ms": "Malay", "my": "Myanmar",
            "ne": "Nepali", "nl": "Dutch", "no": "Norwegian", "pa": "Punjabi",
            "pl": "Polish", "ps": "Pashto", "pt": "Portuguese", "ro": "Romanian",
            "ru": "Russian", "sd": "Sindhi", "si": "Sinhala", "sk": "Slovak",
            "sl": "Slovenian", "sq": "Albanian", "sr": "Serbian", "sv": "Swedish",
            "sw": "Swahili", "ta": "Tamil", "te": "Telugu", "th": "Thai",
            "tl": "Tagalog", "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu",
            "uz": "Uzbek", "vi": "Vietnamese", "yo": "Yoruba", "zh": "Chinese",
            "yue": "Cantonese",
        }
        if language and language != "auto":
            lang_name = LANGUAGE_NAMES.get(language, language)
            prompt = (
                f"CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL output text — titles, summaries, "
                f"descriptions, key points, action items, tags, entity descriptions, quotes — "
                f"in {lang_name}. Only keep proper nouns, code snippets, and URLs in their original "
                f"form. The JSON keys must remain in English but ALL values must be in {lang_name}.\n\n"
                f"{prompt}\n\nREMINDER: All text values in the JSON output MUST be in {lang_name}."
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
                raise ValueError(f"Could not parse JSON from response: {content[:500]}")

        # Generate unique ID
        content_id = f"content_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Handle different modes
        if mode == "recipe":
            # Recipe mode - data contains recipe-specific structure
            recipe_data = data

            # Extract key info for the ContentExtract summary fields
            title = recipe_data.get("title", "Untitled Recipe")
            description = recipe_data.get("description", "")
            chef_name = recipe_data.get("chef_name", "Unknown")
            cuisine = recipe_data.get("cuisine", "")
            diet_tags = recipe_data.get("diet_tags", [])
            difficulty = recipe_data.get("difficulty", "medium")

            # Create summary from recipe info
            summary = f"{description} A {difficulty} {cuisine} recipe." if cuisine else description

            # Extract topics from recipe
            topics = [cuisine] if cuisine else []
            if diet_tags:
                topics.extend(diet_tags)

            # Create tags from recipe
            tags = diet_tags.copy() if diet_tags else []
            tags.append("recipe")
            if cuisine:
                tags.append(cuisine.lower())

            # Extract key points from steps
            steps = recipe_data.get("steps", [])
            key_points = [
                {
                    "point": step.get("instruction", ""),
                    "timestamp": step.get("timestamp", ""),
                    "details": step.get("tip", "")
                }
                for step in steps[:5]  # First 5 steps as key points
            ]

            # Extract tips as action items
            tips = recipe_data.get("tips", [])
            action_items = [tip.get("tip", "") for tip in tips if isinstance(tip, dict)]

            return ContentExtract(
                id=content_id,
                title=title,
                summary=summary,
                content_type="recipe",
                mode="recipe",
                speaker=chef_name,
                topics=topics,
                key_points=key_points,
                entities=[],
                action_items=action_items,
                quotes=[],
                resources=[],
                tags=tags,
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path,
                recipe=recipe_data  # Store full recipe data
            )

        elif mode == "learn":
            # Learn mode - educational content
            learn_data = data

            title = learn_data.get("title", "Untitled Lecture")
            subject = learn_data.get("subject", "")
            instructor = learn_data.get("instructor", "Unknown")
            summary = learn_data.get("summary", "")

            # Extract topics
            topics = [subject] if subject else []

            # Extract key concepts as key points
            key_concepts = learn_data.get("key_concepts", [])
            key_points = [
                {
                    "point": kc.get("concept", ""),
                    "timestamp": kc.get("timestamp", ""),
                    "details": kc.get("definition", "")
                }
                for kc in key_concepts
            ]

            # Learning objectives as action items
            action_items = learn_data.get("learning_objectives", [])

            # Create tags
            tags = ["learn", "educational"]
            if subject:
                tags.append(subject.lower())
            difficulty = learn_data.get("difficulty_level", "")
            if difficulty:
                tags.append(difficulty)

            return ContentExtract(
                id=content_id,
                title=title,
                summary=summary,
                content_type="lecture",
                mode="learn",
                speaker=instructor,
                topics=topics,
                key_points=key_points,
                entities=[],
                action_items=action_items,
                quotes=[],
                resources=learn_data.get("resources", []),
                tags=tags,
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path,
                learn=learn_data  # Store full learn data
            )

        elif mode == "creator":
            # Creator mode - content for repurposing
            creator_data = data

            title = creator_data.get("title", "Untitled Content")
            content_type = creator_data.get("content_type", "podcast")
            host = creator_data.get("host", "Unknown")
            summary = creator_data.get("elevator_pitch", creator_data.get("one_liner", ""))

            # Guests as topics
            guests = creator_data.get("guests", [])
            topics = guests if guests else []

            # Key points from the extracted key points
            key_points = creator_data.get("key_points", [])

            # Quotable quotes
            quotes = [
                {
                    "text": q.get("quote", ""),
                    "speaker": q.get("speaker", host),
                    "timestamp": q.get("timestamp", "")
                }
                for q in creator_data.get("quotable_quotes", [])
            ]

            # Create tags
            tags = ["creator", content_type]
            tags.extend(creator_data.get("hashtags", [])[:5])

            # Inject YouTube stats into creator data for attribution display
            if youtube_stats and youtube_stats.get("view_count"):
                creator_data["youtube_stats"] = youtube_stats
                creator_data["performance_metrics"] = {
                    "views": youtube_stats.get("view_count", 0),
                    "likes": youtube_stats.get("like_count", 0),
                    "comments": youtube_stats.get("comment_count", 0),
                }

            return ContentExtract(
                id=content_id,
                title=title,
                summary=summary,
                content_type=content_type,
                mode="creator",
                speaker=host,
                topics=topics,
                key_points=key_points,
                entities=[],
                action_items=[],
                quotes=quotes,
                resources=[],
                tags=tags,
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path,
                creator=creator_data  # Store full creator data including stats
            )

        elif mode == "meeting":
            # Meeting mode - meeting minutes
            meeting_data = data

            title = meeting_data.get("title", "Untitled Meeting")
            meeting_type = meeting_data.get("meeting_type", "meeting")
            summary = meeting_data.get("tldr", "")

            # Extract attendees as topics
            attendees = meeting_data.get("attendees", [])
            topics = [a.get("name", "") for a in attendees if isinstance(a, dict)]

            # Decisions as key points
            decisions = meeting_data.get("decisions", [])
            key_points = [
                {
                    "point": d.get("decision", ""),
                    "timestamp": d.get("timestamp", ""),
                    "details": d.get("reasoning", "")
                }
                for d in decisions
            ]

            # Action items
            action_items_raw = meeting_data.get("action_items", [])
            action_items = [
                f"{ai.get('task', '')} - {ai.get('owner', 'TBD')} (Due: {ai.get('deadline', 'TBD')})"
                for ai in action_items_raw if isinstance(ai, dict)
            ]

            # Key quotes
            quotes = [
                {
                    "text": q.get("quote", ""),
                    "speaker": q.get("speaker", "Unknown"),
                    "timestamp": q.get("timestamp", "")
                }
                for q in meeting_data.get("key_quotes", [])
            ]

            # Tags
            tags = ["meeting", meeting_type]

            return ContentExtract(
                id=content_id,
                title=title,
                summary=summary,
                content_type=meeting_type,
                mode="meeting",
                speaker="",  # Meetings have multiple speakers
                topics=topics,
                key_points=key_points,
                entities=[],
                action_items=action_items,
                quotes=quotes,
                resources=[],
                tags=tags,
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path,
                meeting=meeting_data  # Store full meeting data
            )

        elif mode == "deepdive":
            # Deep dive analysis mode
            dd = data

            title = dd.get("title", "Untitled Analysis")
            speaker = dd.get("speaker", "Unknown")
            summary = dd.get("summary", "")
            thesis = dd.get("thesis", "")

            # Map themes to topics
            themes = dd.get("themes", [])
            topics = [t.get("theme", "") for t in themes if isinstance(t, dict)]

            # Map key_insights + arguments to key_points
            key_insights = dd.get("key_insights", [])
            arguments = dd.get("arguments", [])
            key_points = [
                {
                    "point": i.get("insight", ""),
                    "timestamp": i.get("timestamp", ""),
                    "details": i.get("reasoning", "")
                }
                for i in key_insights
            ]

            # Practical applications as action items
            applications = dd.get("practical_applications", [])
            action_items = [
                f"{a.get('application', '')} ({a.get('difficulty', '')})"
                for a in applications if isinstance(a, dict)
            ]

            # Tags
            tags = dd.get("tags", [])
            tags.insert(0, "deep-dive")

            return ContentExtract(
                id=content_id,
                title=title,
                summary=summary,
                content_type="deep-dive",
                mode="deepdive",
                speaker=speaker,
                topics=topics,
                key_points=key_points,
                entities=[],
                action_items=action_items,
                quotes=[],
                resources=[],
                tags=tags,
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path,
                deepdive=dd  # Store full deep dive data
            )

        else:
            # General mode (default)
            # Get speaker name and apply to quotes that have "Unknown"
            speaker_name = data.get("speaker", "Unknown")
            quotes = data.get("quotes", [])
            for quote in quotes:
                if isinstance(quote, dict) and quote.get("speaker") in ("Unknown", "", None):
                    quote["speaker"] = speaker_name

            return ContentExtract(
                id=content_id,
                title=data.get("title", "Untitled Content"),
                summary=data.get("summary", ""),
                content_type=data.get("content_type", "other"),
                mode="general",
                speaker=speaker_name,
                topics=data.get("topics", []),
                key_points=data.get("key_points", []),
                entities=data.get("entities", []),
                action_items=data.get("action_items", []),
                quotes=quotes,
                resources=data.get("resources", []),
                tags=data.get("tags", []),
                transcript=formatted_transcript if formatted_transcript else transcript,
                frame_descriptions=frame_descriptions if save_frame_descriptions and frame_descriptions else [],
                duration_seconds=duration_seconds,
                source_url=source_url,
                source_video=video_path
            )


def analyze_video_content(
    transcript: str,
    frames: List[Tuple[float, str]] = None,
    provider: str = "openai",
    video_path: str = None,
    source_url: str = None,
    duration_seconds: int = None
) -> ContentExtract:
    """Convenience function to analyze a video and extract content"""
    analyzer = ContentAnalyzer(provider=provider)

    frame_descriptions = []
    if frames:
        print("Analyzing video frames...")
        frame_descriptions = analyzer.analyze_frames(frames)

    print("Extracting content from video...")
    content = analyzer.extract_content(
        transcript=transcript,
        frame_descriptions=frame_descriptions,
        video_path=video_path,
        source_url=source_url,
        duration_seconds=duration_seconds
    )

    return content


if __name__ == "__main__":
    # Test with sample data
    sample_transcript = """
    Today I'm going to show you 6 ChatGPT hacks that will help you make money.
    
    First, you can use ChatGPT for content creation. Write blog posts, social media content,
    and marketing copy in minutes instead of hours.
    
    Second, use it for code generation. Even if you're not a developer, you can build
    simple tools and automations.
    
    Third, create course outlines and educational content. Package your knowledge
    and sell it online.
    
    Fourth, use it for research and summarization. Save hours by having AI
    summarize long documents and articles.
    
    Fifth, customer service automation. Create chatbot responses and FAQ content.
    
    Sixth, use it for data analysis. Upload spreadsheets and get insights instantly.
    """

    try:
        analyzer = ContentAnalyzer(provider="openai")
        content = analyzer.extract_content(sample_transcript)
        print(content.to_json())
    except Exception as e:
        print(f"Error (expected if no API key): {e}")
