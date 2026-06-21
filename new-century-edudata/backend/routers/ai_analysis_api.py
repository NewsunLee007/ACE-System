"""
AI学情分析API

DeepSeek key must be provided through the DEEPSEEK_API_KEY environment variable.
The frontend never receives or stores the provider key.
"""

import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.security import get_current_user


router = APIRouter(prefix="/api/v1/ai", tags=["AI学情分析"])


class WeakSubjectPayload(BaseModel):
    subject: str
    score: Optional[float] = None
    full_score: Optional[float] = None
    grade_mean: Optional[float] = None
    gap_to_grade_mean: Optional[float] = None
    score_delta: Optional[float] = None
    remedy: Optional[str] = None


class ExamHistoryPayload(BaseModel):
    exam_name: str
    exam_date: Optional[str] = None
    total_score: Optional[float] = None
    grade_rank: Optional[Any] = None
    grade_percentile: Optional[float] = None
    z_value: Optional[float] = None


class StudentScoreAiRequest(BaseModel):
    student_name: str = Field(..., max_length=80)
    class_name: Optional[str] = Field(None, max_length=80)
    latest_exam_name: Optional[str] = Field(None, max_length=120)
    trend_summary: str = Field(..., max_length=600)
    weak_subjects: List[WeakSubjectPayload] = Field(default_factory=list, max_length=8)
    advantage_subjects: List[WeakSubjectPayload] = Field(default_factory=list, max_length=8)
    history: List[ExamHistoryPayload] = Field(default_factory=list, max_length=10)


class StudentScoreAiResponse(BaseModel):
    success: bool
    provider: str
    model: str
    analysis: str
    generated_at: str


class ScopeScoreAiRequest(BaseModel):
    title: str = Field(..., max_length=120)
    scope_name: str = Field(..., max_length=120)
    latest_exam_name: Optional[str] = Field(None, max_length=120)
    summary: str = Field(..., max_length=800)
    key_metrics: Dict[str, Any] = Field(default_factory=dict)
    weak_points: List[Dict[str, Any]] = Field(default_factory=list, max_length=12)
    focus_students: List[Dict[str, Any]] = Field(default_factory=list, max_length=30)


def _deepseek_settings() -> Dict[str, str]:
    return {
        "api_key": os.getenv("DEEPSEEK_API_KEY", "").strip(),
        "base_url": os.getenv("DEEPSEEK_API_BASE_URL", "https://api.deepseek.com").rstrip("/"),
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat",
    }


def _build_messages(request: StudentScoreAiRequest, current_user: Dict[str, Any]) -> List[Dict[str, str]]:
    user_name = current_user.get("real_name") or current_user.get("username") or "教师"
    system_prompt = (
        "你是一名初中教务数据分析助手。请基于提供的多次考试摘要，"
        "输出面向教师和家长都能理解的学情分析。要求："
        "1. 只依据输入数据，不编造学生隐私或未提供成绩；"
        "2. 重点说明进退步动态、薄弱学科、具体差距和补救方法；"
        "3. 建议要短、可执行、符合学校教务管理场景；"
        "4. 用中文输出，分为【总体判断】【薄弱学科】【补救安排】【家校协同】。"
    )
    user_prompt = {
        "requester": user_name,
        "student": request.student_name,
        "class_name": request.class_name,
        "latest_exam_name": request.latest_exam_name,
        "trend_summary": request.trend_summary,
        "weak_subjects": [item.model_dump() for item in request.weak_subjects],
        "advantage_subjects": [item.model_dump() for item in request.advantage_subjects],
        "history": [item.model_dump() for item in request.history],
    }
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
    ]


def _build_scope_messages(request: ScopeScoreAiRequest, current_user: Dict[str, Any]) -> List[Dict[str, str]]:
    user_name = current_user.get("real_name") or current_user.get("username") or "教师"
    system_prompt = (
        "你是一名初中教务质量分析助手。请基于输入的班级、学科或角色范围成绩摘要，"
        "输出可直接用于教务复盘的中文建议。要求："
        "1. 只依据输入数据，不编造未提供的学生或排名；"
        "2. 先给总体判断，再给风险点和下一步教学动作；"
        "3. 建议要简短、可执行，可分派到班主任、备课组或任课教师；"
        "4. 用【总体判断】【关键问题】【跟进行动】【需要关注学生】四段输出。"
    )
    user_prompt = {
        "requester": user_name,
        "title": request.title,
        "scope_name": request.scope_name,
        "latest_exam_name": request.latest_exam_name,
        "summary": request.summary,
        "key_metrics": request.key_metrics,
        "weak_points": request.weak_points,
        "focus_students": request.focus_students,
    }
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
    ]


async def _request_deepseek(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    settings = _deepseek_settings()
    if not settings["api_key"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI分析未配置：请在后端环境变量中设置 DEEPSEEK_API_KEY"
        )

    payload = {
        "model": settings["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1200,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(
                f"{settings['base_url']}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings['api_key']}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"DeepSeek分析请求失败({exc.response.status_code})"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepSeek分析服务暂不可用"
        ) from exc

    analysis = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    if not analysis:
        raise HTTPException(status_code=502, detail="DeepSeek未返回有效分析内容")

    return {
        "provider": "deepseek",
        "model": settings["model"],
        "analysis": analysis,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/student-score-analysis", response_model=StudentScoreAiResponse)
async def analyze_student_score(
    request: StudentScoreAiRequest,
    current_user: dict = Depends(get_current_user),
):
    result = await _request_deepseek(_build_messages(request, current_user))

    return StudentScoreAiResponse(
        success=True,
        provider=result["provider"],
        model=result["model"],
        analysis=result["analysis"],
        generated_at=result["generated_at"],
    )


@router.post("/class-score-analysis", response_model=StudentScoreAiResponse)
async def analyze_class_score(
    request: ScopeScoreAiRequest,
    current_user: dict = Depends(get_current_user),
):
    result = await _request_deepseek(_build_scope_messages(request, current_user))
    return StudentScoreAiResponse(success=True, **result)


@router.post("/scope-score-analysis", response_model=StudentScoreAiResponse)
async def analyze_scope_score(
    request: ScopeScoreAiRequest,
    current_user: dict = Depends(get_current_user),
):
    result = await _request_deepseek(_build_scope_messages(request, current_user))
    return StudentScoreAiResponse(success=True, **result)
