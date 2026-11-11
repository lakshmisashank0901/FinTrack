from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.api.dependencies import DbDep
from app.schemas.backup import Backup, ResetRequest
from app.services import clock, data, demo

router = APIRouter(tags=["data management"])


@router.get("/data/export")
def export_backup(db: DbDep) -> JSONResponse:
    filename = f"fintrack-backup-{clock.user_today(db).isoformat()}.json"
    return JSONResponse(jsonable_encoder(data.export_backup(db)),
                        headers={"Content-Disposition": f'attachment; filename="{filename}"',
                                 "Cache-Control": "no-store"})


@router.post("/data/restore")
def restore_backup(backup: Backup, db: DbDep) -> dict[str, dict[str, int]]:
    return {"restored": data.restore(db, backup)}


@router.post("/data/reset")
def reset_data(_: ResetRequest, db: DbDep) -> dict[str, str]:
    data.reset(db)
    return {"status": "ok"}


@router.get("/demo")
def demo_status(db: DbDep) -> dict[str, bool]:
    return {"loaded": demo.is_loaded(db)}


@router.post("/demo", status_code=201)
def load_demo(db: DbDep) -> dict[str, bool]:
    demo.load_demo(db)
    return {"loaded": True}


@router.delete("/demo")
def remove_demo(db: DbDep) -> dict[str, bool]:
    demo.remove_demo(db)
    return {"loaded": False}
