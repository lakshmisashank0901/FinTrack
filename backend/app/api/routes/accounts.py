from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies import DbDep
from app.schemas.accounts import Account, AccountCreate, AccountList, AccountUpdate
from app.services import accounts as service

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=AccountList)
def list_accounts(db: DbDep, include_archived: bool = False):
    return service.list_accounts(db, include_archived)


@router.post("", response_model=Account, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, db: DbDep):
    return service.create_account(db, payload)


@router.get("/{account_id}", response_model=Account)
def get_account(account_id: UUID, db: DbDep):
    return service.get_account(db, account_id)


@router.patch("/{account_id}", response_model=Account)
def update_account(account_id: UUID, payload: AccountUpdate, db: DbDep):
    return service.update_account(db, account_id, payload)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: UUID, db: DbDep):
    service.delete_account(db, account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
