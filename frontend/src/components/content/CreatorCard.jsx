import React, { useState } from 'react'
import { Video, Quote, Scissors, Twitter, Linkedin, FileText, Hash, Clock, Copy, Check, ChevronDown, ChevronRight, ExternalLink, Heart, Eye, ThumbsUp, MessageSquare } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import TimestampLink from './TimestampLink'

function CreatorCard({ creator, sourceUrl }) {
  const [expandedSections, setExpandedSections] = useState({
    clips: true,
    quotes: true,
    thread: false,
    linkedin: false,
    blog: false
  })
  const [copiedItem, setCopiedItem] = useState(null)

  if (!creator) return null

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const copyToClipboard = async (text, itemId) => {
    await navigator.clipboard.writeText(text)
    setCopiedItem(itemId)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const formatNumber = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const metrics = creator.performance_metrics
  const ytChannel = creator.youtube_stats?.channel

  const emotionColors = {
    surprise: 'bg-yellow-500/20 text-yellow-400',
    inspiration: 'bg-blue-500/20 text-blue-400',
    humor: 'bg-green-500/20 text-green-400',
    outrage: 'bg-red-500/20 text-red-400',
    curiosity: 'bg-purple-500/20 text-purple-400'
  }

  return (
    <div className="creator-card">
      {/* Header */}
      <div className="creator-header">
        <h1 className="creator-title">{creator.title}</h1>
        <div className="creator-meta">
          {creator.content_type && (
            <Badge variant="outline">{creator.content_type}</Badge>
          )}
          {creator.duration_minutes > 0 && (
            <span className="creator-duration">
              <Clock className="w-4 h-4" />
              {creator.duration_minutes} min
            </span>
          )}
        </div>
        {creator.host && (
          <div className="creator-host">Host: {creator.host}</div>
        )}
        {creator.guests && creator.guests.length > 0 && (
          <div className="creator-guests">
            Guests: {creator.guests.join(', ')}
          </div>
        )}
      </div>

      {/* Creator Attribution — support the original creator */}
      {sourceUrl && (
        <div className="creator-attribution">
          <div className="creator-attribution-info">
            <Heart className="w-4 h-4" />
            <div>
              <p className="creator-attribution-text">
                Support {ytChannel || creator.host || 'the creator'} — watch on YouTube so they earn ad revenue and views.
              </p>
              {metrics && metrics.views > 0 && (
                <div className="creator-attribution-stats">
                  <span><Eye className="w-3 h-3" /> {formatNumber(metrics.views)}</span>
                  {metrics.likes > 0 && <span><ThumbsUp className="w-3 h-3" /> {formatNumber(metrics.likes)}</span>}
                  {metrics.comments > 0 && <span><MessageSquare className="w-3 h-3" /> {formatNumber(metrics.comments)}</span>}
                </div>
              )}
            </div>
          </div>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="creator-attribution-link"
          >
            Watch on YouTube
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Hook & One-liner */}
      {(creator.hook || creator.one_liner) && (
        <div className="creator-section creator-hook-section">
          {creator.hook && (
            <div className="creator-hook">
              <strong>Hook:</strong>
              <p>"{creator.hook}"</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(creator.hook, 'hook')}
              >
                {copiedItem === 'hook' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          )}
          {creator.one_liner && (
            <div className="creator-oneliner">
              <strong>One-liner:</strong>
              <p>{creator.one_liner}</p>
            </div>
          )}
        </div>
      )}

      {/* Viral Clip Opportunities */}
      {creator.viral_moments && creator.viral_moments.length > 0 && (
        <div className="creator-section">
          <button
            className="creator-section-header"
            onClick={() => toggleSection('clips')}
          >
            {expandedSections.clips ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Scissors className="w-4 h-4" />
            <h3>Viral Clip Opportunities ({creator.viral_moments.length})</h3>
          </button>
          {expandedSections.clips && (
            <div className="creator-clips">
              {creator.viral_moments.map((clip, idx) => (
                <div key={idx} className="creator-clip">
                  <div className="creator-clip-header">
                    <span className="creator-clip-title">{clip.clip_title}</span>
                    {clip.emotion && (
                      <Badge className={emotionColors[clip.emotion]}>
                        {clip.emotion}
                      </Badge>
                    )}
                  </div>
                  <div className="creator-clip-time">
                    <TimestampLink timestamp={clip.timestamp_start} sourceUrl={sourceUrl} />
                    {clip.timestamp_end && <> - <TimestampLink timestamp={clip.timestamp_end} sourceUrl={sourceUrl} /></>}
                    {clip.duration_seconds && ` (${clip.duration_seconds}s)`}
                  </div>
                  <p className="creator-clip-hook">"{clip.hook}"</p>
                  <p className="creator-clip-desc">{clip.description}</p>
                  {clip.platforms && (
                    <div className="creator-clip-platforms">
                      {clip.platforms.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quotable Quotes */}
      {creator.quotable_quotes && creator.quotable_quotes.length > 0 && (
        <div className="creator-section">
          <button
            className="creator-section-header"
            onClick={() => toggleSection('quotes')}
          >
            {expandedSections.quotes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Quote className="w-4 h-4" />
            <h3>Quotable Quotes ({creator.quotable_quotes.length})</h3>
          </button>
          {expandedSections.quotes && (
            <div className="creator-quotes">
              {creator.quotable_quotes.map((q, idx) => (
                <div key={idx} className="creator-quote">
                  <blockquote>"{q.quote}"</blockquote>
                  <div className="creator-quote-meta">
                    <span>— {q.speaker}</span>
                    {q.timestamp && <TimestampLink timestamp={q.timestamp} sourceUrl={sourceUrl} />}
                  </div>
                  {q.tweet_ready && (
                    <div className="creator-quote-tweet">
                      <span>{q.tweet_ready}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(q.tweet_ready, `quote-${idx}`)}
                      >
                        {copiedItem === `quote-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Twitter Thread */}
      {creator.tweet_thread && creator.tweet_thread.length > 0 && (
        <div className="creator-section">
          <button
            className="creator-section-header"
            onClick={() => toggleSection('thread')}
          >
            {expandedSections.thread ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Twitter className="w-4 h-4" />
            <h3>Twitter Thread ({creator.tweet_thread.length} tweets)</h3>
          </button>
          {expandedSections.thread && (
            <div className="creator-thread">
              <Button
                variant="outline"
                size="sm"
                className="creator-copy-all"
                onClick={() => copyToClipboard(creator.tweet_thread.join('\n\n'), 'thread')}
              >
                {copiedItem === 'thread' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Thread
              </Button>
              {creator.tweet_thread.map((tweet, idx) => (
                <div key={idx} className="creator-tweet">
                  <span className="creator-tweet-num">{idx + 1}/</span>
                  <p>{tweet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LinkedIn Post */}
      {creator.linkedin_post && (
        <div className="creator-section">
          <button
            className="creator-section-header"
            onClick={() => toggleSection('linkedin')}
          >
            {expandedSections.linkedin ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Linkedin className="w-4 h-4" />
            <h3>LinkedIn Post</h3>
          </button>
          {expandedSections.linkedin && (
            <div className="creator-linkedin">
              <Button
                variant="outline"
                size="sm"
                className="creator-copy-all"
                onClick={() => copyToClipboard(creator.linkedin_post, 'linkedin')}
              >
                {copiedItem === 'linkedin' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Post
              </Button>
              <pre className="creator-linkedin-text">{creator.linkedin_post}</pre>
            </div>
          )}
        </div>
      )}

      {/* Blog Outline */}
      {creator.blog_outline && (
        <div className="creator-section">
          <button
            className="creator-section-header"
            onClick={() => toggleSection('blog')}
          >
            {expandedSections.blog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <FileText className="w-4 h-4" />
            <h3>Blog Post Outline</h3>
          </button>
          {expandedSections.blog && (
            <div className="creator-blog">
              <h4 className="creator-blog-title">{creator.blog_outline.title}</h4>
              {creator.blog_outline.meta_description && (
                <p className="creator-blog-meta">{creator.blog_outline.meta_description}</p>
              )}
              {creator.blog_outline.sections && (
                <div className="creator-blog-sections">
                  {creator.blog_outline.sections.map((sec, idx) => (
                    <div key={idx} className="creator-blog-section">
                      <h5>{sec.heading}</h5>
                      {sec.key_points && (
                        <ul>
                          {sec.key_points.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hashtags */}
      {creator.hashtags && creator.hashtags.length > 0 && (
        <div className="creator-section">
          <h3 className="creator-section-title">
            <Hash className="w-4 h-4" />
            Hashtags
          </h3>
          <div className="creator-hashtags">
            {creator.hashtags.map((tag, idx) => (
              <Badge key={idx} variant="outline">#{tag}</Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(creator.hashtags.map(t => `#${t}`).join(' '), 'hashtags')}
            >
              {copiedItem === 'hashtags' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreatorCard
