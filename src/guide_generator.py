"""
Step-by-Step Guide Generator
Creates complete, actionable guides from extracted content for AI coders
Fills in missing installation steps, prerequisites, and commands
"""

import json
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime


GUIDE_GENERATION_PROMPT = """You are an expert technical writer creating step-by-step guides for developers and AI coders.

Given the following content about a tool, method, or tutorial, create a COMPLETE step-by-step guide that includes ALL the details someone would need to actually implement this.

IMPORTANT: Articles often skip basic steps. You MUST fill in:
- System requirements and prerequisites
- Exact installation commands (npm, pip, etc.)
- Environment setup (.env files, API keys, config)
- Complete code examples (not snippets)
- Common errors and how to fix them
- Verification steps to confirm it's working

SOURCE CONTENT:
Title: {title}
Summary: {summary}
Content Type: {content_type}
Source URL: {source_url}

Key Points:
{key_points}

Tools Mentioned:
{tools}

Methods/Steps from source:
{methods}

Full Content:
{full_content}

---

Generate a comprehensive step-by-step guide in this JSON format:
{{
    "title": "How to [action] with [tool/method]",
    "description": "Brief description of what this guide accomplishes",
    "difficulty": "beginner|intermediate|advanced",
    "estimated_time": "X minutes/hours",
    "prerequisites": [
        {{
            "item": "Prerequisite name",
            "description": "Why it's needed",
            "install_command": "Command to install if applicable",
            "check_command": "Command to verify it's installed"
        }}
    ],
    "environment_setup": [
        {{
            "step": "Step description",
            "commands": ["command1", "command2"],
            "notes": "Additional context"
        }}
    ],
    "steps": [
        {{
            "step_number": 1,
            "title": "Step title",
            "description": "What this step does and why",
            "commands": ["exact command to run"],
            "code": "any code to write/create",
            "code_language": "python|javascript|bash|etc",
            "expected_output": "What you should see",
            "troubleshooting": [
                {{
                    "issue": "Common problem",
                    "solution": "How to fix it"
                }}
            ]
        }}
    ],
    "verification": {{
        "description": "How to verify everything works",
        "commands": ["verification command"],
        "expected_result": "What success looks like"
    }},
    "next_steps": ["What to do after completing this guide"],
    "resources": [
        {{
            "name": "Resource name",
            "url": "URL",
            "description": "What it's for"
        }}
    ]
}}

Be THOROUGH. Include every command, every file, every configuration.
Assume the reader is starting from scratch.
Return ONLY the JSON object."""


@dataclass
class StepByStepGuide:
    """Generated step-by-step guide"""
    id: str
    source_content_id: str
    title: str
    description: str
    difficulty: str
    estimated_time: str
    prerequisites: List[Dict]
    environment_setup: List[Dict]
    steps: List[Dict]
    verification: Dict
    next_steps: List[str]
    resources: List[Dict]
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

    def to_dict(self):
        return asdict(self)

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)

    def to_markdown(self) -> str:
        """Export guide as markdown for easy copy-paste"""
        lines = []

        # Header
        lines.append(f"# {self.title}\n")
        lines.append(f"{self.description}\n")
        lines.append(f"**Difficulty:** {self.difficulty} | **Time:** {self.estimated_time}\n")

        # Prerequisites
        if self.prerequisites:
            lines.append("\n## Prerequisites\n")
            for prereq in self.prerequisites:
                lines.append(f"### {prereq.get('item', 'Requirement')}")
                lines.append(f"{prereq.get('description', '')}\n")
                if prereq.get('install_command'):
                    lines.append("**Install:**")
                    lines.append(f"```bash\n{prereq['install_command']}\n```\n")
                if prereq.get('check_command'):
                    lines.append("**Verify:**")
                    lines.append(f"```bash\n{prereq['check_command']}\n```\n")

        # Environment Setup
        if self.environment_setup:
            lines.append("\n## Environment Setup\n")
            for setup in self.environment_setup:
                lines.append(f"### {setup.get('step', 'Setup')}")
                if setup.get('commands'):
                    lines.append("```bash")
                    for cmd in setup['commands']:
                        lines.append(cmd)
                    lines.append("```\n")
                if setup.get('notes'):
                    lines.append(f"> {setup['notes']}\n")

        # Steps
        lines.append("\n## Steps\n")
        for step in self.steps:
            step_num = step.get('step_number', '')
            lines.append(f"### Step {step_num}: {step.get('title', '')}\n")
            lines.append(f"{step.get('description', '')}\n")

            if step.get('commands'):
                lines.append("**Commands:**")
                lines.append("```bash")
                for cmd in step['commands']:
                    lines.append(cmd)
                lines.append("```\n")

            if step.get('code'):
                lang = step.get('code_language', '')
                lines.append("**Code:**")
                lines.append(f"```{lang}")
                lines.append(step['code'])
                lines.append("```\n")

            if step.get('expected_output'):
                lines.append(f"**Expected Output:** {step['expected_output']}\n")

            if step.get('troubleshooting'):
                lines.append("**Troubleshooting:**")
                for issue in step['troubleshooting']:
                    lines.append(f"- **{issue.get('issue', 'Issue')}:** {issue.get('solution', '')}")
                lines.append("")

        # Verification
        if self.verification:
            lines.append("\n## Verification\n")
            lines.append(f"{self.verification.get('description', '')}\n")
            if self.verification.get('commands'):
                lines.append("```bash")
                for cmd in self.verification['commands']:
                    lines.append(cmd)
                lines.append("```\n")
            if self.verification.get('expected_result'):
                lines.append(f"**Expected Result:** {self.verification['expected_result']}\n")

        # Next Steps
        if self.next_steps:
            lines.append("\n## Next Steps\n")
            for ns in self.next_steps:
                lines.append(f"- {ns}")
            lines.append("")

        # Resources
        if self.resources:
            lines.append("\n## Resources\n")
            for res in self.resources:
                name = res.get('name', 'Resource')
                url = res.get('url', '')
                desc = res.get('description', '')
                if url:
                    lines.append(f"- [{name}]({url}) - {desc}")
                else:
                    lines.append(f"- **{name}** - {desc}")
            lines.append("")

        return "\n".join(lines)


