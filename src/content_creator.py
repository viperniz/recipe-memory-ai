"""
Content Creator Module
Tools for generating new content from extracted video data:
- Top 10 script generation
- Content spinning/rewording
"""

import json
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class TopTenScript:
    """Generated top 10 script"""
    id: str
    title: str
    intro: str
    items: List[Dict]  # [{rank, title, description, source_video, timestamp}]
    outro: str
    tags: List[str]
    source_videos: List[str]  # IDs of videos used
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)

    def to_script(self) -> str:
        """Convert to readable script format"""
        lines = []
        lines.append(f"# {self.title}\n")
        lines.append(f"{self.intro}\n")
        lines.append("---\n")

        for item in self.items:
            rank = item.get('rank', '?')
            lines.append(f"## #{rank}: {item.get('title', 'Untitled')}\n")
            lines.append(f"{item.get('description', '')}\n")
            if item.get('source_video'):
                lines.append(f"_Source: {item.get('source_video')}_\n")
            lines.append("")

        lines.append("---\n")
        lines.append(self.outro)

        return "\n".join(lines)


@dataclass
class SpunContent:
    """Reworded/spun content"""
    id: str
    original_id: str
    title: str
    script: str
    key_points: List[str]
    style: str  # casual, professional, educational, entertaining
    tags: List[str]
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)


TOP_TEN_PROMPT = """You are a professional scriptwriter creating engaging "Top 10" style video scripts.

I have extracted information from multiple videos on the topic: "{topic}"

Here is the content from these videos:

{content_data}

Create a compelling "Top 10" script that:
1. Ranks the most interesting/important points from across all videos
2. Has an engaging intro that hooks the viewer
3. Each item should have a catchy title and detailed description
4. Include a call-to-action outro

Return a JSON object with this EXACT structure:
{{
    "title": "Top 10 [Topic] That Will [Benefit/Outcome]",
    "intro": "Hook paragraph that grabs attention and sets up what viewers will learn",
    "items": [
        {{
            "rank": 10,
            "title": "Catchy item title",
            "description": "2-3 sentences explaining this point in an engaging way",
            "source_video": "Title of the source video",
            "key_insight": "The main takeaway from this point"
        }}
    ],
    "outro": "Closing paragraph with call-to-action (like, subscribe, comment)",
    "tags": ["relevant", "searchable", "tags"]
}}

Items should be ordered from #10 (least important) to #1 (most important/impactful).
Make the descriptions engaging and conversational - this is for a video script.
Return ONLY the JSON object."""


CONTENT_SPIN_PROMPT = """You are an expert content rewriter. Take the following video content and rewrite it in a fresh, original way while preserving all the key information.

ORIGINAL CONTENT:
Title: {title}
Summary: {summary}

Key Points:
{key_points}

Transcript excerpt:
{transcript_excerpt}

REWRITE STYLE: {style}

Style guidelines:
- casual: Friendly, conversational, uses "you" and "I", includes personal anecdotes
- professional: Formal, authoritative, data-driven, industry terminology
- educational: Clear explanations, step-by-step, beginner-friendly, lots of examples
- entertaining: Humorous, engaging hooks, pop culture references, high energy

Create a completely rewritten script that:
1. Uses different words and sentence structures
2. Reorganizes the information flow
3. Adds new examples or analogies
4. Maintains the core message and facts
5. Matches the requested style

Return a JSON object with this EXACT structure:
{{
    "title": "New engaging title for the rewritten content",
    "script": "Full rewritten script (3-5 paragraphs) ready for video narration",
    "key_points": ["Reworded key point 1", "Reworded key point 2", ...],
    "hook": "Opening line to grab attention",
    "tags": ["relevant", "tags"]
}}

Return ONLY the JSON object."""


MULTI_VIDEO_ANALYSIS_PROMPT = """Analyze these videos and identify the most valuable, unique insights that could be combined into compelling content.

VIDEOS:
{video_data}

For each video, extract:
1. The single most valuable/unique insight
2. Any facts, statistics, or examples that stand out
3. Actionable advice or tips

Return a JSON object:
{{
    "topic_summary": "What these videos are collectively about",
    "unique_insights": [
        {{
            "video_title": "Source video title",
            "insight": "The key insight",
            "supporting_facts": ["fact 1", "fact 2"],
            "actionable_tip": "What viewers can do with this"
        }}
    ],
    "common_themes": ["theme 1", "theme 2"],
    "best_quotes": [
        {{"quote": "Notable quote", "source": "Video title"}}
    ]
}}

Return ONLY the JSON object."""


