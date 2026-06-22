"""
新纪元教务大数据平台 - FastAPI主入口

技术栈: FastAPI + SQLAlchemy + MySQL
"""

import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import uvicorn
import logging

from routers import (
    dashboard_api,
    class_longitudinal_api,
    parent_query_api,
    data_import_api,
    auth_api,
    exam_management_api,
    class_management_api,
    student_management_api,
    teacher_management_api,
    teacher_duties_api,
    parent_management_api,
    role_settings_api,
    subject_management_api,
    report_api,
    audit_api,
    absence_management_api,
    score_analysis_api,
    layered_analysis_api,
    ai_analysis_api,
    score_visibility_api
)
from core.database import DATABASE_URL, DATABASE_URL_ENV_KEY, DATABASE_URL_ENV_KEYS, SessionLocal, get_db_dialect, init_db

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="新纪元教务大数据平台 API",
    description="瑞安市新纪元实验学校 - 初中教务协同与精准学情分析平台",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_api.router)
app.include_router(dashboard_api.router)
app.include_router(class_longitudinal_api.router)
app.include_router(parent_query_api.router)
app.include_router(data_import_api.router)
app.include_router(exam_management_api.router)
app.include_router(class_management_api.router)
app.include_router(student_management_api.router)
app.include_router(teacher_management_api.router)
app.include_router(teacher_duties_api.router)
app.include_router(parent_management_api.router)
app.include_router(role_settings_api.router)
app.include_router(subject_management_api.router)
app.include_router(report_api.router)
app.include_router(audit_api.router)
app.include_router(absence_management_api.router)
app.include_router(score_analysis_api.router)
app.include_router(layered_analysis_api.router)
app.include_router(ai_analysis_api.router)
app.include_router(score_visibility_api.router)


@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("新纪元教务大数据平台启动中...")
    # init_db()  # 如需自动创建表，取消注释


@app.get("/")
def root():
    """根路径"""
    return {
        "message": "新纪元教务大数据平台 API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy"}


def _database_url_source() -> str:
    return "environment" if DATABASE_URL_ENV_KEY != "fallback" else "fallback"


def _database_target() -> str:
    url = DATABASE_URL.lower()
    if url.startswith(("postgresql://", "postgres://")):
        return "postgresql"
    if url.startswith("mysql"):
        return "mysql"
    return "unknown"


@app.get("/ready")
@app.get("/api/ready")
def readiness_check():
    """业务就绪检查：验证数据库配置、连接和核心演示数据。"""
    payload = {
        "status": "ready",
        "checks": {
            "database_url_source": _database_url_source(),
            "database_url_key": DATABASE_URL_ENV_KEY,
            "database_target": _database_target(),
            "database_url_configured": DATABASE_URL_ENV_KEY != "fallback",
            "database_connection": False,
            "seed_data": False,
        },
        "tables": {},
    }

    if not payload["checks"]["database_url_configured"]:
        payload["status"] = "not_ready"
        payload["reason"] = (
            "No supported database URL environment variable is configured; runtime is using "
            f"the local fallback database URL. Supported keys: {', '.join(DATABASE_URL_ENV_KEYS)}."
        )
        return JSONResponse(status_code=503, content=payload)

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        payload["checks"]["database_connection"] = True
        payload["checks"]["database_dialect"] = get_db_dialect(db)

        required_tables = {
            "sys_users": 1,
            "biz_students": 1,
            "biz_parent_student_rel": 1,
            "biz_exams": 1,
            "biz_scores": 1,
            "biz_class_layers": 1,
        }
        for table_name, minimum_count in required_tables.items():
            count = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
            payload["tables"][table_name] = int(count)
            if count < minimum_count:
                payload["status"] = "not_ready"

        payload["checks"]["seed_data"] = payload["status"] == "ready"
        if payload["status"] != "ready":
            payload["reason"] = "Database is reachable, but required seeded business data is missing."
            return JSONResponse(status_code=503, content=payload)

        return payload
    except Exception as exc:
        logger.error("业务就绪检查失败: %s", exc)
        payload["status"] = "not_ready"
        payload["checks"]["database_dialect"] = get_db_dialect(db)
        payload["error_type"] = exc.__class__.__name__
        payload["reason"] = "Database connection or schema check failed."
        return JSONResponse(status_code=503, content=payload)
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
