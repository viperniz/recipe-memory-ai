"""
Web Scraper Module
Fetches and extracts content from web pages for the knowledge base
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from dataclasses import dataclass
from typing import Optional, List
import re
import json


@dataclass
class WebContent:
    """Extracted content from a web page"""
    url: str
    title: str
    description: str
    content: str  # Main text content
    author: Optional[str] = None
    published_date: Optional[str] = None
    site_name: Optional[str] = None
    images: List[str] = None
    word_count: int = 0
    reading_time_minutes: int = 0

    def __post_init__(self):
        if self.images is None:
            self.images = []
        # Calculate reading time (avg 200 words per minute)
        self.word_count = len(self.content.split())
        self.reading_time_minutes = max(1, self.word_count // 200)


class WebScraper:
    """Scrapes and extracts content from web pages"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })

    def fetch(self, url: str, timeout: int = 30) -> WebContent:
        """
        Fetch and extract content from a URL

        Args:
            url: The URL to fetch
            timeout: Request timeout in seconds

        Returns:
            WebContent object with extracted data
        """
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme:
            url = 'https://' + url
        if not parsed.netloc:
            raise ValueError(f"Invalid URL: {url}")

        print(f"Fetching: {url}")

        # Fetch the page
        response = self.session.get(url, timeout=timeout)
        response.raise_for_status()

        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract metadata
        title = self._extract_title(soup)
        description = self._extract_description(soup)
        author = self._extract_author(soup)
        published_date = self._extract_date(soup)
        site_name = self._extract_site_name(soup, url)

        # Extract main content
        content = self._extract_content(soup)

        # Extract images
        images = self._extract_images(soup, url)

        return WebContent(
            url=url,
            title=title,
            description=description,
            content=content,
            author=author,
            published_date=published_date,
            site_name=site_name,
            images=images[:5]  # Limit to 5 images
        )

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title"""
        # Try OpenGraph title first
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            return og_title['content'].strip()

        # Try Twitter title
        tw_title = soup.find('meta', attrs={'name': 'twitter:title'})
        if tw_title and tw_title.get('content'):
            return tw_title['content'].strip()

        # Fall back to title tag
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.get_text().strip()

        # Try h1
        h1 = soup.find('h1')
        if h1:
            return h1.get_text().strip()

        return "Untitled"

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract page description"""
        # Try OpenGraph description
        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content'):
            return og_desc['content'].strip()

        # Try meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            return meta_desc['content'].strip()

        # Try Twitter description
        tw_desc = soup.find('meta', attrs={'name': 'twitter:description'})
        if tw_desc and tw_desc.get('content'):
            return tw_desc['content'].strip()

        return ""

    def _extract_author(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract author name"""
        # Try meta author
        meta_author = soup.find('meta', attrs={'name': 'author'})
        if meta_author and meta_author.get('content'):
            return meta_author['content'].strip()

        # Try article:author
        article_author = soup.find('meta', property='article:author')
        if article_author and article_author.get('content'):
            return article_author['content'].strip()

        # Try common author class patterns
        for selector in ['.author', '.byline', '[rel="author"]', '.post-author']:
            author_elem = soup.select_one(selector)
            if author_elem:
                text = author_elem.get_text().strip()
                # Clean up common prefixes
                text = re.sub(r'^(by|written by|author:)\s*', '', text, flags=re.IGNORECASE)
                if text and len(text) < 100:
                    return text

        return None

    def _extract_date(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract publication date"""
        # Try article:published_time
        pub_time = soup.find('meta', property='article:published_time')
        if pub_time and pub_time.get('content'):
            return pub_time['content'][:10]  # Just the date part

        # Try datePublished schema
        time_elem = soup.find('time', attrs={'datetime': True})
        if time_elem:
            return time_elem['datetime'][:10]

        return None

    def _extract_site_name(self, soup: BeautifulSoup, url: str) -> str:
        """Extract site name"""
        # Try OpenGraph site_name
        og_site = soup.find('meta', property='og:site_name')
        if og_site and og_site.get('content'):
            return og_site['content'].strip()

        # Fall back to domain
        parsed = urlparse(url)
        return parsed.netloc.replace('www.', '')

    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main text content"""
        # Remove unwanted elements
        for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer',
                                       'aside', 'form', 'noscript', 'iframe']):
            element.decompose()

        # Try to find article content
        article = soup.find('article')
        if article:
            content_elem = article
        else:
            # Try common content selectors
            for selector in ['.post-content', '.article-content', '.entry-content',
                           '.content', 'main', '#content', '.post-body']:
                content_elem = soup.select_one(selector)
                if content_elem:
                    break
            else:
                # Fall back to body
                content_elem = soup.find('body')

        if not content_elem:
            return ""

        # Extract text with some structure
        paragraphs = []
        for elem in content_elem.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote']):
            text = elem.get_text().strip()
            if text and len(text) > 20:  # Filter out short noise
                if elem.name.startswith('h'):
                    paragraphs.append(f"\n## {text}\n")
                elif elem.name == 'blockquote':
                    paragraphs.append(f"> {text}")
                elif elem.name == 'li':
                    paragraphs.append(f"• {text}")
                else:
                    paragraphs.append(text)

        content = '\n\n'.join(paragraphs)

        # Clean up excessive whitespace
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = re.sub(r' {2,}', ' ', content)

        return content.strip()

    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract relevant images"""
        images = []

        # Try OpenGraph image first
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            images.append(og_image['content'])

        # Get images from content
        for img in soup.find_all('img', src=True):
            src = img['src']
            # Convert relative URLs to absolute
            if not src.startswith(('http://', 'https://')):
                src = urljoin(base_url, src)

            # Filter out tiny images (likely icons)
            width = img.get('width', '100')
            height = img.get('height', '100')
            try:
                if int(width) < 100 or int(height) < 100:
                    continue
            except (ValueError, TypeError):
                pass

            if src not in images:
                images.append(src)

        return images


# Convenience function
def fetch_url(url: str) -> WebContent:
    """Fetch and extract content from a URL"""
    scraper = WebScraper()
    return scraper.fetch(url)


if __name__ == "__main__":
    # Test
    test_url = "https://example.com"
    try:
        content = fetch_url(test_url)
        print(f"Title: {content.title}")
        print(f"Description: {content.description}")
        print(f"Author: {content.author}")
        print(f"Word count: {content.word_count}")
        print(f"Reading time: {content.reading_time_minutes} min")
        print(f"\nContent preview:\n{content.content[:500]}...")
    except Exception as e:
        print(f"Error: {e}")
