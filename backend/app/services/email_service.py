import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import List, Dict, Any, Tuple
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import AsyncSessionLocal
from app.models import Submission, FormVersion
from app.services.crypto import decrypt_field_value, mask_field_value

logger = logging.getLogger(__name__)

def build_submission_email_content(
    submission_id: int,
    form_title: str,
    reference_number: str,
    submitted_at: datetime,
    fields_and_answers: List[Dict[str, Any]],
    recipient_email: str
) -> Tuple[str, str]:
    """
    Builds plain-text and mobile-responsive HTML email bodies for a submitted application.
    """
    date_str = submitted_at.strftime("%B %d, %Y at %I:%M %p UTC") if submitted_at else datetime.utcnow().strftime("%B %d, %Y at %I:%M %p UTC")
    office = settings.OFFICE_NAME or "Citizen Service Centre"
    app_name = settings.APP_NAME or "Citizen Desk"

    # Plain text version
    lines = [
        f"============================================================",
        f"{office.upper()} - {app_name.upper()}",
        f"APPLICATION SUBMISSION CONFIRMATION",
        f"============================================================",
        f"",
        f"Dear Applicant,",
        f"",
        f"Your application has been successfully submitted and recorded.",
        f"",
        f"SUBMISSION DETAILS:",
        f"-------------------",
        f"Application:       {form_title}",
        f"Reference Number:  {reference_number}",
        f"Submission ID:     #{submission_id}",
        f"Date & Time:       {date_str}",
        f"Recipient Email:   {recipient_email}",
        f"",
        f"SUBMITTED FORM DETAILS:",
        f"-------------------"
    ]

    for idx, item in enumerate(fields_and_answers, start=1):
        field_label = item.get("field_name", f"Field {idx}").replace("_", " ").title()
        q_text = item.get("question") or field_label
        val = item.get("value") or "—"
        lines.append(f"{idx}. {field_label}")
        lines.append(f"   Question: {q_text}")
        lines.append(f"   Answer:   {val}")
        lines.append("")

    lines.extend([
        f"------------------------------------------------------------",
        f"This is an official automated record. Please retain your reference number",
        f"({reference_number}) for any future status inquiries.",
        f"",
        f"Sincerely,",
        f"{office}",
        f"============================================================"
    ])
    plain_text = "\n".join(lines)

    # HTML Version
    rows_html = []
    for idx, item in enumerate(fields_and_answers, start=1):
        field_label = item.get("field_name", f"Field {idx}").replace("_", " ").title()
        q_text = item.get("question") or field_label
        val = item.get("value") or "—"
        bg_row = "#FFFFFF" if idx % 2 != 0 else "#FBF9F7"
        
        row = f"""
        <tr style="background-color: {bg_row}; border-bottom: 1px solid #E8E2D9;">
            <td style="padding: 12px 14px; font-size: 13px; color: #78716C; text-align: center; vertical-align: top; font-weight: bold; width: 36px;">
                {idx}
            </td>
            <td style="padding: 12px 16px; vertical-align: top;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #78716C; margin-bottom: 3px;">
                    {field_label}
                </div>
                <div style="font-size: 14px; color: #1C1917; font-weight: 500; line-height: 1.4;">
                    {q_text}
                </div>
            </td>
            <td style="padding: 12px 16px; vertical-align: top; font-size: 14px; font-weight: 600; color: #1C1917; background-color: #FAF6F0; width: 45%;">
                {val}
            </td>
        </tr>
        """
        rows_html.append(row)

    table_rows = "".join(rows_html)

    html_text = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Submitted - {reference_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EDEDE9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1C1917; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #EDEDE9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 640px; background-color: #FFFFFF; border: 1px solid #D6CCC2; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #F5EBE0; padding: 24px 28px; border-bottom: 2px solid #D6CCC2;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #78716C; margin-bottom: 4px;">
                      {office}
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #1C1917;">
                      Application Submitted Successfully
                    </h1>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0;">
                      SUBMITTED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Box -->
          <tr>
            <td style="padding: 24px 28px 16px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #44403C;">
                Dear Applicant, your form has been submitted and registered in our official records. Below is a copy of your application details:
              </p>
              
              <table role="presentation" width="100%" style="background-color: #FAF5EF; border: 1px solid #E8E0D5; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #78716C; width: 35%;">Application Type:</td>
                  <td style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #1C1917;">{form_title}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #78716C;">Reference Number:</td>
                  <td style="padding: 4px 0; font-size: 15px; font-weight: 800; font-family: monospace; color: #1C1917;">{reference_number}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #78716C;">Submission ID:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #44403C;">#{submission_id}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #78716C;">Date & Time:</td>
                  <td style="padding: 4px 0; font-size: 13px; font-weight: 500; color: #44403C;">{date_str}</td>
                </tr>
              </table>

              <h2 style="margin: 20px 0 12px 0; font-size: 16px; font-weight: 700; color: #1C1917;">
                Submitted Application Answers
              </h2>
            </td>
          </tr>

          <!-- Answers Table -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table role="presentation" width="100%" style="border-collapse: collapse; border: 1px solid #D6CCC2; border-radius: 8px; overflow: hidden;" cellspacing="0" cellpadding="0">
                <thead>
                  <tr style="background-color: #E3D5CA; border-bottom: 1px solid #D6CCC2;">
                    <th style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #57534E; text-align: center; width: 36px;">#</th>
                    <th style="padding: 10px 16px; font-size: 11px; text-transform: uppercase; color: #57534E; text-align: left;">Field & Question</th>
                    <th style="padding: 10px 16px; font-size: 11px; text-transform: uppercase; color: #57534E; text-align: left;">Submitted Value</th>
                  </tr>
                </thead>
                <tbody>
                  {table_rows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer / Notice -->
          <tr>
            <td style="background-color: #F5EBE0; padding: 20px 28px; border-top: 1px solid #D6CCC2; font-size: 12px; color: #78716C; text-align: center;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #44403C;">
                {office} • Official Electronic Record
              </p>
              <p style="margin: 0; font-size: 11px;">
                Please save this confirmation and reference number <strong>{reference_number}</strong> for future inquiries or tracking.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return plain_text, html_text

def send_email_sync(recipient: str, subject: str, text_body: str, html_body: str) -> bool:
    """
    Synchronously transmits an email via configured SMTP (Gmail).
    Designed to run inside asyncio.to_thread to avoid blocking the event loop.
    """
    if not settings.ENABLE_EMAIL_NOTIFICATIONS:
        logger.info("[EmailService] Email notifications are disabled in settings.")
        return False

    smtp_user = (settings.SMTP_USER or "").strip()
    smtp_pass = (settings.SMTP_PASSWORD or "").strip()
    smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
    smtp_port = settings.SMTP_PORT or 587

    if not smtp_user or not smtp_pass:
        logger.warning(
            "[EmailService] Gmail/SMTP credentials not configured (SMTP_USER / SMTP_PASSWORD). "
            "Could not dispatch email to '%s'. Set SMTP_USER and SMTP_PASSWORD in backend/.env to enable live delivery.",
            recipient
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        from_email = settings.SMTP_FROM_EMAIL.strip() if settings.SMTP_FROM_EMAIL else smtp_user
        from_name = settings.SMTP_FROM_NAME or "Citizen Service Centre"
        msg["From"] = formataddr((from_name, from_email))
        msg["To"] = recipient

        # Attach text and html alternatives
        part1 = MIMEText(text_body, "plain", "utf-8")
        part2 = MIMEText(html_body, "html", "utf-8")
        msg.attach(part1)
        msg.attach(part2)

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        logger.info("[EmailService] Successfully sent submission confirmation email to %s", recipient)
        return True

    except Exception as e:
        logger.error("[EmailService] Failed to send email to %s via %s:%s: %s", recipient, smtp_host, smtp_port, e)
        return False

async def dispatch_submission_email(submission_id: int) -> bool:
    """
    Loads submission data, gathers recipient addresses (from form email answers and user account),
    builds the email content, and dispatches to the user's Gmail.
    """
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(Submission)
                .options(
                    selectinload(Submission.form),
                    selectinload(Submission.version).selectinload(FormVersion.fields),
                    selectinload(Submission.answers),
                    selectinload(Submission.user)
                )
                .where(Submission.id == submission_id)
            )
            sub = res.scalar_one_or_none()
            if not sub:
                logger.warning("[EmailService] Submission #%s not found for email dispatch.", submission_id)
                return False

            form_title = (sub.form.title if sub.form else "Application Form").title()
            ref_no = sub.reference_number or f"REF-{sub.id:06d}"
            submitted_at = sub.submitted_at or datetime.utcnow()

            # Map answers and fields
            fields = sorted(sub.version.fields, key=lambda f: f.position) if sub.version and sub.version.fields else []
            answers_map = {a.field_id: a for a in sub.answers}

            candidate_emails = []

            # 1. Check form answers for an Email field
            for f in fields:
                if f.data_type == "Email" or "email" in f.field_name.lower():
                    ans = answers_map.get(f.id)
                    if ans and ans.value and "@" in str(ans.value):
                        candidate_emails.append(str(ans.value).strip().lower())

            # 2. Check submission user account email
            if sub.user and sub.user.email and "@" in sub.user.email:
                user_email = sub.user.email.strip().lower()
                if user_email not in candidate_emails:
                    candidate_emails.append(user_email)

            if not candidate_emails:
                logger.info(
                    "[EmailService] No recipient email found in submission #%s answers or user account.",
                    submission_id
                )
                return False

            # Prepare fields and answers for table
            table_data = []
            for f in fields:
                ans = answers_map.get(f.id)
                raw_val = ans.value if ans else None
                display_val = "—"
                if raw_val is not None and str(raw_val).strip() != "":
                    if getattr(f, "is_sensitive_number", False):
                        plain = decrypt_field_value(raw_val)
                        display_val = mask_field_value(plain)
                    elif str(raw_val).lower() in ["true", "yes"]:
                        display_val = "Yes"
                    elif str(raw_val).lower() in ["false", "no"]:
                        display_val = "No"
                    else:
                        display_val = str(raw_val)

                q_text = f.question_en or f.field_name.replace("_", " ").title()

                table_data.append({
                    "field_name": f.field_name,
                    "question": q_text,
                    "value": display_val
                })

            subject = f"[{settings.APP_NAME}] Application Submitted: {form_title} ({ref_no})"

            overall_success = False
            for recipient in candidate_emails:
                plain_body, html_body = build_submission_email_content(
                    submission_id=submission_id,
                    form_title=form_title,
                    reference_number=ref_no,
                    submitted_at=submitted_at,
                    fields_and_answers=table_data,
                    recipient_email=recipient
                )

                sent = await asyncio.to_thread(send_email_sync, recipient, subject, plain_body, html_body)
                if sent:
                    overall_success = True

            return overall_success

    except Exception as e:
        logger.error("[EmailService] Error dispatching email for submission #%s: %s", submission_id, e)
        return False
