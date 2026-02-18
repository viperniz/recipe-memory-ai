"""
Report Generator Module
Generates structured reports (Thesis, Development Plan, Script, Executive Brief)
from source content and optional web enrichment.
"""

import json
from typing import List, Optional
from datetime import datetime


# =============================================
# Report Type Prompts
# =============================================

THESIS_PROMPT = """You are an expert academic analyst. Generate a comprehensive thesis-style analysis based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured academic analysis as a JSON object:
{{
    "abstract": "A 150-200 word abstract summarizing the entire analysis",
    "thesis_statement": "A clear, arguable thesis statement derived from the sources",
    "introduction": "Introduction paragraph establishing context and significance",
    "literature_context": "Summary of existing knowledge and how these sources contribute",
    "methodology": "Brief description of analytical approach taken",
    "arguments": [
        {{
            "claim": "Main argument or finding",
            "evidence": "Supporting evidence from the sources with citations",
            "analysis": "Interpretation and significance of this evidence"
        }}
    ],
    "counterarguments": [
        {{
            "point": "Potential counterargument or limitation",
            "response": "How the evidence addresses or acknowledges this"
        }}
    ],
    "synthesis": "How the arguments together support the thesis",
    "conclusion": "Final conclusions and implications",
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source contributed to the analysis"
        }}
    ]
}}

IMPORTANT:
- Cite sources by their title when referencing evidence
- Include at least 3 arguments with evidence
- Be analytically rigorous — don't just summarize, interpret and evaluate
- Return ONLY the JSON object, no other text"""

DEVELOPMENT_PLAN_PROMPT = """You are a senior technical architect. Generate a comprehensive development plan / technical roadmap based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured development plan as a JSON object:
{{
    "executive_summary": "2-3 sentence overview of the plan",
    "objectives": ["Primary objective 1", "Primary objective 2"],
    "current_state_analysis": "Assessment of the current situation based on sources",
    "phases": [
        {{
            "name": "Phase name",
            "goals": ["Goal 1", "Goal 2"],
            "tasks": [
                {{
                    "task": "Task description",
                    "priority": "high|medium|low",
                    "details": "Implementation details"
                }}
            ],
            "deliverables": ["Deliverable 1"],
            "duration": "Estimated duration (e.g., '2 weeks')"
        }}
    ],
    "resource_requirements": [
        {{
            "resource": "Resource name",
            "type": "tool|skill|infrastructure|personnel",
            "details": "Why it's needed"
        }}
    ],
    "risk_assessment": [
        {{
            "risk": "Risk description",
            "probability": "high|medium|low",
            "impact": "high|medium|low",
            "mitigation": "Mitigation strategy"
        }}
    ],
    "success_metrics": ["Metric 1", "Metric 2"],
    "timeline_summary": "High-level timeline overview",
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source informed the plan"
        }}
    ]
}}

IMPORTANT:
- Create at least 3 phases with concrete tasks
- Include realistic timelines based on the complexity described in sources
- Identify at least 3 risks with mitigations
- Return ONLY the JSON object, no other text"""

SCRIPT_PROMPT = """You are an expert content creator and scriptwriter. Generate a polished video/podcast script based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured script as a JSON object:
{{
    "title": "Compelling title for the content",
    "hook": "Attention-grabbing opening (first 30 seconds)",
    "target_audience": "Who this content is for",
    "estimated_duration": "Estimated runtime (e.g., '8-10 minutes')",
    "sections": [
        {{
            "title": "Section title",
            "content": "Full script text for this section (written naturally, not bullet points)",
            "visual_notes": "Suggested visuals, B-roll, or graphics for this section",
            "transition": "Transition line to next section"
        }}
    ],
    "call_to_action": "Clear CTA for the audience",
    "outro": "Closing remarks",
    "production_notes": ["Production tip 1", "Production tip 2"],
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source was used in the script"
        }}
    ]
}}

IMPORTANT:
- Write in a natural, engaging tone — this should sound good when spoken aloud
- Include at least 4 sections with full script text (not just outlines)
- Add visual notes for each section to guide production
- The hook must grab attention immediately
- Return ONLY the JSON object, no other text"""

