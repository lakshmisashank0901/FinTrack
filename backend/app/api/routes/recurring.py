from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies import DbDep
from app.schemas.recurring import (
    RecordPayment,
    RecordResult,
    RecurringCreate,
    RecurringList,
    RecurringPayment,
    RecurringUpdate,
)
from app.services import recurring as service

router = APIRouter(prefix="/recurring-payments", tags=["recurring payments"])


@router.get("", response_model=RecurringList)
def list_payments(db: DbDep):
    return service.list_payments(db)


@router.post("", response_model=RecurringPayment, status_code=status.HTTP_201_CREATED)
def create_payment(payload: RecurringCreate, db: DbDep):
    return service.create_payment(db, payload)


@router.get("/{payment_id}", response_model=RecurringPayment)
def get_payment(payment_id: UUID, db: DbDep):
    return service.get_payment(db, payment_id)


@router.patch("/{payment_id}", response_model=RecurringPayment)
def update_payment(payment_id: UUID, payload: RecurringUpdate, db: DbDep):
    return service.update_payment(db, payment_id, payload)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: UUID, db: DbDep):
    service.delete_payment(db, payment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{payment_id}/record", response_model=RecordResult, status_code=status.HTTP_201_CREATED)
def record_payment(payment_id: UUID, db: DbDep, payload: RecordPayment | None = None):
    return service.record_payment(db, payment_id, payload or RecordPayment())


@router.post("/{payment_id}/skip", response_model=RecurringPayment)
def skip_payment(payment_id: UUID, db: DbDep):
    return service.skip_payment(db, payment_id)
