import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../api/billing'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import Navbar from '../components/layout/Navbar'
import FeatureMockup from '../components/landing/FeatureMockup'
import useLenis from '../hooks/useLenis'
import useScrollAnimations from '../hooks/useScrollAnimations'
import {
  X, Sparkles, Search, FolderOpen, Play, ArrowRight,
  BookOpen, GraduationCap, Video, Eye,
  Brain, Zap, Shield, Clock, Check,
  CheckCircle, Star, Users, BarChart3,
  MessageCircle, Send, Loader2
} from 'lucide-react'
import BrainIcon from '../components/icons/BrainIcon'
import BrainVisualization from '../components/landing/BrainVisualization'

import { API_BASE } from '../lib/apiBase'

// Audience chips
const AUDIENCE_CHIPS = [
  'Students', 'PhD Researchers', 'YouTube Creators', 'Product Managers',
  'Freelancers', 'Course Creators', 'Journalists', 'Marketers',
  'Developers', 'Podcasters'
]

// Feature cards data — pain-point driven
const FEATURES = [
  {
    icon: Eye,
    title: 'See what transcripts can\'t hear',
    description: 'Teacher points at a whiteboard and says "this right here." The transcript gives you nothing. Vision AI reads the board and gives you the actual word.',
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
    description: '"What was that tip from last week\'s tutorial?" Ask in plain English, get the exact quote with a timestamp.',
    gradient: 'from-cyan-500 to-blue-600'
  },
  {
    icon: FolderOpen,
    title: 'Your second brain for video',
    description: 'Organize by topic, course, or project. Everything searchable, exportable, and always there when you need it.',
    gradient: 'from-pink-500 to-rose-600'
  }
]

// Feature breakdowns (replaces Use Cases)
const FEATURE_BREAKDOWNS = [
  {
    tag: 'Vision AI',
    tagColor: 'orange',
    title: 'See what the transcript misses',
    description: 'Vision AI captures on-screen text, slides, whiteboard content, code blocks, and scene descriptions that audio-only transcription can never catch.',
    highlights: ['Reads whiteboard & slide text', 'Captures code blocks on screen', 'Describes AI-generated video scenes', 'Works on diagrams & charts'],
    mockup: 'vision'
  },
  {
    tag: 'Smart Notes',
    tagColor: 'purple',
    title: 'Structured notes, not walls of text',
    description: 'Get organized summaries, key points, topic breakdowns, and timestamped sections — ready to review, not rewatch.',
    highlights: ['AI-generated summaries', 'Key points with timestamps', 'Topic-based organization', 'Export to Markdown & Notion'],
    mockup: 'notes'
  },
  {
    tag: 'Semantic Search',
    tagColor: 'cyan',
    title: 'Find anything across your library',
    description: 'Search your entire video archive in plain English. Get exact quotes, timestamps, and sources — even text that was only shown on screen.',
    highlights: ['Natural language queries', 'Cross-video search', 'Exact quotes with timestamps', 'Source attribution'],
    mockup: 'search'
  },
  {
    tag: 'Content Tools',
    tagColor: 'pink',
    title: 'Turn videos into study material',
    description: 'Auto-generate flashcards, mind maps, and study guides from any video. Repurpose content into new formats instantly.',
    highlights: ['AI flashcard generation', 'Mind map creation', 'Study guide builder', 'Content repurposing'],
    mockup: 'tools'
  }
]

// Stats data (4 stats)
const STATS = [
  { value: '50,000+', label: 'Videos Analyzed', icon: BarChart3 },
  { value: '1.2M', label: 'Minutes Saved', icon: Clock },
  { value: '12,000+', label: 'Active Users', icon: Users },
  { value: '4.9', label: 'Average Rating', icon: Star }
]

// Testimonials — 4 cards
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
  },
  {
    quote: "I use it for every product review and user interview. It saves me at least 5 hours a week on note-taking and lets me focus on actual analysis.",
    name: "David R.",
    role: "Product Manager",
    avatar: "D"
  }
]

