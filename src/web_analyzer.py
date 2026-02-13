"""
Web Content Analyzer Module
Uses LLM to extract structured information from web articles
"""

import json
from typing import Optional, List
from dataclasses import dataclass, asdict, field
from datetime import datetime

from web_scraper import WebContent


# Web content extraction prompt
WEB_EXTRACTION_PROMPT = """You are an expert content analyst. Extract structured information from this web article.

ARTICLE TITLE: {title}
ARTICLE URL: {url}
SITE: {site_name}
AUTHOR: {author}
PUBLISHED: {published_date}

ARTICLE CONTENT:
{content}

Extract and return a JSON object with this structure:
{{
    "title": "Clear, descriptive title",
    "summary": "2-3 sentence comprehensive summary",
    "content_type": "article|tutorial|documentation|news|blog|guide|research|other",
    "topics": ["main topic 1", "main topic 2"],
    "key_points": [
        {{"point": "Key insight or fact", "details": "Additional context"}}
    ],
    "entities": [
        {{"name": "Person/Product/Tool/Company", "type": "person|product|tool|company|concept", "description": "Brief description"}}
    ],
    "action_items": ["Actionable takeaway 1", "Actionable takeaway 2"],
    "quotes": [
        {{"text": "Notable quote from the article", "speaker": "Who said it if known"}}
    ],
    "resources": [
        {{"name": "Resource name", "url": "URL if mentioned", "description": "What it's for"}}
    ],
    "tags": ["relevant", "searchable", "tags"],
    "difficulty_level": "beginner|intermediate|advanced|all",
    "target_audience": "Who this article is for"
}}

Be thorough - extract ALL key points, tools mentioned, and actionable information.
Return ONLY the JSON object, no other text."""


# Tool/Method research prompt (for finding tools, methods, ways to make money, etc.)
RESEARCH_EXTRACTION_PROMPT = """You are a research analyst extracting actionable information from web content about tools, methods, and opportunities.

ARTICLE TITLE: {title}
ARTICLE URL: {url}
SITE: {site_name}

ARTICLE CONTENT:
{content}

Extract research-focused information. Return a JSON object:
{{
    "title": "Clear title describing what this is about",
    "summary": "2-3 sentence summary of the main value/opportunity",
    "research_type": "tool|method|opportunity|tutorial|comparison|review",
    "tools_mentioned": [
        {{
            "name": "Tool name",
            "url": "Tool URL if available",
            "description": "What it does",
            "pricing": "Free/Paid/Freemium if mentioned",
            "use_case": "What problem it solves"
        }}
    ],
    "methods": [
        {{
            "method": "Method or technique name",
            "steps": ["Step 1", "Step 2"],
            "difficulty": "easy|medium|hard",
            "time_required": "Estimated time if mentioned",
            "expected_outcome": "What you get from this"
        }}
    ],
    "opportunities": [
        {{
            "opportunity": "The opportunity or way to make money",
            "requirements": ["What you need"],
            "potential_income": "Income potential if mentioned",
            "pros": ["Advantage 1"],
            "cons": ["Disadvantage 1"]
        }}
    ],
    "key_takeaways": ["Main insight 1", "Main insight 2"],
    "action_items": ["Specific next step to take"],
    "tags": ["searchable", "tags"]
}}

Focus on extracting practical, actionable information.
Return ONLY the JSON object, no other text."""


@dataclass
class WebExtract:
    """Structured content extraction from web page"""
    id: str
    title: str
    summary: str
    content_type: str
    mode: str = "web"  # Always "web" for web content
    source_url: str = ""
    site_name: str = ""
    author: str = ""
    published_date: str = ""
    topics: List[str] = field(default_factory=list)
    key_points: List[dict] = field(default_factory=list)
    entities: List[dict] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    quotes: List[dict] = field(default_factory=list)
    resources: List[dict] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    full_content: str = ""  # Original article text
    word_count: int = 0
    reading_time_minutes: int = 0
    created_at: str = None
    # Research-specific fields
    tools_mentioned: List[dict] = field(default_factory=list)
    methods: List[dict] = field(default_factory=list)
    opportunities: List[dict] = field(default_factory=list)
    web: Optional[dict] = None  # Full web-specific data

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)


