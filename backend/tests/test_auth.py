import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_creates_user_role_only(client: AsyncClient):
    payload = {
        "email": "newuser@example.com",
        "password": "Password123"
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["role"] == "user" # Must be 'user'

@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "dup@example.com",
        "password": "Password123"
    }
    res1 = await client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"]

@pytest.mark.asyncio
async def test_login_success_and_fail(client: AsyncClient, test_normal_user):
    # Success
    res = await client.post("/auth/login", json={
        "email": "user@test.com",
        "password": "UserPass123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "user@test.com"
    assert data["user"]["role"] == "user"

    # Fail
    res_wrong = await client.post("/auth/login", json={
        "email": "user@test.com",
        "password": "WrongPassword"
    })
    assert res_wrong.status_code == 401

@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, user_token_headers):
    res = await client.get("/auth/me", headers=user_token_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "user@test.com"
    assert data["role"] == "user"

@pytest.mark.asyncio
async def test_rate_limiting_login(client: AsyncClient):
    payload = {
        "email": "ratelimit@example.com",
        "password": "WrongPassword"
    }
    for i in range(5):
        res = await client.post("/auth/login", json=payload)
        assert res.status_code == 401

    # 6th attempt should return 429
    res6 = await client.post("/auth/login", json=payload)
    assert res6.status_code == 429
    assert "Too many login attempts" in res6.json()["detail"]