class TopTenGenerator:
    """Generates Top 10 style scripts from multiple video sources"""

    def __init__(self, llm_provider: str = "openai", model: str = None):
        self.provider = llm_provider

        if llm_provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
            self.model = model or "gpt-4o-mini"
        elif llm_provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {llm_provider}")

    def _call_llm(self, prompt: str) -> str:
        """Make LLM call and return content"""
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        else:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format="json"
            )
            return response["message"]["content"]

    def analyze_videos(self, contents: List[Dict]) -> Dict:
        """Analyze multiple videos to find unique insights"""
        video_data = ""
        for i, content in enumerate(contents, 1):
            video_data += f"\n--- VIDEO {i}: {content.get('title', 'Untitled')} ---\n"
            video_data += f"Summary: {content.get('summary', '')}\n"
            video_data += f"Key Points:\n"
            for kp in content.get('key_points', [])[:5]:
                if isinstance(kp, dict):
                    video_data += f"  - {kp.get('point', str(kp))}\n"
                else:
                    video_data += f"  - {kp}\n"
            video_data += f"Entities: {', '.join([e.get('name', str(e)) for e in content.get('entities', [])[:5]])}\n"

        prompt = MULTI_VIDEO_ANALYSIS_PROMPT.format(video_data=video_data)

        result = self._call_llm(prompt)
        return json.loads(result)

    def generate(
        self,
        contents: List[Dict],
        topic: str,
        num_items: int = 10,
        custom_instructions: str = None
    ) -> TopTenScript:
        """
        Generate a Top 10 script from multiple video contents

        Args:
            contents: List of content dictionaries from processed videos
            topic: The topic for the Top 10 list
            num_items: Number of items (default 10)
            custom_instructions: Optional additional instructions

        Returns:
            TopTenScript object with the generated script
        """
        # Build content data string
        content_data = ""
        source_videos = []

        for content in contents:
            source_videos.append(content.get('id', 'unknown'))
            content_data += f"\n--- {content.get('title', 'Untitled')} ---\n"
            content_data += f"Summary: {content.get('summary', '')}\n"
            content_data += f"Speaker: {content.get('speaker', 'Unknown')}\n"
            content_data += f"Key Points:\n"

            for kp in content.get('key_points', []):
                if isinstance(kp, dict):
                    point = kp.get('point', str(kp))
                    details = kp.get('details', '')
                    content_data += f"  - {point}"
                    if details:
                        content_data += f" ({details})"
                    content_data += "\n"
                else:
                    content_data += f"  - {kp}\n"

            content_data += f"Action Items: {', '.join(content.get('action_items', []))}\n"

            # Add notable quotes
            for quote in content.get('quotes', [])[:3]:
                if isinstance(quote, dict):
                    content_data += f"Quote: \"{quote.get('text', '')}\" - {quote.get('speaker', 'Unknown')}\n"

        prompt = TOP_TEN_PROMPT.format(
            topic=topic,
            content_data=content_data
        )

        if custom_instructions:
            prompt += f"\n\nAdditional instructions: {custom_instructions}"

        if num_items != 10:
            prompt = prompt.replace("Top 10", f"Top {num_items}")

        result = self._call_llm(prompt)
        data = json.loads(result)

        # Ensure we have the right number of items
        items = data.get('items', [])[:num_items]

        script_id = f"top{num_items}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return TopTenScript(
            id=script_id,
            title=data.get('title', f'Top {num_items} {topic}'),
            intro=data.get('intro', ''),
            items=items,
            outro=data.get('outro', ''),
            tags=data.get('tags', []),
            source_videos=source_videos
        )

    def generate_from_search(
        self,
        memory,
        query: str,
        topic: str,
        num_videos: int = 5,
        num_items: int = 10
    ) -> TopTenScript:
        """
        Generate Top 10 from memory search results

        Args:
            memory: ContentMemory instance
            query: Search query to find relevant videos
            topic: Topic for the Top 10 list
            num_videos: Number of videos to use as sources
            num_items: Number of items in the list

        Returns:
            TopTenScript object
        """
        results = memory.search(query, n_results=num_videos)

        if not results:
            raise ValueError(f"No content found for query: {query}")

        return self.generate(results, topic, num_items)


