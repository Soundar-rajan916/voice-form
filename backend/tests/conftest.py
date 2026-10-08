import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from app.db import Base, get_db
from app.main import app
from app.models import User
from app.security import hash_password, create_access_token

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def async_db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestingSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture(scope="function")
async def client(async_db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _get_test_db():
        yield async_db_session

    app.dependency_overrides[get_db] = _get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
async def test_admin_user(async_db_session: AsyncSession) -> User:
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("AdminPass123"),
        role="admin"
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user

@pytest.fixture(scope="function")
async def test_normal_user(async_db_session: AsyncSession) -> User:
    user = User(
        email="user@test.com",
        hashed_password=hash_password("UserPass123"),
        role="user"
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user

@pytest.fixture
def admin_token_headers(test_admin_user: User) -> dict:
    token = create_access_token({"sub": str(test_admin_user.id), "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def user_token_headers(test_normal_user: User) -> dict:
    token = create_access_token({"sub": str(test_normal_user.id), "role": "user"})
    return {"Authorization": f"Bearer {token}"}
