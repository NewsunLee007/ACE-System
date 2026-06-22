"""
新纪元教务大数据平台 - FastAPI主入口

技术栈: FastAPI + SQLAlchemy + MySQL
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from core.database import init_db

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
    docs_url="/api/docs",
    redoc_url="/api/redoc"
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


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