EXECUTIVE_BRIEF_PROMPT = """You are a senior consultant preparing a decision-making document for executives. Generate a concise executive brief based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured executive brief as a JSON object:
{{
    "title": "Brief title that captures the core decision/topic",
    "date": "{date}",
    "situation_overview": "Concise description of the current situation (2-3 paragraphs)",
    "key_findings": [
        {{
            "finding": "Key finding",
            "significance": "Why this matters for decision-making"
        }}
    ],
    "analysis": "Deeper analysis connecting the findings",
    "options": [
        {{
            "option": "Option name/description",
            "pros": ["Advantage 1", "Advantage 2"],
            "cons": ["Disadvantage 1"],
            "cost": "Cost estimate or resource implications",
            "timeline": "Implementation timeline"
        }}
    ],
    "recommendation": "Clear recommendation with justification",
    "next_steps": ["Immediate action 1", "Immediate action 2"],
    "appendix_notes": "Any additional context or caveats",
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source informed the brief"
        }}
    ]
}}

IMPORTANT:
- Be concise and direct — executives want clarity, not length
- Present at least 2-3 viable options with honest pros/cons
- Make a clear recommendation with reasoning
- Include specific, actionable next steps
- Return ONLY the JSON object, no other text"""

REPORT_PROMPTS = {
    "thesis": THESIS_PROMPT,
    "development_plan": DEVELOPMENT_PLAN_PROMPT,
    "script": SCRIPT_PROMPT,
    "executive_brief": EXECUTIVE_BRIEF_PROMPT,
}

# Feature flag name for each report type
REPORT_FEATURE_FLAGS = {
    "thesis": "report_thesis",
    "development_plan": "report_development_plan",
    "script": "report_script",
    "executive_brief": "report_executive_brief",
}