// Quick start steps
const STEPS = [
  {
    number: '1',
    title: 'Paste the link',
    description: 'YouTube video, lecture recording, or any web article. One click.'
  },
  {
    number: '2',
    title: 'AI does the work',
    description: 'Transcription, summaries, key points, and visual analysis — all automatic.'
  },
  {
    number: '3',
    title: 'Know everything, find anything',
    description: 'Search your library in plain English. Export, create flashcards, or repurpose content.'
  }
]

// FAQ data
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
    answer: 'Everything the transcript misses. A teacher points at a whiteboard and says "this word" — Vision AI reads the actual word. A tutorial shows a code block — Vision AI captures it. It also describes scenes in AI-generated videos where there\'s no audio at all. Available on Pro and Team.'
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
  const pageRef = useRef(null)

  // Smooth scrolling + scroll animations
  useLenis()
  useScrollAnimations(pageRef)

  useEffect(() => {
    document.title = 'Cortexle — Watch Once, Remember Everything'
  }, [])

  // Show Google sign-in alert and render button inside it
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return
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
    try {
      await fetch(`${API_BASE}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatForm)
      })
    } catch {
      window.location.href = `mailto:support@cortexle.com?subject=${encodeURIComponent(chatForm.category)}&body=${encodeURIComponent(`From: ${chatForm.fullName} (${chatForm.email})\n\n${chatForm.body}`)}`
    }
    setChatSending(false)
    setChatSent(true)
  }

  return (
    <div className="landing-page" ref={pageRef}>
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

      {/* ============ HERO ============ */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-stars" />
          <div className="landing-hero-nebula landing-hero-nebula-1" />
          <div className="landing-hero-nebula landing-hero-nebula-2" />
          <div className="landing-hero-glow landing-hero-glow-1" />
          <div className="landing-hero-glow landing-hero-glow-2" />
          <div className="landing-hero-grid" />
          <BrainVisualization />
          <div className="landing-hero-vignette" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-badge" data-animate="up" data-animate-delay="0.2">
            <BrainIcon className="w-4 h-4" animated />
            <span>AI-Powered Video Notes</span>
          </div>

          <h1 className="landing-hero-title" data-animate="up" data-animate-delay="0.1">
            You watch it once.<br />
            <span className="text-gradient text-gradient-glow">AI remembers it forever.</span>
          </h1>

          <p className="landing-hero-subtitle" data-animate="up" data-animate-delay="0.3">
            Stop rewatching. Stop losing insights. Paste a YouTube link and get structured notes,
            searchable transcripts, and AI-powered answers across your entire video library — in minutes, not hours.
          </p>

          <div className="landing-hero-ctas" data-animate="up" data-animate-delay="0.5">
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

          <p className="landing-hero-note" data-animate="fade" data-animate-delay="0.7">7-day free trial on all plans. No credit card needed to start.</p>
        </div>

        {/* App preview mockup */}
        <div className="landing-hero-preview hero-float" data-animate="scale" data-animate-delay="0.4">
          <div className="landing-hero-preview-window">
            <div className="landing-hero-preview-bar">
              <div className="landing-hero-preview-dots">
                <span /><span /><span />
              </div>
              <div className="landing-hero-preview-url">app.cortexle.com</div>
            </div>
            <div className="landing-hero-preview-body">
              <div className="landing-preview-sidebar">
                <div className="landing-preview-logo">Cortexle</div>
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

      {/* ============ AUDIENCE CHIPS ============ */}
      <section className="landing-audience" aria-label="Designed for">
        <p className="landing-audience-label" data-animate="fade">Designed for</p>
        <div className="landing-audience-chips" data-stagger="up">
          {AUDIENCE_CHIPS.map((chip) => (
            <span key={chip} className="landing-audience-chip" data-stagger-item>{chip}</span>
          ))}
        </div>
      </section>

      {/* ============ STATS BAR ============ */}
      <section className="landing-stats" aria-label="Statistics">
        <div className="landing-stats-inner" data-stagger="up">
          {STATS.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="landing-stat" data-stagger-item>
                <Icon className="w-6 h-6 text-purple-400" />
                <div className="landing-stat-value">{stat.value}</div>
                <div className="landing-stat-label">{stat.label}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============ FEATURE CARDS ============ */}
      <section className="landing-section landing-section-dark" id="features" aria-label="Features">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>The video knowledge you're losing</h2>
            <p>Every video you watch and forget is wasted time. We fix that.</p>
          </div>

          <div className="landing-features-grid" data-stagger="up">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div key={i} className="landing-feature-card" data-stagger-item>
                  <div className={`landing-feature-icon bg-gradient-to-br ${feature.gradient}`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ DASHBOARD SHOWCASE ============ */}
      <section className="landing-section" aria-label="Dashboard showcase">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>Your entire video library, organized</h2>
            <p>Search, browse, and manage all your video knowledge in one place.</p>
          </div>

          <div className="landing-showcase" data-animate="scale">
            <div className="landing-showcase-chrome">
              <span className="landing-showcase-dot" />
              <span className="landing-showcase-dot" />
              <span className="landing-showcase-dot" />
              <div className="landing-showcase-url">app.cortexle.com/library</div>
            </div>
            <div className="landing-showcase-body">
              <div className="landing-showcase-sidebar">
                <div className="landing-showcase-sb-logo">SM</div>
                <div className="landing-showcase-sb-item active">Library</div>
                <div className="landing-showcase-sb-item">Discover</div>
                <div className="landing-showcase-sb-item">Collections</div>
                <div className="landing-showcase-sb-item">Settings</div>
              </div>
              <div className="landing-showcase-main">
                <div className="landing-showcase-toolbar">
                  <div className="landing-showcase-search-bar">Search your library...</div>
                  <div className="landing-showcase-tags">
                    <span>All</span><span className="active">AI</span><span>Lectures</span><span>Tutorials</span>
                  </div>
                </div>
                <div className="landing-showcase-cards">
                  {[1,2,3,4,5,6].map((n) => (
                    <div key={n} className={`landing-showcase-card ${n === 2 ? 'active' : ''}`}>
                      <div className="landing-showcase-card-thumb" />
                      <div className="landing-showcase-card-body">
                        <div className="landing-showcase-card-title" />
                        <div className="landing-showcase-card-meta" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="landing-showcase-detail">
                <div className="landing-showcase-detail-tabs">
                  <span className="active">Notes</span><span>Transcript</span><span>Chat</span>
                </div>
                <div className="landing-showcase-detail-body">
                  <div className="landing-showcase-skel" />
                  <div className="landing-showcase-skel med" />
                  <div className="landing-showcase-skel short" />
                  <div className="landing-showcase-skel" />
                  <div className="landing-showcase-skel med" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE BREAKDOWNS ============ */}
      <section className="landing-section landing-section-dark" aria-label="Feature breakdowns">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>Built for how you actually work</h2>
            <p>Four powerful capabilities, working together.</p>
          </div>

          <div className="landing-breakdowns">
            {FEATURE_BREAKDOWNS.map((fb, i) => (
              <div key={i} className={`landing-breakdown ${i % 2 !== 0 ? 'reverse' : ''}`}>
                <div className="landing-breakdown-text" data-animate={i % 2 === 0 ? 'left' : 'right'}>
                  <span className={`landing-breakdown-tag tag-${fb.tagColor}`}>{fb.tag}</span>
                  <h3>{fb.title}</h3>
                  <p>{fb.description}</p>
                  <ul className="landing-breakdown-checks">
                    {fb.highlights.map((h, j) => (
                      <li key={j}>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="landing-breakdown-mockup" data-animate={i % 2 === 0 ? 'right' : 'left'}>
                  <FeatureMockup type={fb.mockup} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="landing-section" id="how-it-works" aria-label="How it works">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>Three steps. Zero rewatching.</h2>
            <p>From video to searchable knowledge in under 5 minutes.</p>
          </div>

          <div className="landing-steps-v2" data-stagger="up">
            {STEPS.map((step, i) => (
              <div key={i} className="landing-step-card" data-stagger-item>
                <div className="landing-step-card-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="landing-section landing-section-dark" aria-label="Testimonials">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>Hours saved, every week</h2>
            <p>Here's what happens when you stop rewatching.</p>
          </div>

          <div className="landing-testimonials-grid" data-stagger="up">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="landing-testimonial-card" data-stagger-item>
                <div className="landing-testimonial-quote-mark">"</div>
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

      {/* ============ PRICING ============ */}
      {plans.length > 0 && (
        <section className="landing-section" id="pricing" aria-label="Pricing">
          <div className="landing-section-inner">
            <div className="landing-section-header" data-animate="up">
              <h2>Plans that pay for themselves in time saved</h2>
              <p>One hour of rewatching costs more than a month of Cortexle.</p>
            </div>

            <div className="landing-pricing-wrap">
              <div className="landing-pricing-glow" />
              <div className="landing-pricing-grid" data-stagger="up">
                {plans.map((plan) => (
                  <div key={plan.tier} className={`landing-plan-card ${plan.is_popular ? 'popular' : ''}`} data-stagger-item>
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
          </div>
        </section>
      )}

      {/* ============ FINAL CTA ============ */}
      <section className="landing-cta" aria-label="Call to action">
        <div className="landing-cta-bg">
          <div className="landing-hero-stars" />
          <div className="landing-hero-nebula landing-hero-nebula-1" />
          <div className="landing-hero-vignette" />
        </div>
        <div className="landing-cta-inner" data-animate="up">
          <h2>Every video you watch and forget<br />is time you'll never get back.</h2>
          <p>Start remembering everything. 3 videos free, no credit card, set up in 30 seconds.</p>
          <div className="landing-cta-buttons">
            <Button size="lg" onClick={() => navigate('/register')}>
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })
            }}>
              <Play className="w-5 h-5 mr-2" />
              See How It Works
            </Button>
          </div>
          <div className="landing-cta-features">
            <span><CheckCircle className="w-4 h-4" /> Free plan available</span>
            <span><Shield className="w-4 h-4" /> No credit card required</span>
            <span><Zap className="w-4 h-4" /> Set up in 30 seconds</span>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="landing-section landing-section-dark" id="help" ref={helpSectionRef} aria-label="Help & FAQ">
        <div className="landing-section-inner">
          <div className="landing-section-header" data-animate="up">
            <h2>Help & FAQ</h2>
            <p>Got questions? We've got answers.</p>
          </div>

          <div className="landing-faq-list" data-stagger="up">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="landing-faq-item" data-stagger-item>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>

          <p className="landing-faq-contact" data-animate="fade">
            Still need help?{' '}
            <button className="landing-faq-chat-link" onClick={() => setChatOpen(true)}>
              Open a chat with our support team
            </button>
          </p>
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

      {/* ============ FOOTER ============ */}
      <footer className="landing-footer-v2">
        <div className="landing-footer-v2-inner">
          <div className="landing-footer-v2-grid">
            <div className="landing-footer-v2-brand">
              <div className="landing-footer-v2-logo">
                <div className="landing-navbar-logo-icon">
                  <BrainIcon className="w-4 h-4" />
                </div>
                <span>Cortexle</span>
              </div>
              <p>Watch once, remember everything. AI-powered video knowledge management.</p>
            </div>
            <div className="landing-footer-v2-col">
              <h4>Product</h4>
              <Link to="/#features">Features</Link>
              <Link to="/pricing">Pricing</Link>
              <Link to="/#how-it-works">How It Works</Link>
            </div>
            <div className="landing-footer-v2-col">
              <h4>Support</h4>
              <a href="/#help">Help & FAQ</a>
              <button className="landing-footer-link-btn" onClick={() => setChatOpen(true)}>Contact Us</button>
            </div>
            <div className="landing-footer-v2-col">
              <h4>Legal</h4>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </div>
          <div className="landing-footer-v2-bottom">
            <span>&copy; {new Date().getFullYear()} Cortexle. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
