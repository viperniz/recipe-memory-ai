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

PRD_PROMPT = """You are a senior product manager. Generate a comprehensive Product Requirements Document (PRD) based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured PRD as a JSON object:
{{
    "product_name": "Name of the product or feature",
    "version": "1.0",
    "overview": "High-level description of the product/feature",
    "background_context": "Why now? Strategic fit, competitive landscape, and market context that motivates this product/feature",
    "problem_statement": "What problem this solves and why it matters",
    "goals": ["Goal 1", "Goal 2"],
    "target_users": "Description of the target user persona(s)",
    "user_stories": [
        {{
            "persona": "As a [user type]",
            "action": "I want to [action]",
            "benefit": "So that [benefit/reason]"
        }}
    ],
    "requirements": {{
        "functional": [
            {{
                "id": "FR-001",
                "title": "Requirement title",
                "description": "Detailed description",
                "priority": "must_have|should_have|nice_to_have",
                "acceptance_criteria": [
                    {{
                        "given": "Some precondition or context",
                        "when": "An action is performed",
                        "then": "Expected outcome"
                    }}
                ]
            }}
        ],
        "non_functional": [
            {{
                "id": "NFR-001",
                "title": "Requirement title",
                "description": "Detailed description",
                "category": "performance|security|reliability|usability|accessibility|maintainability|scalability|compatibility"
            }}
        ]
    }},
    "assumptions": [
        {{
            "assumption": "Something assumed to be true",
            "impact": "What happens if this assumption is wrong",
            "validation": "How to verify this assumption"
        }}
    ],
    "constraints": [
        {{
            "constraint": "A limiting factor",
            "type": "technical|business|regulatory|resource",
            "impact": "How this constrains the solution"
        }}
    ],
    "dependencies": [
        {{
            "dependency": "External dependency name",
            "type": "external_api|team|system|third_party",
            "status": "ready|blocked|unknown",
            "detail": "Additional context"
        }}
    ],
    "risks": [
        {{
            "risk": "Risk description",
            "category": "value|usability|feasibility|viability",
            "probability": "high|medium|low",
            "impact": "high|medium|low",
            "mitigation": "Mitigation strategy"
        }}
    ],
    "open_questions": [
        {{
            "question": "An unresolved question",
            "priority": "high|medium|low",
            "context": "Why this question matters and who might answer it"
        }}
    ],
    "release_strategy": {{
        "phases": [
            {{
                "name": "Phase name (e.g. Alpha, Beta, GA)",
                "scope": "What is included in this phase",
                "success_criteria": "How to know this phase succeeded"
            }}
        ],
        "feature_flags": ["flag_name_1"],
        "rollback_plan": "How to roll back if something goes wrong"
    }},
    "success_metrics": [
        {{
            "metric": "KPI name",
            "target": "Measurable target value",
            "measurement_method": "How and when to measure"
        }}
    ],
    "technical_considerations": "Architecture notes and technical constraints",
    "out_of_scope": ["Excluded item 1"],
    "timeline": "Estimated timeline for delivery",
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source informed the PRD"
        }}
    ]
}}

IMPORTANT:
- Include at least 5 functional requirements and at least 2 non-functional requirements
- Include at least 3 user stories covering different personas or workflows
- Write acceptance criteria in Given/When/Then (Gherkin) format — each criterion must have all three fields
- Use sequential IDs (FR-001, FR-002, ... and NFR-001, NFR-002, ...)
- Prioritize requirements realistically — not everything is must_have
- Include at least 3 assumptions with validation approaches
- Include at least 2 constraints
- Include at least 2 dependencies with their current status
- Include at least 3 risks across different categories (value, usability, feasibility, viability) with mitigations
- Include at least 2 open questions with priority levels
- Include a release strategy with at least 2 phases
- Success metrics must have measurable targets and measurement methods
- Return ONLY the JSON object, no other text"""

