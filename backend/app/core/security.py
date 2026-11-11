"""Verification of Supabase Auth access tokens.

The user identity used by every route comes exclusively from a token whose
signature, expiry, audience, issuer and role have been verified here.
"""
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWKClient

from app.core.config import Settings
from app.core.errors import AuthError

ASYMMETRIC_ALGORITHMS = {"RS256", "ES256", "EdDSA"}


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    email: str | None
    claims: dict[str, Any]


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=600, timeout=5)


def verify_access_token(token: str, settings: Settings) -> AuthUser:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise AuthError("Malformed access token.") from exc

    algorithm = header.get("alg")
    key: Any
    if algorithm == "HS256":
        if not settings.supabase_jwt_secret:
            raise AuthError("Token algorithm not accepted.")
        key = settings.supabase_jwt_secret
    elif algorithm in ASYMMETRIC_ALGORITHMS:
        try:
            key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token).key
        except jwt.PyJWKClientError as exc:
            raise AuthError("Unable to verify access token signature.") from exc
    else:
        raise AuthError("Token algorithm not accepted.")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "aud", "iss"]},
            leeway=10,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Access token has expired.", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid access token.") from exc

    if claims.get("role") != "authenticated":
        raise AuthError("Token is not for an authenticated user.")
    try:
        user_id = UUID(str(claims["sub"]))
    except ValueError as exc:
        raise AuthError("Invalid token subject.") from exc
    return AuthUser(id=user_id, email=claims.get("email"), claims=claims)
