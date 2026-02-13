import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../api/billing'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import Navbar from '../components/layout/Navbar'
import {
  X, Sparkles, Search, FolderOpen, Play, ArrowRight,
  BookOpen, GraduationCap, Video, Eye,
  Brain, Zap, Shield, Clock, Check,
  CheckCircle, Star, Users, BarChart3,
  MessageCircle, Send, Loader2
} from 'lucide-react'

// Feature cards data — pain-point driven
const FEATURES = [
  {
    icon: Eye,
    title: 'See what transcripts can\'t hear',
    description: 'Teacher points at a whiteboard and says "this right here." The transcript gives you nothing. Vision AI reads the board and gives you the actual word. Works on slides, code, diagrams, and AI-generated video descriptions too.',
    gradient: 'from-orange-500 to-red-600'
  },
  {
    icon: Brain,
    title: 'Never rewatch a video again',
    description: 'AI extracts summaries, key points, and structured notes so you can skip the 45-minute rewatch and get the answer in 10 seconds.',
    gradient: 'from-purple-500 to-violet-600'
  },
  {
    icon: Search,
    title: 'Find anything you\'ve ever watched',
    description: '"What was that tip from last week\'s tutorial?" Ask in plain English, get the exact quote with a timestamp. Across every video you\'ve saved.',
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    icon: FolderOpen,
    title: 'Your second brain for video',
    description: 'Organize by topic, course, or project. Everything searchable, exportable, and always there when you need it — even months later.',
    gradient: 'from-pink-500 to-rose-600'
  }
]

// Use cases data — pain-point driven
const USE_CASES = [
  {
    icon: GraduationCap,
    title: 'Students: stop pausing and scribbling',
    description: 'Your professor talks fast and points at the board. Lectures pile up before exams. Paste the recording — Vision AI reads the whiteboard, AI builds clean notes, and flashcards are ready before you close the tab.',
    benefits: ['Vision AI catches what the mic can\'t', 'AI flashcards for exam prep', 'Search across an entire semester']
  },
  {
    icon: Video,
    title: 'Creators: research 10x faster',
    description: 'Watching 20 competitor videos takes a full day. Paste the links, get structured breakdowns with on-screen text included, and auto-generate scripts from the best insights.',
    benefits: ['Competitor analysis on autopilot', 'Auto-generated Top 10 scripts', 'Repurpose into tweets, posts & threads']
  },
  {
    icon: BookOpen,
    title: 'Researchers: never lose a quote again',
    description: 'That one line from the third interview last month? Search your entire archive in plain English and get the exact quote, with timestamp and source — even text that was only shown on screen.',
    benefits: ['Searchable interview archive', 'Cross-reference across dozens of sources', 'Export to Obsidian, Notion & more']
  }
]

// Stats data
const STATS = [
  { value: '50,000+', label: 'Videos Analyzed', icon: BarChart3 },
  { value: '1.2M', label: 'Minutes Saved', icon: Clock },
  { value: '12,000+', label: 'Active Users', icon: Users }
]

// Testimonials — specific, pain-point grounded
const TESTIMONIALS = [
  {
    quote: "Finals week used to mean rewatching 40 hours of lectures. Now I search 'mitosis vs meiosis' and get the exact slide and explanation in 3 seconds.",
    name: "Sarah K.",
    role: "Biology PhD Student",
    avatar: "S"
  },
  {
    quote: "I broke down 15 competitor videos in one afternoon and had a Top 10 script draft before dinner. This used to take me a full week.",
    name: "Marcus T.",
    role: "YouTube Creator, 120K subs",
    avatar: "M"
  },
  {
    quote: "We run 8 customer calls a day. Before this, insights got buried in Zoom recordings. Now every quote is searchable and sorted by project.",
    name: "Jennifer L.",
    role: "Head of Product, Series A startup",
    avatar: "J"
  }
]

// Quick start steps — outcome-driven
const STEPS = [
  {
    number: '1',
    title: 'Paste the link',
    description: 'YouTube video, lecture recording, or any web article. One click.'
  },
  {
    number: '2',
    title: 'AI does the work',
    description: 'Transcription, summaries, key points, and visual analysis — all automatic, all in minutes.'
  },
  {
    number: '3',
    title: 'Know everything, find anything',
    description: 'Search your entire library in plain English. Export, create flashcards, or repurpose into new content.'
  }
]

