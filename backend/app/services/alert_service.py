import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Tuple
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger("sentinel.alert_service")


class AlertService:
    """
    Native Python smtplib email notification service with HTML templates.
    No commercial third-party API dependencies.
    """

    @classmethod
    def _create_smtp_connection(cls) -> smtplib.SMTP:
        """Establishes an SMTP connection configured with timeout and TLS/SSL."""
        host = settings.SMTP_HOST.strip()
        port = int(settings.SMTP_PORT)
        timeout = 10

        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout)
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
            if settings.SMTP_USE_TLS:
                server.starttls()

        username = settings.SMTP_USERNAME.strip() if settings.SMTP_USERNAME else None
        # Clean password (remove spaces common in Google App Passwords)
        password = settings.SMTP_PASSWORD.replace(" ", "").strip() if settings.SMTP_PASSWORD else None

        if username and password:
            server.login(username, password)

        return server

    @classmethod
    def _render_email_body(
        cls,
        title: str,
        badge_text: str,
        badge_color: str,
        details: List[Tuple[str, str]]
    ) -> Tuple[str, str]:
        """Generates both modern HTML and plain-text email bodies."""
        rows_html = "".join([
            f"""<tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0; width: 35%;">{label}</td>
                <td style="padding: 8px 12px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">{val}</td>
            </tr>"""
            for label, val in details
        ])

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
  .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
  .header {{ padding: 24px; border-bottom: 1px solid #e2e8f0; text-align: left; }}
  .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; letter-spacing: 0.05em; color: #ffffff; background-color: {badge_color}; }}
  .title {{ margin: 12px 0 0 0; font-size: 20px; color: #0f172a; }}
  .content {{ padding: 24px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  .footer {{ padding: 16px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">{badge_text}</span>
      <h1 class="title">{title}</h1>
    </div>
    <div class="content">
      <table>
        {rows_html}
      </table>
    </div>
    <div class="footer">
      Sent by <strong>Uptimistic-Sentinel</strong> • Self-Hosted Internal Infrastructure Monitor
    </div>
  </div>
</body>
</html>"""

        plain = f"{title}\nStatus: {badge_text}\n" + "-" * 40 + "\n"
        for label, val in details:
            plain += f"{label}: {val}\n"
        plain += "\n--\nUptimistic-Sentinel Self-Hosted Monitor"

        return plain, html

    @classmethod
    def send_alert(
        cls,
        target_name: str,
        target_protocol: str,
        target_host: str,
        alert_type: str,  # 'DOWN' or 'RECOVERED'
        recipients: List[str],
        error_reason: Optional[str] = None,
        latency_ms: Optional[int] = None,
        consecutive_failures: int = 1
    ) -> Tuple[bool, Optional[str]]:
        """
        Sends state transition alert email (DOWN or RECOVERED) to all configured recipients.
        """
        if not recipients:
            return False, "No recipient email addresses provided"

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        if alert_type == "DOWN":
            badge_text = "INCIDENT ALERT: DOWN"
            badge_color = "#ef4444"  # Red
            subject = f"[DOWN ALERT] {target_name} is DOWN"
            title = f"Service Outage Detected: {target_name}"
            details = [
                ("Target Name", target_name),
                ("Protocol", target_protocol),
                ("Endpoint", target_host),
                ("Consecutive Failures", str(consecutive_failures)),
                ("Root Cause", error_reason or "Target did not respond within timeout"),
                ("Detected At", now_str),
            ]
        elif alert_type == "RECOVERED":
            badge_text = "RECOVERED: BACK ONLINE"
            badge_color = "#10b981"  # Emerald Green
            subject = f"[RECOVERED] {target_name} is UP"
            title = f"Service Restored: {target_name}"
            details = [
                ("Target Name", target_name),
                ("Protocol", target_protocol),
                ("Endpoint", target_host),
                ("Response Time", f"{latency_ms} ms" if latency_ms is not None else "Normal"),
                ("Restored At", now_str),
            ]
        else:
            return False, f"Unknown alert_type: {alert_type}"

        plain_text, html_text = cls._render_email_body(title, badge_text, badge_color, details)

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_DEFAULT_FROM
            msg["To"] = ", ".join(recipients)
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_text, "html", "utf-8"))

            with cls._create_smtp_connection() as server:
                server.sendmail(settings.SMTP_DEFAULT_FROM, recipients, msg.as_string())

            logger.info("Alert email '%s' delivered to %s", subject, recipients)
            return True, None

        except Exception as e:
            err_msg = f"Failed sending {alert_type} alert email: {str(e)}"
            logger.error(err_msg)
            return False, err_msg

    @classmethod
    def send_test_email(cls, recipients: List[str]) -> Tuple[bool, str]:
        """Sends a verification email to test SMTP settings."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        subject = "[TEST ALERT] Uptimistic-Sentinel SMTP Test"
        title = "SMTP Notification Test"
        badge_text = "TEST NOTIFICATION"
        badge_color = "#3b82f6"  # Blue

        details = [
            ("Test Status", "SMTP connection and delivery successful"),
            ("Triggered At", now_str),
            ("Sender", settings.SMTP_DEFAULT_FROM),
            ("Server Host", f"{settings.SMTP_HOST}:{settings.SMTP_PORT}"),
            ("Recipients", ", ".join(recipients)),
        ]

        plain_text, html_text = cls._render_email_body(title, badge_text, badge_color, details)

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_DEFAULT_FROM
            msg["To"] = ", ".join(recipients)
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_text, "html", "utf-8"))

            with cls._create_smtp_connection() as server:
                server.sendmail(settings.SMTP_DEFAULT_FROM, recipients, msg.as_string())

            return True, f"Test email successfully dispatched to {', '.join(recipients)}"
        except Exception as e:
            return False, f"SMTP delivery failure: {str(e)}"
