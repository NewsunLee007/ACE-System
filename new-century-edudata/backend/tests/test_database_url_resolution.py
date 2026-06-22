from core.database import DEFAULT_DATABASE_URL, resolve_database_url


def test_resolves_database_url_first():
    url, key = resolve_database_url(
        {
            "DATABASE_URL": "postgres://user:pass@example.neon.tech/neondb?sslmode=require",
            "POSTGRES_URL": "postgresql://ignored",
        }
    )

    assert key == "DATABASE_URL"
    assert url == "postgresql://user:pass@example.neon.tech/neondb?sslmode=require"


def test_resolves_vercel_neon_postgres_url():
    url, key = resolve_database_url(
        {
            "POSTGRES_URL": "postgres://user:pass@example.neon.tech/neondb?sslmode=require",
        }
    )

    assert key == "POSTGRES_URL"
    assert url == "postgresql://user:pass@example.neon.tech/neondb?sslmode=require"


def test_falls_back_without_provider_url():
    url, key = resolve_database_url({})

    assert key == "fallback"
    assert url == DEFAULT_DATABASE_URL
