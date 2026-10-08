import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.db import engine, Base, AsyncSessionLocal
from app.models import User
from app.security import hash_password
from app.routers import auth, admin_forms, forms, submissions, ws
from app.services.extraction import extract_answer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed first admin user if no admin exists
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.role == "admin"))
        existing_admin = result.scalar_one_or_none()
        if not existing_admin and settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
            admin_user = User(
                email=settings.ADMIN_EMAIL.lower().strip(),
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin"
            )
            session.add(admin_user)
            await session.commit()
            print(f"[Startup] Seeded initial admin user: {settings.ADMIN_EMAIL}")

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
                field_name="full_name",
                data_type="String",
                description="full name of the user",
                transcript="My name is Artie Svandararajan."
            )
            print(f"[Startup Health] Extraction Test: Value='{test_res.value}', Fulfilled={test_res.fulfilled}, Latency={dur}s, Path={path}")
        except Exception as e:
            print(f"[WARNING] Startup extraction health check failed: {e}")
    else:
        print("[Startup] GROQ_API_KEY is dummy or unconfigured. Extraction will use rule-based fallback.")

    yield

app = FastAPI(
    title="VoiceForm API",
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

app.include_router(auth.router)
app.include_router(admin_forms.router)
app.include_router(forms.router)
app.include_router(submissions.router)
app.include_router(ws.router)

@app.get("/")
async def root():
    return {"message": "VoiceForm API is operational", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
