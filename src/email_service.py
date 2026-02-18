"""
Email Service
Send transactional emails via Resend API
"""

import os
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@videomemory.ai")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@secondmind.app")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """Send a password reset email with the reset link."""
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"

    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Reset URL: {reset_url}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your Video Memory password",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Reset your password</h2>
                <p style="color: #3f3f46;">
                    We received a request to reset your password. Click the button below to choose a new one.
                    This link expires in 1 hour.
                </p>
                <a href="{reset_url}"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    Reset Password
                </a>
                <p style="color: #71717a; font-size: 14px;">
                    If you didn't request this, you can safely ignore this email.
                </p>
            </div>
            """
        })
        logger.info(f"Password reset email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
        return False


def send_team_invite_email(to_email: str, team_name: str, inviter_name: str, invite_token: str) -> bool:
    """Send a team invitation email."""
    accept_url = f"{APP_URL}/app?invite={invite_token}"

    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Invite URL: {accept_url}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": f"You've been invited to join {team_name} on Second Mind",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">You're invited!</h2>
                <p style="color: #3f3f46;">
                    <strong>{inviter_name}</strong> has invited you to join
                    <strong>{team_name}</strong> on Second Mind.
                </p>
                <p style="color: #3f3f46;">
                    Join the team to collaborate on shared research, videos, and knowledge.
                    This invitation expires in 7 days.
                </p>
                <a href="{accept_url}"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    Accept Invitation
                </a>
                <p style="color: #71717a; font-size: 14px;">
                    If you don't have an account yet, you'll be asked to create one first.
                </p>
            </div>
            """
        })
        logger.info(f"Team invite email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send invite email: {e}")
        return False


def send_support_email(user_email: str, user_name: str, subject: str, message: str) -> bool:
    """Forward a support request to the configured support inbox."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Support message from {user_email}: {subject}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [SUPPORT_EMAIL],
            "reply_to": user_email,
            "subject": f"[Support] {subject}",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Support Request</h2>
                <p style="color: #3f3f46;"><strong>From:</strong> {user_name} &lt;{user_email}&gt;</p>
                <p style="color: #3f3f46;"><strong>Subject:</strong> {subject}</p>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 16px 0;" />
                <div style="color: #3f3f46; white-space: pre-wrap;">{message}</div>
            </div>
            """
        })
        logger.info(f"Support email sent from {user_email}: {subject}")
        return True

    except Exception as e:
        logger.error(f"Failed to send support email: {e}")
        return False


def send_welcome_email(email: str, name: str) -> bool:
    """Send a branded welcome email after registration."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Welcome email for {email}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        display_name = name or email.split("@")[0]
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": "Welcome to Second Mind!",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Welcome, {display_name}!</h2>
                <p style="color: #3f3f46;">
                    Thanks for joining <strong>Second Mind</strong> — your AI-powered research assistant.
                </p>
                <h3 style="color: #18181b; font-size: 16px;">Quick start</h3>
                <ol style="color: #3f3f46; padding-left: 20px;">
                    <li>Paste a YouTube link or upload a video to get started</li>
                    <li>Our AI extracts summaries, key points, and transcripts</li>
                    <li>Search across your knowledge base by meaning</li>
                    <li>Generate flashcards, mind maps, and study guides</li>
                </ol>
                <a href="{APP_URL}/app"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    Open Dashboard
                </a>
                <p style="color: #71717a; font-size: 14px; margin-top: 24px;">
                    Questions? Reply to this email or visit our <a href="{APP_URL}/help" style="color: #8b5cf6;">Help Center</a>.
                </p>
            </div>
            """
        })
        logger.info(f"Welcome email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send welcome email: {e}")
        return False


def send_job_complete_email(email: str, name: str, content_title: str, content_id: str) -> bool:
    """Notify user that their video/content has finished processing."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Job complete email for {email}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        display_name = name or "there"
        content_url = f"{APP_URL}/app?content={content_id}"
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": f"Your source is ready: {content_title[:60]}",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Your source is ready!</h2>
                <p style="color: #3f3f46;">
                    Hi {display_name}, <strong>{content_title}</strong> has been processed and is ready to explore.
                </p>
                <a href="{content_url}"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    View Source
                </a>
                <p style="color: #71717a; font-size: 14px;">
                    You can also chat with the transcript, generate flashcards, and more.
                </p>
            </div>
            """
        })
        logger.info(f"Job complete email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send job complete email: {e}")
        return False


def send_low_credit_warning(email: str, name: str, remaining: int, tier: str) -> bool:
    """Warn user when credits drop below 10% of monthly allocation."""
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Low credit warning for {email}")
        return False

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        display_name = name or "there"
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [email],
            "subject": "Your Second Mind credits are running low",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #18181b;">Credits running low</h2>
                <p style="color: #3f3f46;">
                    Hi {display_name}, you have <strong>{remaining} credits</strong> remaining this month
                    on your <strong>{tier.capitalize()}</strong> plan.
                </p>
                <p style="color: #3f3f46;">
                    To keep processing videos and using AI features, you can upgrade your plan
                    or purchase a credit top-up pack.
                </p>
                <a href="{APP_URL}/pricing"
                   style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white;
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
                    Upgrade or Buy Credits
                </a>
                <p style="color: #71717a; font-size: 14px;">
                    Your monthly credits reset automatically at the start of each billing cycle.
                </p>
            </div>
            """
        })
        logger.info(f"Low credit warning sent to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send low credit warning: {e}")
        return False
