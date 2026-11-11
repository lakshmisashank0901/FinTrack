from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.database import Db, user_transaction
from app.core.errors import AuthError
from app.core.security import AuthUser, verify_access_token

bearer = HTTPBearer(auto_error=False, description="Supabase access token")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise AuthError("Authentication required.")
    return verify_access_token(credentials.credentials, settings)


def get_db(request: Request, user: Annotated[AuthUser, Depends(get_current_user)]) -> Iterator[Db]:
    # One transaction per request; commits when the handler returns, rolls back on any error.
    with user_transaction(user.id, user.claims) as db:
        request.state.user = user
        yield db


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
# scope="function" ensures commit happens before the response is sent.
DbDep = Annotated[Db, Depends(get_db, scope="function")]
