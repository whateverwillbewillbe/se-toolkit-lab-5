"""Router for analytics endpoints.

Each endpoint performs SQL aggregation queries on the interaction data
populated by the ETL pipeline. All endpoints require a `lab` query
parameter to filter results by lab (e.g., "lab-01").
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models.interaction import InteractionLog
from app.models.item import ItemRecord
from app.models.learner import Learner

router = APIRouter()


@router.get("/scores")
async def get_scores(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Score distribution histogram for a given lab.

    - Find the lab item by matching title (e.g. "lab-04" → title contains "Lab 04")
    - Find all tasks that belong to this lab (parent_id = lab.id)
    - Query interactions for these items that have a score
    - Group scores into buckets: "0-25", "26-50", "51-75", "76-100"
      using CASE WHEN expressions
    - Return a JSON array:
      [{"bucket": "0-25", "count": 12}, {"bucket": "26-50", "count": 8}, ...]
    - Always return all four buckets, even if count is 0
    """
    # Convert lab-04 to "Lab 04" pattern for matching
    # lab-04 -> Lab 04, lab-01 -> Lab 01
    lab_title_pattern = f"Lab {lab.replace('lab-', '')}"

    # Find the lab item
    stmt = select(ItemRecord).where(
        ItemRecord.type == "lab",
        ItemRecord.title.contains(lab_title_pattern)
    )
    lab_record = (await session.exec(stmt)).scalars().first()

    if not lab_record:
        return [
            {"bucket": "0-25", "count": 0},
            {"bucket": "26-50", "count": 0},
            {"bucket": "51-75", "count": 0},
            {"bucket": "76-100", "count": 0},
        ]

    lab_id = lab_record.id

    # Find all task items that belong to this lab
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_id)
    )
    task_ids = [row.id for row in task_items.all()]

    # Also include the lab itself for interactions
    all_item_ids = task_ids + [lab_id]

    # Query interactions with score bucket aggregation
    bucket_expr = case(
        (InteractionLog.score <= 25, "0-25"),
        (InteractionLog.score <= 50, "26-50"),
        (InteractionLog.score <= 75, "51-75"),
        (InteractionLog.score <= 100, "76-100"),
        else_="0-25"  # Default for NULL or out of range
    ).label("bucket")

    stmt = (
        select(bucket_expr, func.count(InteractionLog.id).label("count"))
        .where(
            InteractionLog.item_id.in_(all_item_ids),
            InteractionLog.score.isnot(None)
        )
        .group_by(bucket_expr)
    )

    result = await session.exec(stmt)
    bucket_counts = {row.bucket: row.count for row in result.all()}

    # Always return all four buckets
    return [
        {"bucket": "0-25", "count": bucket_counts.get("0-25", 0)},
        {"bucket": "26-50", "count": bucket_counts.get("26-50", 0)},
        {"bucket": "51-75", "count": bucket_counts.get("51-75", 0)},
        {"bucket": "76-100", "count": bucket_counts.get("76-100", 0)},
    ]


@router.get("/pass-rates")
async def get_pass_rates(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-task pass rates for a given lab.

    - Find the lab item and its child task items
    - For each task, compute:
      - avg_score: average of interaction scores (round to 1 decimal)
      - attempts: total number of interactions
    - Return a JSON array:
      [{"task": "Repository Setup", "avg_score": 92.3, "attempts": 150}, ...]
    - Order by task title
    """
    # Convert lab-04 to "Lab 04" pattern for matching
    lab_title_pattern = f"Lab {lab.replace('lab-', '')}"

    # Find the lab item
    lab_record = (await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_title_pattern)
        )
    )).scalars().first()

    if not lab_record:
        return []

    lab_id = lab_record.id

    # Find all task items that belong to this lab
    task_items = (await session.exec(
        select(ItemRecord).where(ItemRecord.parent_id == lab_id)
    )).scalars().all()

    result = []
    for task in task_items:
        # Query interactions for this task
        stmt = (
            select(
                func.avg(InteractionLog.score).label("avg_score"),
                func.count(InteractionLog.id).label("attempts")
            )
            .where(InteractionLog.item_id == task.id)
        )
        query_result = await session.exec(stmt)
        row = query_result.first()

        if row and row.attempts > 0:
            avg_score = round(row.avg_score, 1) if row.avg_score else 0.0
            result.append({
                "task": task.title,
                "avg_score": avg_score,
                "attempts": row.attempts,
            })

    # Order by task title
    result.sort(key=lambda x: x["task"])
    return result


@router.get("/timeline")
async def get_timeline(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Submissions per day for a given lab.

    - Find the lab item and its child task items
    - Group interactions by date (use func.date(created_at))
    - Count the number of submissions per day
    - Return a JSON array:
      [{"date": "2026-02-28", "submissions": 45}, ...]
    - Order by date ascending
    """
    # Convert lab-04 to "Lab 04" pattern for matching
    lab_title_pattern = f"Lab {lab.replace('lab-', '')}"

    # Find the lab item
    lab_record = (await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_title_pattern)
        )
    )).scalars().first()

    if not lab_record:
        return []

    lab_id = lab_record.id

    # Find all task items that belong to this lab
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_id)
    )
    task_ids = [row.id for row in task_items.all()]

    # Also include the lab itself for interactions
    all_item_ids = task_ids + [lab_id]

    # Group interactions by date
    date_col = func.date(InteractionLog.created_at).label("date")
    stmt = (
        select(date_col, func.count(InteractionLog.id).label("submissions"))
        .where(InteractionLog.item_id.in_(all_item_ids))
        .group_by(date_col)
        .order_by(date_col)
    )

    result = await session.exec(stmt)
    return [
        {"date": row.date, "submissions": row.submissions}
        for row in result.all()
    ]


@router.get("/groups")
async def get_groups(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-group performance for a given lab.

    - Find the lab item and its child task items
    - Join interactions with learners to get student_group
    - For each group, compute:
      - avg_score: average score (round to 1 decimal)
      - students: count of distinct learners
    - Return a JSON array:
      [{"group": "B23-CS-01", "avg_score": 78.5, "students": 25}, ...]
    - Order by group name
    """
    # Convert lab-04 to "Lab 04" pattern for matching
    lab_title_pattern = f"Lab {lab.replace('lab-', '')}"

    # Find the lab item
    lab_record = (await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_title_pattern)
        )
    )).scalars().first()

    if not lab_record:
        return []

    lab_id = lab_record.id

    # Find all task items that belong to this lab
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_id)
    )
    task_ids = [row.id for row in task_items.all()]

    # Also include the lab itself for interactions
    all_item_ids = task_ids + [lab_id]

    # Join interactions with learners and group by student_group
    stmt = (
        select(
            Learner.student_group.label("group"),
            func.avg(InteractionLog.score).label("avg_score"),
            func.count(func.distinct(Learner.id)).label("students")
        )
        .join(InteractionLog, InteractionLog.learner_id == Learner.id)
        .where(InteractionLog.item_id.in_(all_item_ids))
        .group_by(Learner.student_group)
        .order_by(Learner.student_group)
    )

    result = await session.exec(stmt)
    return [
        {
            "group": row.group,
            "avg_score": round(row.avg_score, 1) if row.avg_score else 0.0,
            "students": row.students,
        }
        for row in result.all()
    ]