class ContentSpinner:
    """Rewrites and spins existing content for recycling"""

    STYLES = ["casual", "professional", "educational", "entertaining"]

    def __init__(self, llm_provider: str = "openai", model: str = None):
        self.provider = llm_provider

        if llm_provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
            self.model = model or "gpt-4o-mini"
        elif llm_provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {llm_provider}")

    def _call_llm(self, prompt: str) -> str:
        """Make LLM call and return content"""
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        else:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format="json"
            )
            return response["message"]["content"]

    def spin(
        self,
        content: Dict,
        style: str = "casual",
        custom_instructions: str = None
    ) -> SpunContent:
        """
        Spin/rewrite content in a new style

        Args:
            content: Content dictionary from processed video
            style: Target style (casual, professional, educational, entertaining)
            custom_instructions: Optional additional instructions

        Returns:
            SpunContent object with rewritten content
        """
        if style not in self.STYLES:
            raise ValueError(f"Style must be one of: {self.STYLES}")

        # Prepare key points
        key_points_text = ""
        for kp in content.get('key_points', []):
            if isinstance(kp, dict):
                key_points_text += f"- {kp.get('point', str(kp))}\n"
            else:
                key_points_text += f"- {kp}\n"

        # Get transcript excerpt (first 1500 chars)
        transcript = content.get('transcript', '')
        transcript_excerpt = transcript[:1500] + "..." if len(transcript) > 1500 else transcript

        prompt = CONTENT_SPIN_PROMPT.format(
            title=content.get('title', 'Untitled'),
            summary=content.get('summary', ''),
            key_points=key_points_text,
            transcript_excerpt=transcript_excerpt,
            style=style
        )

        if custom_instructions:
            prompt += f"\n\nAdditional instructions: {custom_instructions}"

        result = self._call_llm(prompt)
        data = json.loads(result)

        spin_id = f"spin_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return SpunContent(
            id=spin_id,
            original_id=content.get('id', 'unknown'),
            title=data.get('title', 'Rewritten: ' + content.get('title', '')),
            script=data.get('script', ''),
            key_points=data.get('key_points', []),
            style=style,
            tags=data.get('tags', [])
        )

    def spin_multiple_styles(
        self,
        content: Dict,
        styles: List[str] = None
    ) -> List[SpunContent]:
        """
        Generate multiple versions of content in different styles

        Args:
            content: Content dictionary from processed video
            styles: List of styles to generate (defaults to all)

        Returns:
            List of SpunContent objects
        """
        styles = styles or self.STYLES
        results = []

        for style in styles:
            spun = self.spin(content, style)
            results.append(spun)

        return results

    def combine_and_spin(
        self,
        contents: List[Dict],
        style: str = "casual",
        focus_topic: str = None
    ) -> SpunContent:
        """
        Combine multiple videos into one spun piece

        Args:
            contents: List of content dictionaries
            style: Target style
            focus_topic: Optional topic to focus on

        Returns:
            SpunContent combining insights from all sources
        """
        # Merge content
        combined = {
            'id': 'combined',
            'title': focus_topic or 'Combined Content',
            'summary': ' '.join([c.get('summary', '') for c in contents]),
            'key_points': [],
            'transcript': ''
        }

        for content in contents:
            combined['key_points'].extend(content.get('key_points', []))
            combined['transcript'] += f"\n--- From: {content.get('title', 'Unknown')} ---\n"
            combined['transcript'] += content.get('transcript', '')[:500]

        # Limit key points
        combined['key_points'] = combined['key_points'][:15]

        return self.spin(combined, style)


def create_top_ten_from_memory(memory, topic: str, query: str = None, provider: str = "openai") -> TopTenScript:
    """
    Convenience function to create a Top 10 script from memory

    Args:
        memory: ContentMemory instance
        topic: Topic for the Top 10
        query: Optional search query (defaults to topic)
        provider: LLM provider to use

    Returns:
        TopTenScript object
    """
    generator = TopTenGenerator(llm_provider=provider)
    return generator.generate_from_search(memory, query or topic, topic)


def spin_content(content: Dict, style: str = "casual", provider: str = "openai") -> SpunContent:
    """
    Convenience function to spin content

    Args:
        content: Content dictionary
        style: Target style
        provider: LLM provider to use

    Returns:
        SpunContent object
    """
    spinner = ContentSpinner(llm_provider=provider)
    return spinner.spin(content, style)


if __name__ == "__main__":
    # Test with sample data
    sample_contents = [
        {
            "id": "video1",
            "title": "10 Python Tips for Beginners",
            "summary": "Essential Python tips for new programmers",
            "key_points": [
                {"point": "Use list comprehensions for cleaner code"},
                {"point": "Virtual environments prevent dependency conflicts"},
                {"point": "F-strings are the best way to format strings"}
            ],
            "action_items": ["Set up a virtual environment", "Practice list comprehensions"],
            "quotes": [{"text": "Python is about readability", "speaker": "Tutorial Author"}],
            "transcript": "Welcome to my Python tips video..."
        },
        {
            "id": "video2",
            "title": "Advanced Python Tricks",
            "summary": "Level up your Python skills",
            "key_points": [
                {"point": "Decorators add functionality to functions"},
                {"point": "Context managers handle resources properly"},
                {"point": "Generators save memory with large datasets"}
            ],
            "action_items": ["Write your own decorator", "Use generators for big files"],
            "quotes": [],
            "transcript": "Let's dive into advanced Python..."
        }
    ]

    print("Testing Content Creator Module\n")

    try:
        # Test Top 10 Generator
        print("=== Top 10 Generator ===")
        generator = TopTenGenerator(llm_provider="openai")
        script = generator.generate(sample_contents, "Python Programming Tips", num_items=5)
        print(f"Generated: {script.title}")
        print(script.to_script()[:500] + "...")

        print("\n=== Content Spinner ===")
        spinner = ContentSpinner(llm_provider="openai")
        spun = spinner.spin(sample_contents[0], style="entertaining")
        print(f"Spun title: {spun.title}")
        print(f"Style: {spun.style}")
        print(f"Script preview: {spun.script[:300]}...")

    except Exception as e:
        print(f"Test error (expected if no API key): {e}")