// FAQ data — objection-handling
const FAQ_ITEMS = [
  {
    question: 'How is this different from just reading the transcript?',
    answer: 'Transcripts are walls of text with no structure. We give you summaries, key points, topic breakdowns, and entities — organized and searchable. Plus Vision AI reads slides, diagrams, and on-screen text that transcripts miss entirely.'
  },
  {
    question: 'What video sources are supported?',
    answer: 'YouTube videos and any web article URL. Paste the link and we handle the rest — download, transcribe, analyze, and organize.'
  },
  {
    question: 'Will it work for long lectures and webinars?',
    answer: 'Yes. Starter handles videos up to 45 minutes (perfect for lectures). Pro supports up to 2-hour deep dives, and Team goes to 3 hours for full workshops and trainings.'
  },
  {
    question: 'What does Vision AI actually see?',
    answer: 'Everything the transcript misses. A teacher points at a whiteboard and says "this word" — Vision AI reads the actual word. A tutorial shows a code block — Vision AI captures it. It also describes scenes in AI-generated videos (Sora, Flow, etc.) where there\'s no audio at all. Available on Pro and Team.'
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel with one click from your profile. You keep access until the end of your billing period. No lock-in, no questions.'
  },
  {
    question: 'Is my data private?',
    answer: 'Your content is only visible to you. We store structured notes and transcripts — never the original video files. Your knowledge base is yours.'
  }
]