class GuideGenerator:
    """Generates step-by-step guides from content"""

    def __init__(self, provider: str = "openai", model: str = None):
        self.provider = provider

        if provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
            self.model = model or "gpt-4o"  # Use GPT-4 for better guide generation
        elif provider == "ollama":
            import ollama
            self.client = ollama
            self.model = model or "llama3.1"
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def generate(self, content: Dict[str, Any]) -> StepByStepGuide:
        """
        Generate a step-by-step guide from content

        Args:
            content: Content dict from VectorMemory

        Returns:
            StepByStepGuide object
        """
        # Extract relevant info from content
        title = content.get('title', 'Untitled')
        summary = content.get('summary', '')
        content_type = content.get('content_type', 'article')
        source_url = content.get('source_url', content.get('url', ''))

        # Key points
        key_points = content.get('key_points', [])
        kp_text = "\n".join([
            f"- {kp.get('point', str(kp)) if isinstance(kp, dict) else str(kp)}"
            for kp in key_points
        ])

        # Tools mentioned
        tools = content.get('tools_mentioned', [])
        if not tools and content.get('web'):
            tools = content['web'].get('tools_mentioned', [])
        tools_text = "\n".join([
            f"- {t.get('name', '')}: {t.get('description', '')} (Pricing: {t.get('pricing', 'Unknown')})"
            for t in tools
        ]) if tools else "None mentioned"

        # Methods
        methods = content.get('methods', [])
        if not methods and content.get('web'):
            methods = content['web'].get('methods', [])
        methods_text = ""
        for m in methods:
            methods_text += f"\nMethod: {m.get('method', '')}\n"
            steps = m.get('steps', [])
            for i, step in enumerate(steps, 1):
                methods_text += f"  {i}. {step}\n"
        if not methods_text:
            methods_text = "No specific methods extracted"

        # Full content (transcript or article text)
        full_content = content.get('full_content', content.get('transcript', ''))[:6000]

        # Build prompt
        prompt = GUIDE_GENERATION_PROMPT.format(
            title=title,
            summary=summary,
            content_type=content_type,
            source_url=source_url,
            key_points=kp_text or "None",
            tools=tools_text,
            methods=methods_text,
            full_content=full_content or "No full content available"
        )

        # Call LLM
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=4000
            )
            result = response.choices[0].message.content
        else:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                format="json"
            )
            result = response["message"]["content"]

        # Parse response
        try:
            data = json.loads(result)
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', result, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError(f"Could not parse JSON from response: {result[:500]}")

        # Create guide
        guide_id = f"guide_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return StepByStepGuide(
            id=guide_id,
            source_content_id=content.get('id', ''),
            title=data.get('title', f"Guide: {title}"),
            description=data.get('description', summary),
            difficulty=data.get('difficulty', 'intermediate'),
            estimated_time=data.get('estimated_time', 'Unknown'),
            prerequisites=data.get('prerequisites', []),
            environment_setup=data.get('environment_setup', []),
            steps=data.get('steps', []),
            verification=data.get('verification', {}),
            next_steps=data.get('next_steps', []),
            resources=data.get('resources', [])
        )


def generate_guide_from_content(content: Dict[str, Any], provider: str = "openai") -> StepByStepGuide:
    """
    Convenience function to generate a guide from content

    Args:
        content: Content dict
        provider: LLM provider

    Returns:
        StepByStepGuide object
    """
    generator = GuideGenerator(provider=provider)
    return generator.generate(content)


if __name__ == "__main__":
    # Test with sample content
    test_content = {
        "id": "test_123",
        "title": "Building a RAG System with LangChain",
        "summary": "Tutorial on creating a retrieval-augmented generation system",
        "content_type": "tutorial",
        "key_points": [
            {"point": "Use ChromaDB for vector storage"},
            {"point": "OpenAI embeddings for text encoding"},
            {"point": "LangChain for orchestration"}
        ],
        "tools_mentioned": [
            {"name": "LangChain", "description": "LLM orchestration framework", "pricing": "Free"},
            {"name": "ChromaDB", "description": "Vector database", "pricing": "Free"}
        ],
        "full_content": "This tutorial covers building a RAG system..."
    }

    try:
        guide = generate_guide_from_content(test_content)
        print(guide.to_markdown())
    except Exception as e:
        print(f"Error: {e}")
