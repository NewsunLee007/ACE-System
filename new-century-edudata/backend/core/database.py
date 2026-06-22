"""
数据库核心配置
提供SQLAlchemy会话管理和连接池配置
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator, Optional
import os

# 数据库配置
DATABASE_URL_ENV_KEYS = (
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "NEON_DATABASE_URL",
)
DEFAULT_DATABASE_URL = "mysql+pymysql://root:NewCentury2025!@localhost:3306/new_century_edudata?charset=utf8mb4"


def normalize_database_url(url: str) -> str:
    """Normalize provider-specific Postgres URL variants for SQLAlchemy."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def resolve_database_url(environment: Optional[dict[str, str]] = None) -> tuple[str, str]:
    """Resolve the database URL from common Vercel/Neon environment names."""
    source = environment if environment is not None else os.environ
    for key in DATABASE_URL_ENV_KEYS:
        value = source.get(key)
        if value:
            return normalize_database_url(value), key
    return DEFAULT_DATABASE_URL, "fallback"


DATABASE_URL, DATABASE_URL_ENV_KEY = resolve_database_url()

# 创建引擎
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

# 会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话的依赖函数
    
    用于FastAPI的Depends注入
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库
    
    创建所有表结构
    """
    Base.metadata.create_all(bind=engine)


def get_db_dialect(db: Optional[Session] = None) -> str:
    """Return the active SQLAlchemy dialect name for raw-SQL compatibility branches."""
    bind = None
    if db is not None:
        try:
            bind = db.get_bind()
        except Exception:
            bind = getattr(db, "bind", None)

    dialect = getattr(getattr(bind, "dialect", None), "name", None)
    if not dialect:
        dialect = getattr(engine.dialect, "name", None)
    return (dialect or "mysql").lower()


def is_postgresql(db: Optional[Session] = None) -> bool:
    return get_db_dialect(db) in {"postgresql", "postgres"}


def is_sqlite(db: Optional[Session] = None) -> bool:
    return get_db_dialect(db) == "sqlite"