function LandingPage() {
  const navigate = useNavigate()
  const { googleLogin } = useAuth()
  const googleAlertBtnRef = useRef(null)
  const [showGoogleAlert, setShowGoogleAlert] = useState(false)

  useEffect(() => {
    document.title = 'Second Mind — Watch Once, Remember Everything'
  }, [])

  // Show Google sign-in alert and render button inside it
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    // Show the alert after a brief delay so the page feels loaded first
    const timer = setTimeout(() => setShowGoogleAlert(true), 400)
    return () => clearTimeout(timer)
  }, [])

  // Render the Google button inside the alert once it's visible
  useEffect(() => {
    if (!showGoogleAlert) return
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const renderBtn = () => {
      if (!window.google?.accounts?.id || !googleAlertBtnRef.current) return false

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            await googleLogin(response.credential)
            navigate('/app')
          } catch (err) {
            console.error('Google sign-in failed:', err)
          }
        }
      })

      window.google.accounts.id.renderButton(googleAlertBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 250
      })
      return true
    }

    if (!renderBtn()) {
      const interval = setInterval(() => {
        if (renderBtn()) clearInterval(interval)
      }, 200)
      return () => clearInterval(interval)
    }
  }, [showGoogleAlert, googleLogin, navigate])

  // Pricing plans
  const [plans, setPlans] = useState([])

  useEffect(() => {
    billingApi.getPlans()
      .then(setPlans)
      .catch(() => {})
  }, [])

  // Track if help section is in view
  const helpSectionRef = useRef(null)
  const [helpInView, setHelpInView] = useState(false)

  useEffect(() => {
    const el = helpSectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setHelpInView(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Support chat widget
  const [chatOpen, setChatOpen] = useState(false)
  const [chatForm, setChatForm] = useState({ fullName: '', email: '', category: 'general', body: '' })
  const [chatSending, setChatSending] = useState(false)
  const [chatSent, setChatSent] = useState(false)

  const handleChatSubmit = async (e) => {
    e.preventDefault()
    setChatSending(true)
    // Send to support endpoint (or mailto fallback)
    try {
      await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatForm)
      })
    } catch {
      // Fallback: open mailto
      window.location.href = `mailto:support@secondmind.ai?subject=${encodeURIComponent(chatForm.category)}&body=${encodeURIComponent(`From: ${chatForm.fullName} (${chatForm.email})\n\n${chatForm.body}`)}`
    }
    setChatSending(false)
    setChatSent(true)
  }

  return (
    <div className="landing-page">
      {/* Google sign-in alert — top right corner */}
      {showGoogleAlert && (
        <div className="google-signin-alert">
          <button
            className="google-signin-alert-close"
            onClick={() => setShowGoogleAlert(false)}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="google-signin-alert-text">Sign in to get started</p>
          <div ref={googleAlertBtnRef} className="google-signin-alert-btn" />
        </div>
      )}

      <Navbar />
      <main id="main-content">

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-glow landing-hero-glow-1" />
          <div className="landing-hero-glow landing-hero-glow-2" />
          <div className="landing-hero-grid" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Video Notes</span>
          </div>

          <h1 className="landing-hero-title">
            You watch it once.{' '}
            <span className="text-gradient">AI remembers it forever.</span>
          </h1>

          <p className="landing-hero-subtitle">
            Stop rewatching. Stop losing insights. Paste a YouTube link and get structured notes,
            searchable transcripts, and AI-powered answers across your entire video library — in minutes, not hours.
          </p>

          <div className="landing-hero-ctas">
            <Button size="lg" onClick={() => navigate('/register')}>
              Try Now — It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })
            }}>
              <Play className="w-5 h-5 mr-2" />
              See How It Works
            </Button>
          </div>

          <p className="landing-hero-note">7-day free trial on all plans. No credit card needed to start.</p>
        </div>

        {/* App preview mockup */}
        <div className="landing-hero-preview">
          <div className="landing-hero-preview-window">
            <div className="landing-hero-preview-bar">
              <div className="landing-hero-preview-dots">
                <span /><span /><span />
              </div>
              <div className="landing-hero-preview-url">app.secondmind.ai</div>
            </div>
            <div className="landing-hero-preview-body">
              <div className="landing-preview-sidebar">
                <div className="landing-preview-logo">Second Mind</div>
                <div className="landing-preview-nav-item active">Knowledge Base</div>
                <div className="landing-preview-nav-item">Discover</div>
                <div className="landing-preview-nav-item">Collections</div>
              </div>
              <div className="landing-preview-main">
                <div className="landing-preview-card">
                  <div className="landing-preview-card-thumb" />
                  <div className="landing-preview-card-info">
                    <div className="landing-preview-card-title" />
                    <div className="landing-preview-card-meta" />
                    <div className="landing-preview-card-tags">
                      <span>AI</span><span>Tutorial</span>
                    </div>
                  </div>
                </div>
                <div className="landing-preview-card">
                  <div className="landing-preview-card-thumb" />
                  <div className="landing-preview-card-info">
                    <div className="landing-preview-card-title" />
                    <div className="landing-preview-card-meta" />
                    <div className="landing-preview-card-tags">
                      <span>Recipe</span><span>Cooking</span>
                    </div>
                  </div>
                </div>
                <div className="landing-preview-card">
                  <div className="landing-preview-card-thumb" />
                  <div className="landing-preview-card-info">
                    <div className="landing-preview-card-title" />
                    <div className="landing-preview-card-meta" />
                    <div className="landing-preview-card-tags">
                      <span>Meeting</span><span>Notes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="landing-stats" aria-label="Statistics">
        <div className="landing-stats-inner">
          {STATS.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="landing-stat">
                <Icon className="w-6 h-6 text-purple-400" />
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section" id="how-it-works" aria-label="How it works">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2>Three steps. Zero rewatching.</h2>
            <p>From video to searchable knowledge in under 5 minutes.</p>
          </div>

          <div className="landing-steps">
            {STEPS.map((step, i) => (
              <div key={i} className="landing-step">
                <div className="landing-step-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {i < STEPS.length - 1 && <div className="landing-step-connector" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section landing-section-dark" id="features" aria-label="Features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2>The video knowledge you're losing</h2>
            <p>Every video you watch and forget is wasted time. We fix that.</p>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div key={i} className="landing-feature-card">
                  <div className={`landing-feature-icon bg-gradient-to-br ${feature.gradient}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="landing-section" aria-label="Use cases">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2>Built for how you actually work</h2>
            <p>Students, creators, and researchers have different workflows. We handle all of them.</p>
          </div>

          <div className="landing-usecases-grid">
            {USE_CASES.map((useCase, i) => {
              const Icon = useCase.icon
              return (
                <div key={i} className="landing-usecase-card">
                  <Icon className="w-8 h-8 text-purple-400 mb-4" />
                  <h3>{useCase.title}</h3>
                  <p>{useCase.description}</p>
                  <ul>
                    {useCase.benefits.map((b, j) => (
                      <li key={j}>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="landing-section landing-section-dark" aria-label="Testimonials">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2>Hours saved, every week</h2>
            <p>Here's what happens when you stop rewatching.</p>
          </div>

          <div className="landing-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="landing-testimonial-card">
                <div className="landing-testimonial-stars">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p>"{t.quote}"</p>
                <div className="landing-testimonial-author">
                  <div className="landing-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="landing-testimonial-name">{t.name}</div>
                    <div className="landing-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section className="landing-section" id="pricing" aria-label="Pricing">
          <div className="landing-section-inner">
            <div className="landing-section-header">
              <h2>Plans that pay for themselves in time saved</h2>
              <p>One hour of rewatching costs more than a month of Second Mind.</p>
            </div>

            <div className="landing-pricing-grid">
              {plans.map((plan) => (
                <div key={plan.tier} className={`landing-plan-card ${plan.is_popular ? 'popular' : ''}`}>
                  {plan.is_popular && (
                    <div className="landing-plan-popular">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </div>
                  )}
                  <h3>{plan.name}</h3>
                  <div className="landing-plan-price">
                    <span className="landing-plan-currency">$</span>
                    <span className="landing-plan-amount">{plan.price_monthly}</span>
                    <span className="landing-plan-period">/mo</span>
                  </div>
                  <ul className="landing-plan-features">
                    {plan.features.slice(0, 4).map((feature, i) => (
                      <li key={i}>
                        <Check className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => navigate('/pricing')}
                  >
                    Choose {plan.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="landing-cta" aria-label="Call to action">
        <div className="landing-cta-inner">
          <h2>Every video you watch and forget is time you'll never get back.</h2>
          <p>Start remembering everything. 3 videos free, no credit card, set up in 30 seconds.</p>
          <div className="landing-cta-buttons">
            <Button size="lg" onClick={() => navigate('/register')}>
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/pricing')}>
              View Pricing
            </Button>
          </div>
          <div className="landing-cta-features">
            <span><CheckCircle className="w-4 h-4" /> Free plan available</span>
            <span><Shield className="w-4 h-4" /> No credit card required</span>
            <span><Zap className="w-4 h-4" /> Set up in 30 seconds</span>
          </div>
        </div>
      </section>

      </main>

      {/* Floating Support Chat */}
      <div className="support-chat-widget">
        {chatOpen && (
          <div className="support-chat-panel">
            <div className="support-chat-header">
              <span>Contact Support</span>
              <button onClick={() => setChatOpen(false)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {chatSent ? (
              <div className="support-chat-sent">
                <CheckCircle className="w-10 h-10 text-green-400" />
                <p>Message sent! We'll get back to you soon.</p>
                <Button variant="outline" size="sm" onClick={() => { setChatSent(false); setChatForm({ fullName: '', email: '', category: 'general', body: '' }) }}>
                  Send Another
                </Button>
              </div>
            ) : (
              <form className="support-chat-form" onSubmit={handleChatSubmit}>
                <div className="support-chat-field">
                  <label>Full Name</label>
                  <Input
                    value={chatForm.fullName}
                    onChange={(e) => setChatForm(f => ({ ...f, fullName: e.target.value }))}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="support-chat-field">
                  <label>Email</label>
                  <Input
                    type="email"
                    value={chatForm.email}
                    onChange={(e) => setChatForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="support-chat-field">
                  <label>Category</label>
                  <select
                    value={chatForm.category}
                    onChange={(e) => setChatForm(f => ({ ...f, category: e.target.value }))}
                    className="support-chat-select"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="billing">Billing</option>
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="account">Account Issue</option>
                  </select>
                </div>
                <div className="support-chat-field">
                  <label>Message</label>
                  <textarea
                    value={chatForm.body}
                    onChange={(e) => setChatForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="How can we help?"
                    rows={4}
                    required
                    className="support-chat-textarea"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={chatSending}>
                  {chatSending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send Message</>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}
        <div className="support-chat-fab-wrap">
          {!chatOpen && helpInView && (
            <div className="support-chat-bubble" onClick={() => setChatOpen(true)}>
              Need help?
            </div>
          )}
          <button
            className="support-chat-fab"
            onClick={() => setChatOpen(!chatOpen)}
            aria-label="Support chat"
          >
            {chatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Help & FAQ */}
      <section className="landing-section landing-section-dark" id="help" ref={helpSectionRef} aria-label="Help & FAQ">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <h2>Help & FAQ</h2>
            <p>Got questions? We've got answers.</p>
          </div>

          <div className="landing-faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>

          <p className="landing-faq-contact">
            Still need help?{' '}
            <button className="landing-faq-chat-link" onClick={() => setChatOpen(true)}>
              Open a chat with our support team
            </button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-navbar-logo-icon">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Second Mind</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/pricing">Pricing</Link>
            <a href="#help">Help</a>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </div>
          <div className="landing-footer-copy">
            &copy; {new Date().getFullYear()} Second Mind. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
