"""
Billing Pydantic Models
Request/Response schemas for billing endpoints
"""

from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


# =============================================
# Plan Models
# =============================================
class PlanInfo(BaseModel):
    """Information about a subscription plan"""
    id: str
    name: str
    tier: str
    price_monthly: float
    price_yearly: Optional[float] = None
    credits_monthly: int = 50
    features: List[str]
    stripe_price_id: Optional[str] = None
    is_popular: bool = False
    # Tier feature flags (for pricing comparison table)
    max_video_duration_minutes: int = 10
    vision_analysis: bool = False
    advanced_search: bool = False
    export_formats: List[str] = ["txt", "md"]
    collections_limit: int = 3
    chat_queries_per_day: int = -1
    flashcard_generation: bool = False
    mindmap_generation: bool = False
    guide_generation: bool = False
    content_spinning: bool = False
    top10_generator: bool = False
    api_access: bool = False
    priority_processing: bool = False
    # New tier-gated fields
    storage_mb: int = 100
    ai_model: str = "gpt-4o-mini"
    search_type: str = "basic"
    team_members: int = 1
    support_level: str = "community"


class PlansResponse(BaseModel):
    """Response for listing plans"""
    plans: List[PlanInfo]


# =============================================
# Checkout Models
# =============================================
class CheckoutSessionCreate(BaseModel):
    """Request to create a Stripe checkout session"""
    tier: str  # starter, pro, team, or education
    billing_period: str = "monthly"  # monthly or yearly
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    """Response with Stripe checkout session URL"""
    checkout_url: str
    session_id: str


# =============================================
# Subscription Models
# =============================================
class SubscriptionResponse(BaseModel):
    """Current subscription information"""
    tier: str
    status: str
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    features: List[str]
    credit_balance: int = 0      # Total (monthly + topup)
    monthly_balance: int = 0     # Monthly credits remaining
    topup_balance: int = 0       # Purchased top-up credits (never expire)
    credits_monthly: int = 50
    credits_reset_at: Optional[datetime] = None
    # Tier limits (for client-side feature checks)
    max_video_duration_minutes: int = 10
    vision_analysis: bool = False
    collections_limit: int = 3
    chat_queries_per_day: int = -1
    export_formats: List[str] = ["txt", "md"]
    flashcard_generation: bool = False
    mindmap_generation: bool = False
    guide_generation: bool = False
    # New tier-gated fields
    storage_mb: int = 100
    ai_model: str = "gpt-4o-mini"
    storage_used_mb: float = 0.0


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription"""
    cancel_at_period_end: bool = True  # If True, stays active until period end
    reason: Optional[str] = None


class CancelSubscriptionResponse(BaseModel):
    """Response after canceling subscription"""
    message: str
    status: str
    period_end: Optional[datetime] = None


# =============================================
# Credit Models
# =============================================
class CreditBalanceResponse(BaseModel):
    """Credit balance and recent transactions"""
    balance: int              # Total (monthly + topup)
    monthly_balance: int = 0
    topup_balance: int = 0
    credits_monthly: int
    tier: str
    credits_reset_at: Optional[datetime] = None
    transactions: List[dict] = []


class CreditCostsResponse(BaseModel):
    """Full credit cost matrix"""
    costs: Dict[str, int]
    tier_credits: Dict[str, dict]


class TopupPackInfo(BaseModel):
    """Info about a top-up credit pack"""
    id: str
    credits: int
    price: float
    price_per_credit: float
    available: bool = True  # False if tier too low


class TopupPacksResponse(BaseModel):
    """Available top-up packs for the user"""
    packs: List[TopupPackInfo]
    tier: str
    topup_allowed: bool = True  # False for free tier


class TopupCheckoutRequest(BaseModel):
    """Request to purchase a top-up pack"""
    pack_id: str  # small, medium, large, bulk
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


# =============================================
# Portal Models
# =============================================
class PortalSessionResponse(BaseModel):
    """Response with Stripe customer portal URL"""
    portal_url: str


# =============================================
# Webhook Models
# =============================================
class WebhookEvent(BaseModel):
    """Stripe webhook event"""
    type: str
    data: dict


class WebhookResponse(BaseModel):
    """Response for webhook processing"""
    received: bool
    event_type: str
    processed: bool = True
