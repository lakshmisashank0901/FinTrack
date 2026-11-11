from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies import DbDep
from app.schemas.savings import Contribution, ContributionCreate, GoalCreate, GoalUpdate, SavingsGoal, SavingsGoalList
from app.services import savings as service

router = APIRouter(prefix="/savings-goals", tags=["savings goals"])


@router.get("", response_model=SavingsGoalList)
def list_goals(db: DbDep, include_archived: bool = False):
    return service.list_goals(db, include_archived)


@router.post("", response_model=SavingsGoal, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, db: DbDep):
    return service.create_goal(db, payload)


@router.get("/{goal_id}", response_model=SavingsGoal)
def get_goal(goal_id: UUID, db: DbDep):
    return service.get_goal(db, goal_id)


@router.patch("/{goal_id}", response_model=SavingsGoal)
def update_goal(goal_id: UUID, payload: GoalUpdate, db: DbDep):
    return service.update_goal(db, goal_id, payload)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: UUID, db: DbDep):
    service.delete_goal(db, goal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{goal_id}/contributions", response_model=list[Contribution])
def list_contributions(goal_id: UUID, db: DbDep):
    service.get_goal(db, goal_id)
    return service.list_contributions(db, goal_id)


@router.post("/{goal_id}/contributions", response_model=SavingsGoal, status_code=status.HTTP_201_CREATED)
def add_contribution(goal_id: UUID, payload: ContributionCreate, db: DbDep):
    return service.add_contribution(db, goal_id, payload)


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=SavingsGoal)
def delete_contribution(goal_id: UUID, contribution_id: UUID, db: DbDep):
    return service.delete_contribution(db, goal_id, contribution_id)