SWOT_PROMPT = """You are a strategic analyst. Generate a comprehensive SWOT analysis based on the provided source materials.

SOURCE MATERIALS:
{source_context}

{web_context_section}

FOCUS AREA: {focus_area}

Generate a structured SWOT analysis as a JSON object:
{{
    "subject": "What is being analyzed",
    "overview": "Brief context setting the stage for the analysis",
    "strengths": [
        {{
            "point": "Strength title",
            "detail": "Evidence and explanation from the sources"
        }}
    ],
    "weaknesses": [
        {{
            "point": "Weakness title",
            "detail": "Evidence and explanation from the sources"
        }}
    ],
    "opportunities": [
        {{
            "point": "Opportunity title",
            "detail": "Evidence and explanation from the sources"
        }}
    ],
    "threats": [
        {{
            "point": "Threat title",
            "detail": "Evidence and explanation from the sources"
        }}
    ],
    "strategic_recommendations": [
        {{
            "strategy": "Strategy name",
            "description": "Action steps and rationale",
            "quadrants": "SO|ST|WO|WT"
        }}
    ],
    "conclusion": "Overall strategic assessment and key takeaways",
    "references": [
        {{
            "source_id": "ID of the source",
            "title": "Title of the source",
            "relevance": "How this source informed the analysis"
        }}
    ]
}}

IMPORTANT:
- Include at least 3 items per quadrant (strengths, weaknesses, opportunities, threats)
- Include at least 3 strategic recommendations
- Label each recommendation with its quadrant combination (SO = leverage strengths for opportunities, ST = use strengths to counter threats, WO = address weaknesses through opportunities, WT = mitigate weaknesses against threats)
- Ground every point in evidence from the sources — don't make generic statements
- Return ONLY the JSON object, no other text"""

REPORT_PROMPTS = {
    "thesis": THESIS_PROMPT,
    "development_plan": DEVELOPMENT_PLAN_PROMPT,
    "script": SCRIPT_PROMPT,
    "executive_brief": EXECUTIVE_BRIEF_PROMPT,
    "prd": PRD_PROMPT,
    "swot": SWOT_PROMPT,
}

