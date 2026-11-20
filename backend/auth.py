
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from pwdlib import PasswordHash
from sqlalchemy import String, create_engine, select
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

JWT_SECRET = os.getenv("JWT_SECRET", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "ai_healthmap")

if len(JWT_SECRET) < 32:
    raise RuntimeError("Set a strong JWT_SECRET in backend/.env")

database_url = URL.create(
    "mysql+pymysql",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
)

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    username: str


class RequestOtpRequest(BaseModel):
    identifier: str
    channel: str = "email"


class VerifyOtpRequest(BaseModel):
    identifier: str
    otp: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(username: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=60)
    payload = {"sub": username, "exp": expires}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired login token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        if not username:
            raise error
    except jwt.InvalidTokenError:
        raise error

    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise error

    return user


@router.on_event("startup")
def initialize_auth_database():
    Base.metadata.create_all(bind=engine)

    username = os.getenv("ADMIN_USERNAME", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    if not username or len(admin_password) < 12:
        raise RuntimeError(
            "Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters in backend/.env"
        )

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == username))
        if existing is None:
            db.add(
                User(
                    username=username,
                    password_hash=password_hash.hash(admin_password),
                    is_active=True,
                )
            )
            db.commit()


@router.post("/login", response_model=LoginResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.username == form.username))

    if (
        user is None
        or not user.is_active
        or not password_hash.verify(form.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return LoginResponse(
        access_token=create_access_token(user.username),
        token_type="bearer",
        username=user.username,
    )


@router.get("/me")
def current_user(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "is_active": user.is_active}


# -------------------- FORGOT PASSWORD & OTP WORKFLOW --------------------
otp_cache: dict[str, dict[str, Any]] = {}


def send_email_otp(to_email: str, otp: str) -> tuple[bool, str]:
    """
    Send OTP via Gmail SMTP using credentials configured in backend/.env.
    Requires SMTP_EMAIL and a 16-character Google App Password in SMTP_PASSWORD.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_email = os.getenv("SMTP_EMAIL", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    if not smtp_email or not smtp_password:
        return (
            False,
            "Gmail SMTP credentials are not set in backend/.env. Please configure SMTP_EMAIL and SMTP_PASSWORD (Google App Password) to deliver real emails to your Gmail inbox.",
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"AI HealthMap - Password Reset Verification OTP: {otp}"
    msg["From"] = f"AI HealthMap Security <{smtp_email}>"
    msg["To"] = to_email

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
        .container {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; }}
        .badge {{ display: inline-block; background-color: #eff6ff; color: #2563eb; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px; }}
        .otp-box {{ text-align: center; margin: 24px 0; background: #f8fafc; border: 2px dashed #93c5fd; border-radius: 10px; padding: 18px; }}
        .otp-code {{ font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; font-family: monospace; }}
        .footer {{ font-size: 11px; color: #64748b; text-align: center; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align: center;">
          <span class="badge">🛡️ AI HealthMap Security</span>
          <h2 style="color: #0f172a; margin: 10px 0 4px 0;">Password Reset Verification</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Use the 6-digit OTP code below to verify your account.</p>
        </div>

        <div class="otp-box">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Your 6-Digit OTP Code</div>
          <div class="otp-code">{otp}</div>
          <div style="font-size: 11px; color: #dc2626; margin-top: 6px; font-weight: 600;">Valid for 20 seconds</div>
        </div>

        <p style="font-size: 12px; color: #475569; line-height: 1.5;">
          If you did not request this OTP, please ignore this email. Do not share this OTP with anyone for account security.
        </p>

        <div class="footer">
          © AI HealthMap · National Disease Surveillance & Outbreak Intelligence
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, [to_email], msg.as_string())
        return True, "Email successfully sent to your Gmail inbox."
    except smtplib.SMTPAuthenticationError:
        return (
            False,
            "Gmail authentication failed. Please verify your Gmail address and 16-character Google App Password in backend/.env.",
        )
    except Exception as exc:
        return False, f"SMTP delivery error: {str(exc)}"


@router.post("/forgot-password/request-otp")
def request_password_reset_otp(data: RequestOtpRequest, db: Session = Depends(get_db)):
    ident = data.identifier.strip().lower()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your registered Email, Mobile number, or Username",
        )

    # Locate user in database
    user = db.scalar(select(User).where(User.username == data.identifier.strip()))
    if user is None:
        all_users = db.scalars(select(User)).all()
        for u in all_users:
            if u.username.lower() == ident:
                user = u
                break
        if user is None and ("@" in data.identifier or data.identifier.isdigit() or "admin" in ident):
            user = db.scalar(select(User).where(User.username == "admin"))

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found associated with this Email / Mobile number / Username.",
        )

    # Generate 6-digit cryptographic OTP
    otp_code = str(secrets.randbelow(900000) + 100000)
    # Set to 20 seconds validity as requested by user
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=20)

    otp_cache[ident] = {
        "otp": otp_code,
        "username": user.username,
        "expires_at": expires_at,
        "attempts": 0,
        "channel": data.channel,
    }

    # Masked representation for display
    raw = data.identifier.strip()
    if "@" in raw:
        parts = raw.split("@")
        masked = parts[0][:2] + "****@" + parts[1]
    elif raw.isdigit() and len(raw) >= 10:
        masked = raw[:2] + "******" + raw[-2:]
    else:
        masked = raw[:2] + "****"

    channel_name = "Gmail / Email" if data.channel.lower() == "email" else "Mobile SMS"

    # Attempt real email delivery if an email address is provided
    target_email = raw if "@" in raw else ""
    email_sent = False
    delivery_note = ""

    if target_email:
        email_sent, delivery_note = send_email_otp(target_email, otp_code)

    return {
        "status": "success",
        "message": f"Verification OTP sent to {masked} via {channel_name}",
        "channel": data.channel,
        "identifier": ident,
        "expires_in_seconds": 20,
        "email_sent": email_sent,
        "delivery_note": delivery_note,
    }


@router.post("/forgot-password/verify-otp")
def verify_password_reset_otp(data: VerifyOtpRequest):
    ident = data.identifier.strip().lower()
    cached = otp_cache.get(ident)

    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or not found. Please click Resend OTP to get a new code.",
        )

    if datetime.now(timezone.utc) > cached["expires_at"]:
        otp_cache.pop(ident, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired after 20 seconds. Please request a new code.",
        )

    if cached["attempts"] >= 5:
        otp_cache.pop(ident, None)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Please request a new OTP code.",
        )

    if data.otp.strip() != cached["otp"]:
        cached["attempts"] += 1
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP code. {5 - cached['attempts']} attempts remaining.",
        )

    # OTP is valid! Issue signed JWT reset token with 15-minute expiry
    username = cached["username"]
    otp_cache.pop(ident, None)

    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": username,
        "purpose": "password_reset",
        "exp": expires,
    }
    reset_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return {
        "status": "success",
        "message": "OTP verification successful. You can now set your new password.",
        "reset_token": reset_token,
        "username": username,
    }


@router.post("/forgot-password/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    try:
        payload = jwt.decode(data.reset_token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("purpose") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token purpose for password reset.",
            )
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed reset token.",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset session expired. Please verify OTP again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authentication token.",
        )

    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.password_hash = password_hash.hash(data.new_password)
    db.commit()

    return {
        "status": "success",
        "message": "Password reset successfully! You can now sign in with your new password.",
    }