class ReportGenerator:
    """Generates structured reports from source content."""

    def __init__(self, provider: str = "openai", tier: str = "free"):
        self.provider = provider
        self.tier = tier

        if provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
            if tier in ("pro", "team"):
                self.model = "gpt-4o"
            else:
                self.model = "gpt-4o-mini"
        elif provider == "ollama":
            import ollama
            self.client = ollama
            self.model = "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def generate(self, report_type: str, sources: list, config: dict) -> dict:
        """
        Generate a report from source materials.

        Args:
            report_type: One of thesis, development_plan, script, executive_brief
            sources: List of source dicts (from ContentVector.full_content)
            config: Generation settings (web_enrichment, manual_urls, focus_area, etc.)

        Returns:
            dict — the structured report result
        """
        if report_type not in REPORT_PROMPTS:
            raise ValueError(f"Unknown report type: {report_type}")

        # Build source context
        source_context = self._build_source_context(sources)

        # Web enrichment
        web_context = ""
        if config.get("web_enrichment"):
            topic = config.get("focus_area") or self._infer_topic(sources)
            manual_urls = config.get("manual_urls", [])
            web_context = self._enrich_with_web(topic, manual_urls, source_context)

        # Build prompt
        prompt = self._get_prompt(report_type, source_context, web_context, config)

        # Call LLM
        result = self._call_llm(prompt)

        # Ensure sources_used is populated
        if "references" not in result:
            result["references"] = [
                {"source_id": s.get("id", ""), "title": s.get("title", "Untitled"), "relevance": "Source material"}
                for s in sources
            ]

        return result

    def _build_source_context(self, sources: list) -> str:
        """Concatenate source content into a context string."""
        parts = []
        for i, src in enumerate(sources, 1):
            title = src.get("title", "Untitled")
            src_id = src.get("id", f"source_{i}")
            summary = src.get("summary", "")
            key_points = src.get("key_points", [])
            transcript = src.get("transcript", "")

            part = f"--- SOURCE {i}: {title} (ID: {src_id}) ---\n"
            if summary:
                part += f"Summary: {summary}\n\n"
            if key_points:
                part += "Key Points:\n"
                for kp in key_points:
                    if isinstance(kp, dict):
                        part += f"  - {kp.get('point', kp.get('title', str(kp)))}\n"
                    else:
                        part += f"  - {kp}\n"
                part += "\n"
            if transcript:
                # Limit transcript to prevent token overflow
                truncated = transcript[:4000]
                if len(transcript) > 4000:
                    truncated += "\n... [transcript truncated]"
                part += f"Transcript excerpt:\n{truncated}\n"

            parts.append(part)

        return "\n\n".join(parts)

    def _infer_topic(self, sources: list) -> str:
        """Infer a search topic from source titles and topics."""
        titles = [s.get("title", "") for s in sources]
        topics = []
        for s in sources:
            topics.extend(s.get("topics", []))
        combined = " ".join(titles[:3] + topics[:5])
        return combined[:200]

    def _enrich_with_web(self, topic: str, manual_urls: list, source_context: str) -> str:
        """Fetch web content to enrich the report."""
        web_parts = []

        # Fetch manual URLs
        if manual_urls:
            from web_scraper import WebScraper
            scraper = WebScraper()
            for url in manual_urls[:5]:  # Limit to 5 URLs
                try:
                    content = scraper.fetch(url)
                    web_parts.append(
                        f"--- WEB SOURCE: {content.title} ---\n"
                        f"URL: {content.url}\n"
                        f"Content: {content.content[:3000]}\n"
                    )
                except Exception as e:
                    print(f"[ReportGenerator] Failed to fetch {url}: {e}")

        # Auto web search if topic is available
        if topic:
            try:
                from web_scraper import WebScraper
                import requests
                # Use a simple search approach — fetch top results via DuckDuckGo Lite
                scraper = WebScraper()
                search_url = f"https://lite.duckduckgo.com/lite/?q={requests.utils.quote(topic)}"
                try:
                    resp = scraper.session.get(search_url, timeout=10)
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    links = []
                    for a in soup.find_all('a', href=True):
                        href = a['href']
                        if href.startswith('http') and 'duckduckgo' not in href:
                            links.append(href)
                    # Fetch first 2 unique results
                    seen = set()
                    for link in links[:5]:
                        if link in seen:
                            continue
                        seen.add(link)
                        if len(web_parts) >= 4:
                            break
                        try:
                            content = scraper.fetch(link)
                            web_parts.append(
                                f"--- WEB RESEARCH: {content.title} ---\n"
                                f"URL: {content.url}\n"
                                f"Content: {content.content[:2000]}\n"
                            )
                        except Exception:
                            continue
                except Exception as e:
                    print(f"[ReportGenerator] Web search failed: {e}")
            except Exception as e:
                print(f"[ReportGenerator] Web enrichment error: {e}")

        if web_parts:
            return "\n\n".join(web_parts)
        return ""

    def _get_prompt(self, report_type: str, source_context: str, web_context: str, config: dict) -> str:
        """Build the final prompt for the LLM."""
        template = REPORT_PROMPTS[report_type]

        web_section = ""
        if web_context:
            web_section = f"ADDITIONAL WEB RESEARCH:\n{web_context}"

        focus = config.get("focus_area", "Provide a comprehensive analysis based on the source materials.")

        prompt = template.format(
            source_context=source_context,
            web_context_section=web_section,
            focus_area=focus,
            date=datetime.now().strftime("%Y-%m-%d"),
        )
        return prompt

    def _call_llm(self, prompt: str) -> dict:
        """Call the LLM and parse JSON response."""
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            content = response.choices[0].message.content
        else:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format="json",
            )
            content = response["message"]["content"]

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"Could not parse report JSON from LLM response")