class WebAnalyzer:
    """Analyzes web content using LLM"""

    def __init__(self, provider: str = "openai", model: str = None):
        self.provider = provider

        if provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
            self.model = model or "gpt-4o-mini"
        elif provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def analyze(
        self,
        web_content: WebContent,
        research_mode: bool = False
    ) -> WebExtract:
        """
        Analyze web content and extract structured information

        Args:
            web_content: WebContent object from scraper
            research_mode: If True, use research-focused extraction

        Returns:
            WebExtract object with structured data
        """
        # Select prompt
        if research_mode:
            prompt = RESEARCH_EXTRACTION_PROMPT.format(
                title=web_content.title,
                url=web_content.url,
                site_name=web_content.site_name,
                content=web_content.content[:8000]  # Limit content length
            )
        else:
            prompt = WEB_EXTRACTION_PROMPT.format(
                title=web_content.title,
                url=web_content.url,
                site_name=web_content.site_name,
                author=web_content.author or "Unknown",
                published_date=web_content.published_date or "Unknown",
                content=web_content.content[:8000]
            )

        # Call LLM
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

        # Parse response
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Could not parse JSON from response: {content[:500]}")

        # Generate ID
        content_id = f"web_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Build web-specific data
        web_data = {
            "url": web_content.url,
            "site_name": web_content.site_name,
            "author": web_content.author,
            "published_date": web_content.published_date,
            "word_count": web_content.word_count,
            "reading_time_minutes": web_content.reading_time_minutes,
            "images": web_content.images,
            "difficulty_level": data.get("difficulty_level", "all"),
            "target_audience": data.get("target_audience", ""),
            "tools_mentioned": data.get("tools_mentioned", []),
            "methods": data.get("methods", []),
            "opportunities": data.get("opportunities", [])
        }

        return WebExtract(
            id=content_id,
            title=data.get("title", web_content.title),
            summary=data.get("summary", web_content.description),
            content_type=data.get("content_type", "article"),
            mode="web",
            source_url=web_content.url,
            site_name=web_content.site_name,
            author=web_content.author or "",
            published_date=web_content.published_date or "",
            topics=data.get("topics", []),
            key_points=data.get("key_points", []),
            entities=data.get("entities", []),
            action_items=data.get("action_items", data.get("key_takeaways", [])),
            quotes=data.get("quotes", []),
            resources=data.get("resources", []),
            tags=data.get("tags", []),
            full_content=web_content.content,
            word_count=web_content.word_count,
            reading_time_minutes=web_content.reading_time_minutes,
            tools_mentioned=data.get("tools_mentioned", []),
            methods=data.get("methods", []),
            opportunities=data.get("opportunities", []),
            web=web_data
        )


def analyze_url(url: str, research_mode: bool = False, provider: str = "openai") -> WebExtract:
    """
    Convenience function to fetch and analyze a URL

    Args:
        url: The URL to analyze
        research_mode: If True, focus on extracting tools/methods/opportunities
        provider: LLM provider ("openai" or "ollama")

    Returns:
        WebExtract object
    """
    from web_scraper import WebScraper

    print(f"Fetching URL: {url}")
    scraper = WebScraper()
    web_content = scraper.fetch(url)

    print(f"Analyzing content ({web_content.word_count} words)...")
    analyzer = WebAnalyzer(provider=provider)
    extract = analyzer.analyze(web_content, research_mode=research_mode)

    print(f"Extracted: {extract.title}")
    return extract


if __name__ == "__main__":
    # Test
    test_url = "https://example.com"
    try:
        result = analyze_url(test_url)
        print(result.to_json())
    except Exception as e:
        print(f"Error: {e}")
