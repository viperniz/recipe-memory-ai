"""
Email Service
Send transactional emails via Resend API
"""

import os
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@videomemory.ai")
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