# Feature flag name for each report type
REPORT_FEATURE_FLAGS = {
    "thesis": "report_thesis",
    "development_plan": "report_development_plan",
    "script": "report_script",
    "executive_brief": "report_executive_brief",
    "prd": "report_prd",
    "swot": "report_swot",
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
        web_sources = []
        if config.get("web_enrichment"):
            topic = config.get("focus_area") or self._infer_topic(sources)
            manual_urls = config.get("manual_urls", [])
            web_context, web_sources = self._enrich_with_web(topic, manual_urls, source_context)

        # Build prompt
        prompt = self._get_prompt(report_type, source_context, web_context, config)

        # Call LLM
        result = self._call_llm(prompt)

        # Ensure references is populated
        if "references" not in result:
            result["references"] = [
                {"source_id": s.get("id", ""), "title": s.get("title", "Untitled"), "relevance": "Source material"}
                for s in sources
            ]

        # Append web sources to references (deduplicate by title)
        existing_titles = {r.get("title", "").lower() for r in result.get("references", [])}
        for ws in web_sources:
            if ws["title"].lower() not in existing_titles:
                result.setdefault("references", []).append({
                    "source_id": ws["url"],
                    "title": ws["title"],
                    "relevance": "Web research used for enrichment/cross-reference",
                })
            else:
                # Update existing reference with URL if it used a placeholder source_id
                for ref in result.get("references", []):
                    if ref.get("title", "").lower() == ws["title"].lower() and "http" not in str(ref.get("source_id", "")):
                        ref["source_id"] = ws["url"]
                        break

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
        """Infer search query from source tags and topics.

        Uses tags and topics only — these are subject-matter keywords
        extracted during content analysis. Entities (people, brands) are
        excluded because they lead to biographical/product pages instead
        of useful supplementary research.
        """
        all_tags = []
        all_topics = []
        seen = set()

        for src in sources[:5]:
            for tag in src.get("tags", []):
                tag_lower = tag.lower()
                if tag_lower not in seen:
                    seen.add(tag_lower)
                    all_tags.append(tag)
            for tp in src.get("topics", []):
                tp_lower = tp.lower()
                if tp_lower not in seen:
                    seen.add(tp_lower)
                    all_topics.append(tp)

        # Build query: tags first (most search-friendly), then topics
        # Keep it concise — long queries dilute search relevance
        keywords = all_tags[:5] + all_topics[:3]

        if keywords:
            query = " ".join(keywords)
            print(f"[ReportGenerator] Inferred search query from metadata: {query[:80]}")
            return query[:80]

        # Last resort: extract key phrases from titles
        titles = [src.get("title", "") for src in sources[:3] if src.get("title")]
        if not titles:
            return ""

        stop_words = {
            "a", "an", "the", "is", "are", "was", "were", "of", "to", "in",
            "for", "on", "with", "and", "or", "but", "by", "at", "from",
            "how", "what", "why", "when", "where", "who", "which", "that",
            "this", "your", "my", "our", "their", "his", "her", "its",
            "simple", "guide", "complete", "ultimate", "best", "top",
            "introduction", "overview", "part", "episode",
        }
        import re
        words = re.findall(r'[a-zA-Z0-9]+', " ".join(titles).lower())
        unique_words = []
        word_seen = set()
        for w in words:
            if w not in stop_words and len(w) > 2 and w not in word_seen:
                word_seen.add(w)
                unique_words.append(w)

        return " ".join(unique_words[:8])[:100]

    def _enrich_with_web(self, topic: str, manual_urls: list, source_context: str) -> tuple:
        """Fetch web content to enrich the report.

        Returns:
            (web_context_str, web_sources_list) where web_sources_list is
            a list of {"title": ..., "url": ...} dicts for references.
        """
        web_parts = []
        web_sources = []

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
                    web_sources.append({"title": content.title, "url": content.url})
                except Exception as e:
                    print(f"[ReportGenerator] Failed to fetch {url}: {e}")

        # Auto web search if topic is available
        if topic:
            try:
                from ddgs import DDGS
                search_results = list(DDGS().text(topic, max_results=4))
                print(f"[ReportGenerator] DuckDuckGo returned {len(search_results)} results for: {topic}")
                from web_scraper import WebScraper
                scraper = WebScraper()
                for sr in search_results:
                    if len(web_parts) >= 4:
                        break
                    link = sr.get("href", "")
                    title = sr.get("title", "")
                    body = sr.get("body", "")
                    if not link:
                        continue
                    try:
                        content = scraper.fetch(link)
                        web_parts.append(
                            f"--- WEB RESEARCH: {content.title} ---\n"
                            f"URL: {content.url}\n"
                            f"Content: {content.content[:2000]}\n"
                        )
                        web_sources.append({"title": content.title, "url": content.url})
                    except Exception:
                        # Fall back to search snippet if page fetch fails
                        if body:
                            web_parts.append(
                                f"--- WEB RESEARCH: {title} ---\n"
                                f"URL: {link}\n"
                                f"Content: {body}\n"
                            )
                            web_sources.append({"title": title, "url": link})
            except Exception as e:
                print(f"[ReportGenerator] Web search error: {e}")

        if web_parts:
            return "\n\n".join(web_parts), web_sources
        return "", web_sources

    def _get_prompt(self, report_type: str, source_context: str, web_context: str, config: dict) -> str:
        """Build the final prompt for the LLM."""
        template = REPORT_PROMPTS[report_type]

        web_section = ""
        if web_context:
            web_section = (
                f"ADDITIONAL WEB RESEARCH:\n{web_context}\n\n"
                f"IMPORTANT: Cross-reference the web research against the video/source material above. "
                f"Explicitly note where the web findings CONFIRM, CONTRADICT, or ADD NEW CONTEXT "
                f"to what was found in the sources. Highlight any gaps or discrepancies between the two."
            )

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
