from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DbDep
from app.schemas.profile import Onboarding, Profile, ProfileUpdate
from app.services import profile as service

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=Profile)
def get_profile(db: DbDep, user: CurrentUser):
    return service.get_profile(db, user)


@router.patch("/profile", response_model=Profile)
def update_profile(payload: ProfileUpdate, db: DbDep, user: CurrentUser):
    return service.update_profile(db, user, payload)


@router.get("/onboarding", response_model=Onboarding)
def onboarding(db: DbDep):
    return service.onboarding(db)
