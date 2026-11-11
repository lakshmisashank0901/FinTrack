def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ok", "database": "ok"}


def test_profile_bootstrap(user):
    r = user.get("/api/profile")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == user.id
    assert body["preferences"]["currency"] == "INR"
    assert len(user.get("/api/categories").json()) == 19
