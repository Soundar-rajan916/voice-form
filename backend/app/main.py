import asyncio
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.db import engine, Base, AsyncSessionLocal
from app.models import User
from app.security import hash_password
from app.routers import auth, admin_forms, forms, submissions, ws, documents, admin_devices, kiosk_desk
from app.services.extraction import extract_answer
from app.services.vision_reader import check_vision_model_availability
from app.services.seed import seed_sample_forms
from app.services.retention import cleanup_expired_submissions

async def _daily_retention_worker():
    """Daily background worker to purge applications past retention period."""
    while True:
        try:
            await asyncio.sleep(86400) # 24 hours
            async with AsyncSessionLocal() as session:
                purged = await cleanup_expired_submissions(session)
                if purged > 0:
                    print(f"[Retention Background Task] Purged {purged} expired applications.")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Retention Background Task Error]: {e}")
            await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security Warning Check for default secrets
    if settings.JWT_SECRET in ("dev_jwt_secret_change_in_production", "supersecretkey_change_in_production", "default_secret_key"):
        print("\n" + "=" * 70)
        print("[SECURITY WARNING] Default JWT_SECRET is in use! Set a strong JWT_SECRET in production.")
        print("=" * 70 + "\n")
    if settings.FERNET_KEY == "A_dummy_fernet_key_change_in_production_32b=":
        print("\n" + "=" * 70)
        print("[SECURITY WARNING] Default FERNET_KEY is in use! Set a dedicated FERNET_KEY in production.")
        print("=" * 70 + "\n")

    # Initialize DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed first admin user if no admin exists & seed sample forms
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.role == "admin"))
        existing_admin = result.scalar_one_or_none()
        if not existing_admin and settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
            admin_user = User(
                email=settings.ADMIN_EMAIL.lower().strip(),
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True
            )
            session.add(admin_user)
            await session.commit()
            print(f"[Startup] Seeded initial admin user: {settings.ADMIN_EMAIL}")

        await seed_sample_forms(session)

        # Run startup retention cleanup
        purged = await cleanup_expired_submissions(session)
        if purged > 0:
            print(f"[Startup Retention] Purged {purged} expired applications on startup.")

    # Start daily background retention task
    retention_task = asyncio.create_task(_daily_retention_worker())

    # Startup Diagnostic: Active STT Provider Log
    stt_provider = (settings.STT_PROVIDER or "groq").lower()
    if stt_provider == "sarvam" and settings.SARVAM_API_KEY and not settings.SARVAM_API_KEY.startswith("dummy"):
        print(f"[STT Service] ACTIVE PROVIDER: Sarvam AI STT (Model: {settings.SARVAM_STT_MODEL})")
    elif settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_dummy"):
        print(f"[STT Service] ACTIVE PROVIDER: Groq Whisper STT (Model: {settings.GROQ_STT_MODEL})")
    else:
        print(f"[STT Service] ACTIVE PROVIDER: Local Simulation Mode (No valid API key set for '{stt_provider}')")

    # Check Vision Model availability
    await check_vision_model_availability()

    # Startup Diagnostic: Check Groq Models & API Key
    if settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_dummy"):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
                )
                if res.status_code == 200:
                    model_list = [m.get("id") for m in res.json().get("data", [])]
                    print(f"[Startup] Verified Groq API Key. Available models count: {len(model_list)}")
                    if settings.GROQ_LLM_MODEL not in model_list:
                        print(f"[WARNING] Configured GROQ_LLM_MODEL '{settings.GROQ_LLM_MODEL}' not in Groq models list!")
                    if settings.GROQ_STT_MODEL not in model_list:
                        print(f"[WARNING] Configured GROQ_STT_MODEL '{settings.GROQ_STT_MODEL}' not in Groq models list!")
                else:
                    print(f"[WARNING] Groq models check returned status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[WARNING] Could not check Groq models endpoint: {e}")

        # Run startup extraction health test
        try:
            test_res, dur, path = await extract_answer(
                field_name="applicant_name",
                data_type="String",
                description="full name of the applicant",
                transcript="My name is Artie Svandararajan."
            )
            print(f"[Startup Health] Extraction Test: Value='{test_res.value}', Fulfilled={test_res.fulfilled}, Latency={dur}s, Path={path}")
        except Exception as e:
            print(f"[WARNING] Startup extraction health check failed: {e}")
    else:
        print("[Startup] GROQ_API_KEY is dummy or unconfigured. Extraction will use rule-based fallback.")

    yield
    retention_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_store_for_kiosk_and_apps(request: Request, call_next):
    """Enforce Cache-Control: no-store on kiosk and application endpoints so citizen data never caches."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/kiosk") or path.startswith("/submissions"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response

app.include_router(auth.router)
app.include_router(admin_forms.router)
app.include_router(forms.router)
app.include_router(submissions.router)
app.include_router(ws.router)
app.include_router(documents.router)
app.include_router(admin_devices.router)
app.include_router(kiosk_desk.router)

@app.get("/")
async def root():
    return {"message": "Citizen Desk API is operational", "app_name": settings.APP_NAME, "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "app_name": settings.APP_NAME}
