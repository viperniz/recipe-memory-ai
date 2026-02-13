"""
Billing Service
Stripe API integration for subscriptions + Credits system
"""

import os
import math
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    stripe = None

from database import User, Subscription, UsageLog, get_tier_limits, ContentVector, CREDIT_COSTS, TIER_CREDITS, TIER_LIMITS, CreditTransaction, Collection, CreditTopup, TOPUP_PACKS
from sqlalchemy import func
from datetime import date
from .models import PlanInfo, SubscriptionResponse

# =============================================
# Stripe Configuration
# =============================================
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Price IDs from Stripe Dashboard
STRIPE_PRICES = {
    "starter_monthly": os.getenv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_monthly"),
    "starter_yearly": os.getenv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_yearly"),
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly"),
    "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly"),
    "team_monthly": os.getenv("STRIPE_PRICE_TEAM_MONTHLY", "price_team_monthly"),
    "team_yearly": os.getenv("STRIPE_PRICE_TEAM_YEARLY", "price_team_yearly"),
    "education_monthly": os.getenv("STRIPE_PRICE_EDUCATION_MONTHLY", "price_education_monthly"),
    "education_yearly": os.getenv("STRIPE_PRICE_EDUCATION_YEARLY", "price_education_yearly"),
}

if STRIPE_AVAILABLE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class BillingService:
    """Service for handling billing and subscriptions"""

    # =============================================
    # Plan Information
    # =============================================
    @staticmethod
    def _make_plan_info(plan_id: str, name: str, stripe_key: str = None, is_popular: bool = False) -> PlanInfo:
        """Helper to build a PlanInfo from tier credits config"""
        tier_info = TIER_CREDITS.get(plan_id, TIER_CREDITS["free"])
        limits = get_tier_limits(plan_id)

        return PlanInfo(
            id=plan_id,
            name=name,
            tier=plan_id,
            price_monthly=tier_info["price_monthly"],
            price_yearly=tier_info["price_monthly"] * 10 if tier_info["price_monthly"] > 0 else None,
            credits_monthly=tier_info["credits_monthly"],
            features=limits["features"],
            stripe_price_id=STRIPE_PRICES.get(stripe_key) if stripe_key else None,
            is_popular=is_popular,
            max_video_duration_minutes=limits.get("max_video_duration_minutes", 10),
            vision_analysis=limits.get("vision_analysis", False),
            advanced_search=limits.get("advanced_search", False),
            export_formats=limits.get("export_formats", ["txt", "md"]),
            collections_limit=limits.get("collections_limit", 3),
            chat_queries_per_day=limits.get("chat_queries_per_day", -1),
            flashcard_generation=limits.get("flashcard_generation", False),
            mindmap_generation=limits.get("mindmap_generation", False),
            guide_generation=limits.get("guide_generation", False),
            content_spinning=limits.get("content_spinning", False),
            top10_generator=limits.get("top10_generator", False),
            api_access=limits.get("api_access", False),
            priority_processing=limits.get("priority_processing", False),
            storage_mb=limits.get("storage_mb", 100),
            ai_model=limits.get("ai_model", "gpt-4o-mini"),
            search_type=limits.get("search_type", "basic"),
            team_members=limits.get("team_members", 1),
            support_level=limits.get("support_level", "community"),
        )

    @staticmethod
    def get_plans() -> List[PlanInfo]:
        """Get all available subscription plans"""
        return [
            BillingService._make_plan_info("starter", "Researcher", "starter_monthly"),
            BillingService._make_plan_info("pro", "Scholar", "pro_monthly", is_popular=True),
            BillingService._make_plan_info("team", "Department", "team_monthly"),
        ]

    # =============================================
    # Credit System
    # =============================================
    @staticmethod
    def _ensure_subscription(db: Session, user_id: int) -> Subscription:
        """Get or create a subscription record for the user"""
        sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
        if not sub:
            sub = Subscription(user_id=user_id, tier="free", status="active", credit_balance=50)
            db.add(sub)
            db.commit()
            db.refresh(sub)
        # If credit_balance is None (legacy row), initialize it
        if sub.credit_balance is None:
            tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
            sub.credit_balance = tier_info["credits_monthly"]
            db.commit()
        return sub

    @staticmethod
    def get_credit_balance(db: Session, user_id: int) -> int:
        """Return current total credit balance (monthly + topup)"""
        sub = BillingService._ensure_subscription(db, user_id)
        return (sub.credit_balance or 0) + (sub.topup_balance or 0)

    @staticmethod
    def check_credits(db: Session, user_id: int, cost: int) -> dict:
        """Check if user has enough credits (monthly + topup combined)"""
        sub = BillingService._ensure_subscription(db, user_id)
        monthly_balance = sub.credit_balance or 0
        topup_balance = sub.topup_balance or 0
        total_balance = monthly_balance + topup_balance
        tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
        return {
            "has_credits": total_balance >= cost,
            "balance": total_balance,
            "monthly_balance": monthly_balance,
            "topup_balance": topup_balance,
            "cost": cost,
            "tier": sub.tier,
            "credits_monthly": tier_info["credits_monthly"],
        }

    @staticmethod
    def deduct_credits(db: Session, user_id: int, amount: int, action: str,
                       content_id: str = None, description: str = None) -> int:
        """Debit credits (monthly first, then topup). Returns new total. Raises if insufficient."""
        sub = BillingService._ensure_subscription(db, user_id)
        monthly = sub.credit_balance or 0
        topup = sub.topup_balance or 0
        total = monthly + topup
        if total < amount:
            raise ValueError(f"Insufficient credits: need {amount}, have {total}")
        # Consume monthly credits first, then topup
        remaining = amount
        if monthly >= remaining:
            sub.credit_balance = monthly - remaining
        else:
            sub.credit_balance = 0
            remaining -= monthly
            sub.topup_balance = topup - remaining
        new_total = (sub.credit_balance or 0) + (sub.topup_balance or 0)
        # Log transaction
        tx = CreditTransaction(
            user_id=user_id,
            amount=-amount,
            balance_after=new_total,
            action=action,
            content_id=content_id,
            description=description or f"Used {amount} credits for {action}"
        )
        db.add(tx)
        db.commit()
        return new_total

    @staticmethod
    def refund_credits(db: Session, user_id: int, amount: int, action: str,
                       content_id: str = None, description: str = None) -> int:
        """Credit back to monthly balance, log transaction. Returns new total."""
        sub = BillingService._ensure_subscription(db, user_id)
        sub.credit_balance = (sub.credit_balance or 0) + amount
        new_total = (sub.credit_balance or 0) + (sub.topup_balance or 0)
        tx = CreditTransaction(
            user_id=user_id,
            amount=amount,
            balance_after=new_total,
            action=f"{action}_refund",
            content_id=content_id,
            description=description or f"Refunded {amount} credits for {action}"
        )
        db.add(tx)
        db.commit()
        return new_total

    @staticmethod
    def get_credit_history(db: Session, user_id: int, limit: int = 50) -> list:
        """Return recent credit transactions"""
        txs = db.query(CreditTransaction).filter(
            CreditTransaction.user_id == user_id
        ).order_by(CreditTransaction.created_at.desc()).limit(limit).all()
        return [
            {
                "id": tx.id,
                "amount": tx.amount,
                "balance_after": tx.balance_after,
                "action": tx.action,
                "content_id": tx.content_id,
                "description": tx.description,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in txs
        ]

    @staticmethod
    def reset_monthly_credits(db: Session, user_id: int) -> int:
        """Reset credit balance to tier allocation. Returns new balance."""
        sub = BillingService._ensure_subscription(db, user_id)
        tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
        new_balance = tier_info["credits_monthly"]
        sub.credit_balance = new_balance
        sub.credits_reset_at = datetime.utcnow()
        tx = CreditTransaction(
            user_id=user_id,
            amount=new_balance,
            balance_after=new_balance,
            action="monthly_reset",
            description=f"Monthly credit reset for {sub.tier} tier"
        )
        db.add(tx)
        db.commit()
        return new_balance

    @staticmethod
    def get_video_credit_cost(duration_min: float, analyze_frames: bool) -> int:
        """Calculate credit cost for a video based on per-minute model + vision addon"""
        minutes = max(1, math.ceil(duration_min))  # ceil, minimum 1
        cost = minutes * CREDIT_COSTS["video_per_minute"]
        if analyze_frames:
            cost += minutes * CREDIT_COSTS["vision_per_minute"]
        return cost

    # =============================================
    # Top-Up System
    # =============================================
    @staticmethod
    def get_topup_packs(db: Session, user_id: int) -> dict:
        """Get available top-up packs for user's tier"""
        sub = BillingService._ensure_subscription(db, user_id)
        tier = sub.tier
        tier_idx = BillingService.TIER_ORDER.index(tier) if tier in BillingService.TIER_ORDER else 0

        if tier == "free":
            return {"packs": [], "tier": tier, "topup_allowed": False}

        packs = []
        for pack_id, pack in TOPUP_PACKS.items():
            min_tier = pack["min_tier"]
            min_idx = BillingService.TIER_ORDER.index(min_tier) if min_tier in BillingService.TIER_ORDER else 0
            available = tier_idx >= min_idx
            packs.append({
                "id": pack_id,
                "credits": pack["credits"],
                "price": pack["price"],
                "price_per_credit": round(pack["price"] / pack["credits"], 3),
                "available": available,
            })
        return {"packs": packs, "tier": tier, "topup_allowed": True}

    @staticmethod
    def create_topup_checkout(
        db: Session, user: User, pack_id: str,
        success_url: str = None, cancel_url: str = None
    ) -> Optional[dict]:
        """Create a Stripe checkout session for a top-up pack purchase"""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        sub = BillingService._ensure_subscription(db, user.id)
        if sub.tier == "free":
            raise ValueError("Top-ups are not available on the Free plan. Please upgrade first.")

        pack = TOPUP_PACKS.get(pack_id)
        if not pack:
            raise ValueError(f"Invalid pack: {pack_id}")

        # Check min tier
        tier_idx = BillingService.TIER_ORDER.index(sub.tier) if sub.tier in BillingService.TIER_ORDER else 0
        min_idx = BillingService.TIER_ORDER.index(pack["min_tier"]) if pack["min_tier"] in BillingService.TIER_ORDER else 0
        if tier_idx < min_idx:
            raise ValueError(f"The {pack_id} pack requires {pack['min_tier']}+ plan.")

        customer_id = BillingService.get_or_create_customer(db, user)

        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        success_url = success_url or f"{base_url}/billing/topup-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = cancel_url or f"{base_url}/profile"

        # Create one-time payment checkout (not subscription)
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Video Memory AI — {pack['credits']} Credits Top-Up",
                        "description": f"{pack_id.capitalize()} credit pack",
                    },
                    "unit_amount": int(pack["price"] * 100),  # Stripe uses cents
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": str(user.id),
                "type": "topup",
                "pack_id": pack_id,
                "credits": str(pack["credits"]),
            }
        )

        # Record pending topup
        topup = CreditTopup(
            user_id=user.id,
            pack_id=pack_id,
            credits=pack["credits"],
            price=pack["price"],
            stripe_session_id=session.id,
            status="pending",
        )
        db.add(topup)
        db.commit()

        return {"checkout_url": session.url, "session_id": session.id}

    @staticmethod
    def _handle_topup_completed(db: Session, session_data: dict):
        """Handle successful top-up checkout — add credits to topup_balance"""
        metadata = session_data.get("metadata", {})
        if metadata.get("type") != "topup":
            return

        user_id = int(metadata.get("user_id", 0))
        pack_id = metadata.get("pack_id", "")
        credits = int(metadata.get("credits", 0))
        session_id = session_data.get("id")

        if not user_id or not credits:
            return

        # Mark topup as completed
        topup = db.query(CreditTopup).filter(
            CreditTopup.stripe_session_id == session_id
        ).first()
        if topup:
            topup.status = "completed"

        # Add to topup balance
        sub = BillingService._ensure_subscription(db, user_id)
        sub.topup_balance = (sub.topup_balance or 0) + credits

        # Log transaction
        new_total = (sub.credit_balance or 0) + (sub.topup_balance or 0)
        tx = CreditTransaction(
            user_id=user_id,
            amount=credits,
            balance_after=new_total,
            action="topup_purchase",
            description=f"Purchased {credits} credits ({pack_id} pack)"
        )
        db.add(tx)
        db.commit()

    # =============================================
    # Stripe Customer Management
    # =============================================
    @staticmethod
    def get_or_create_customer(db: Session, user: User) -> Optional[str]:
        """Get or create a Stripe customer for the user"""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        subscription = db.query(Subscription).filter(
            Subscription.user_id == user.id
        ).first()

        if subscription and subscription.stripe_customer_id:
            return subscription.stripe_customer_id

        # Create new Stripe customer
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"user_id": str(user.id)}
        )

        # Update subscription with customer ID
        if subscription:
            subscription.stripe_customer_id = customer.id
            db.commit()

        return customer.id

    # =============================================
    # Checkout Session
    # =============================================
    @staticmethod
    def create_checkout_session(
        db: Session,
        user: User,
        tier: str,
        billing_period: str = "monthly",
        success_url: str = None,
        cancel_url: str = None
    ) -> Optional[dict]:
        """Create a Stripe checkout session for subscription"""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        # Education discount: use education price IDs, but set metadata tier to "pro"
        metadata_tier = tier
        if tier == "education":
            price_key = f"education_{billing_period}"
            metadata_tier = "pro"
        else:
            price_key = f"{tier}_{billing_period}"

        # Get price ID
        price_id = STRIPE_PRICES.get(price_key)
        if not price_id:
            raise ValueError(f"Invalid tier/period: {tier}/{billing_period}")

        # Get or create customer
        customer_id = BillingService.get_or_create_customer(db, user)

        # Default URLs
        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        success_url = success_url or f"{base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = cancel_url or f"{base_url}/pricing"

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": str(user.id),
                "tier": metadata_tier
            }
        )

        return {
            "checkout_url": session.url,
            "session_id": session.id
        }

    # =============================================
    # Customer Portal
    # =============================================
    @staticmethod
    def create_portal_session(
        db: Session,
        user: User,
        return_url: str = None
    ) -> Optional[str]:
        """Create a Stripe customer portal session"""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        subscription = db.query(Subscription).filter(
            Subscription.user_id == user.id
        ).first()

        if not subscription or not subscription.stripe_customer_id:
            return None

        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return_url = return_url or f"{base_url}/profile"

        session = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=return_url
        )

        return session.url

    # =============================================
    # Subscription Management
    # =============================================
    @staticmethod
    def get_subscription(db: Session, user_id: int) -> SubscriptionResponse:
        """Get user's current subscription"""
        sub = BillingService._ensure_subscription(db, user_id)
        tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
        limits = get_tier_limits(sub.tier)

        monthly = sub.credit_balance or 0
        topup = sub.topup_balance or 0

        # Calculate storage used
        storage_used_bytes = db.query(func.coalesce(func.sum(ContentVector.file_size_bytes), 0)).filter(
            ContentVector.user_id == user_id
        ).scalar() or 0
        storage_used_mb = round(storage_used_bytes / (1024 * 1024), 1)

        return SubscriptionResponse(
            tier=sub.tier,
            status=sub.status if sub else "active",
            stripe_customer_id=sub.stripe_customer_id if sub else None,
            stripe_subscription_id=sub.stripe_subscription_id if sub else None,
            period_end=sub.period_end if sub else None,
            cancel_at_period_end=False,
            features=limits["features"],
            credit_balance=monthly + topup,
            monthly_balance=monthly,
            topup_balance=topup,
            credits_monthly=tier_info["credits_monthly"],
            credits_reset_at=sub.credits_reset_at,
            max_video_duration_minutes=limits.get("max_video_duration_minutes", 10),
            vision_analysis=limits.get("vision_analysis", False),
            collections_limit=limits.get("collections_limit", 3),
            chat_queries_per_day=limits.get("chat_queries_per_day", -1),
            export_formats=limits.get("export_formats", ["txt", "md"]),
            flashcard_generation=limits.get("flashcard_generation", False),
            mindmap_generation=limits.get("mindmap_generation", False),
            guide_generation=limits.get("guide_generation", False),
            storage_mb=limits.get("storage_mb", 100),
            ai_model=limits.get("ai_model", "gpt-4o-mini"),
            storage_used_mb=storage_used_mb,
        )

    @staticmethod
    def cancel_subscription(
        db: Session,
        user: User,
        cancel_at_period_end: bool = True
    ) -> Optional[dict]:
        """Cancel user's subscription"""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        subscription = db.query(Subscription).filter(
            Subscription.user_id == user.id
        ).first()

        if not subscription or not subscription.stripe_subscription_id:
            return None

        # Cancel in Stripe
        stripe_sub = stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=cancel_at_period_end
        )

        if not cancel_at_period_end:
            # Immediate cancellation
            stripe.Subscription.delete(subscription.stripe_subscription_id)
            subscription.status = "cancelled"
            subscription.tier = "free"
        else:
            subscription.status = "cancelling"

        db.commit()

        return {
            "message": "Subscription cancelled",
            "status": subscription.status,
            "period_end": subscription.period_end
        }

    # =============================================
    # Legacy Usage Tracking (kept for compatibility)
    # =============================================
    @staticmethod
    def get_videos_processed(db: Session, user_id: int) -> int:
        """Get count of videos/content processed by user this calendar month"""
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = db.query(func.count(ContentVector.id)).filter(
            ContentVector.user_id == user_id,
            ContentVector.created_at >= month_start
        ).scalar()
        return result or 0

    @staticmethod
    def get_storage_used(db: Session, user_id: int) -> float:
        """Get total storage used by user in MB"""
        result = db.query(func.sum(UsageLog.value)).filter(
            UsageLog.user_id == user_id,
            UsageLog.action == "storage_used"
        ).scalar()
        return result or 0.0

    @staticmethod
    def log_video_processed(db: Session, user_id: int, content_id: str, metadata: dict = None):
        """Log a video processing event"""
        import json
        log = UsageLog(
            user_id=user_id,
            action="video_processed",
            resource_id=content_id,
            value=1.0,
            metadata_json=json.dumps(metadata) if metadata else None
        )
        db.add(log)
        db.commit()

    @staticmethod
    def log_storage_used(db: Session, user_id: int, content_id: str, size_mb: float):
        """Log storage usage for a content item"""
        log = UsageLog(
            user_id=user_id,
            action="storage_used",
            resource_id=content_id,
            value=size_mb
        )
        db.add(log)
        db.commit()

    @staticmethod
    def log_api_call(db: Session, user_id: int, endpoint: str):
        """Log an API call (for analytics)"""
        log = UsageLog(
            user_id=user_id,
            action="api_call",
            resource_id=endpoint,
            value=1.0
        )
        db.add(log)
        db.commit()

    @staticmethod
    def get_chat_usage_today(db: Session, user_id: int) -> int:
        """Get count of chat queries used today"""
        today_start = datetime.combine(date.today(), datetime.min.time())
        result = db.query(func.count(UsageLog.id)).filter(
            UsageLog.user_id == user_id,
            UsageLog.action == "chat_query",
            UsageLog.created_at >= today_start
        ).scalar()
        return result or 0

    @staticmethod
    def log_chat_query(db: Session, user_id: int):
        """Log a chat query event"""
        log = UsageLog(
            user_id=user_id,
            action="chat_query",
            value=1.0
        )
        db.add(log)
        db.commit()

    @staticmethod
    def check_limits(db: Session, user_id: int) -> dict:
        """Check credits-based limits"""
        sub = BillingService._ensure_subscription(db, user_id)
        tier_info = TIER_CREDITS.get(sub.tier, TIER_CREDITS["free"])
        monthly = sub.credit_balance or 0
        topup = sub.topup_balance or 0
        total = monthly + topup
        credits_monthly = tier_info["credits_monthly"]

        return {
            "tier": sub.tier,
            "credit_balance": total,
            "monthly_balance": monthly,
            "topup_balance": topup,
            "credits_monthly": credits_monthly,
            "credits_reset_at": sub.credits_reset_at.isoformat() if sub.credits_reset_at else None,
            "within_limits": total > 0,
        }

    # Ordered from lowest to highest
    TIER_ORDER = ["free", "starter", "pro", "team"]

    @staticmethod
    def _find_required_tier(feature: str) -> str:
        """Find the lowest tier where a boolean feature flag is True"""
        for tier in BillingService.TIER_ORDER:
            limits = get_tier_limits(tier)
            if limits.get(feature, False):
                return tier
        return "team"  # Fallback

    @staticmethod
    def check_feature_access(db: Session, user_id: int, feature: str) -> dict:
        """Check if user's tier includes a specific feature"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        has_access = limits.get(feature, False)
        required_tier = BillingService._find_required_tier(feature)
        return {
            "feature": feature,
            "has_access": has_access,
            "current_tier": sub.tier,
            "required_tier": required_tier,
            "upgrade_needed": not has_access
        }

    @staticmethod
    def check_video_duration(db: Session, user_id: int, duration_minutes: float) -> dict:
        """Check if user's tier allows a video of given duration"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        max_duration = limits.get("max_video_duration_minutes", 20)
        allowed = max_duration == -1 or duration_minutes <= max_duration
        # Find lowest tier that allows this duration
        required_tier = sub.tier
        if not allowed:
            for tier in BillingService.TIER_ORDER:
                t_limits = get_tier_limits(tier)
                t_max = t_limits.get("max_video_duration_minutes", 20)
                if t_max == -1 or duration_minutes <= t_max:
                    required_tier = tier
                    break
        return {
            "allowed": allowed,
            "video_duration": duration_minutes,
            "max_duration": max_duration,
            "current_tier": sub.tier,
            "required_tier": required_tier
        }

    @staticmethod
    def get_export_formats(db: Session, user_id: int) -> list:
        """Get export formats allowed by user's tier"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        return limits.get("export_formats", ["txt", "md"])

    @staticmethod
    def check_chat_limit(db: Session, user_id: int) -> dict:
        """Check if user has hit their daily chat query limit"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        daily_limit = limits.get("chat_queries_per_day", 3)
        used_today = BillingService.get_chat_usage_today(db, user_id)
        allowed = daily_limit == -1 or used_today < daily_limit
        return {
            "allowed": allowed,
            "used_today": used_today,
            "limit": daily_limit,
            "tier": sub.tier
        }

    @staticmethod
    def check_collection_limit(db: Session, user_id: int) -> dict:
        """Check if user has hit their collection limit"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        collection_limit = limits.get("collections_limit", 3)
        count = db.query(func.count(Collection.id)).filter(
            Collection.user_id == user_id
        ).scalar() or 0
        allowed = collection_limit == -1 or count < collection_limit
        return {
            "allowed": allowed,
            "count": count,
            "limit": collection_limit,
            "tier": sub.tier
        }

    @staticmethod
    def check_storage(db: Session, user_id: int, additional_bytes: int = 0) -> dict:
        """Check if user has enough storage remaining"""
        sub = BillingService._ensure_subscription(db, user_id)
        limits = get_tier_limits(sub.tier)
        storage_limit_mb = limits.get("storage_mb", 100)

        used_bytes = db.query(func.coalesce(func.sum(ContentVector.file_size_bytes), 0)).filter(
            ContentVector.user_id == user_id
        ).scalar() or 0
        used_mb = used_bytes / (1024 * 1024)
        projected_mb = (used_bytes + additional_bytes) / (1024 * 1024)

        allowed = storage_limit_mb == -1 or projected_mb <= storage_limit_mb
        return {
            "allowed": allowed,
            "used_mb": round(used_mb, 1),
            "limit_mb": storage_limit_mb,
            "current_tier": sub.tier,
        }

    # =============================================
    # Webhook Handling
    # =============================================
    @staticmethod
    def handle_webhook(db: Session, payload: bytes, signature: str) -> dict:
        """Handle Stripe webhook events"""
        if not STRIPE_AVAILABLE or not STRIPE_WEBHOOK_SECRET:
            return {"received": True, "event_type": "unknown", "processed": False}

        try:
            event = stripe.Webhook.construct_event(
                payload, signature, STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise ValueError("Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise ValueError("Invalid signature")

        event_type = event["type"]
        data = event["data"]["object"]

        # Handle different event types
        if event_type == "checkout.session.completed":
            # Route to topup handler if metadata indicates a topup purchase
            if data.get("metadata", {}).get("type") == "topup":
                BillingService._handle_topup_completed(db, data)
            else:
                BillingService._handle_checkout_completed(db, data)

        elif event_type == "customer.subscription.updated":
            BillingService._handle_subscription_updated(db, data)

        elif event_type == "customer.subscription.deleted":
            BillingService._handle_subscription_deleted(db, data)

        elif event_type == "invoice.payment_failed":
            BillingService._handle_payment_failed(db, data)

        return {"received": True, "event_type": event_type, "processed": True}

    @staticmethod
    def _handle_checkout_completed(db: Session, session_data: dict):
        """Handle successful checkout — set tier and reset credits"""
        user_id = int(session_data.get("metadata", {}).get("user_id", 0))
        tier = session_data.get("metadata", {}).get("tier", "pro")
        subscription_id = session_data.get("subscription")
        customer_id = session_data.get("customer")

        if not user_id:
            return

        subscription = db.query(Subscription).filter(
            Subscription.user_id == user_id
        ).first()

        if subscription:
            subscription.tier = tier
            subscription.status = "active"
            subscription.stripe_customer_id = customer_id
            subscription.stripe_subscription_id = subscription_id
            # Reset credits to new tier allocation
            tier_info = TIER_CREDITS.get(tier, TIER_CREDITS["free"])
            subscription.credit_balance = tier_info["credits_monthly"]
            subscription.credits_reset_at = datetime.utcnow()
            db.commit()

    @staticmethod
    def _handle_subscription_updated(db: Session, sub_data: dict):
        """Handle subscription update"""
        subscription_id = sub_data.get("id")
        status = sub_data.get("status")
        period_end = sub_data.get("current_period_end")

        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()

        if subscription:
            subscription.status = status
            if period_end:
                subscription.period_end = datetime.fromtimestamp(period_end)
            db.commit()

    @staticmethod
    def _handle_subscription_deleted(db: Session, sub_data: dict):
        """Handle subscription deletion/cancellation"""
        subscription_id = sub_data.get("id")

        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()

        if subscription:
            subscription.tier = "free"
            subscription.status = "cancelled"
            subscription.stripe_subscription_id = None
            # Reset to free tier credits
            subscription.credit_balance = TIER_CREDITS["free"]["credits_monthly"]
            db.commit()

    @staticmethod
    def _handle_payment_failed(db: Session, invoice_data: dict):
        """Handle failed payment"""
        subscription_id = invoice_data.get("subscription")

        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()

        if subscription:
            subscription.status = "past_due"
            db.commit()
