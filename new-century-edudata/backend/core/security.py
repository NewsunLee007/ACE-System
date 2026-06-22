"""
安全模块
提供JWT认证、密码加密、权限验证等功能
"""

from datetime import datetime, timedelta
from typing import Iterable, Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import get_db

# 安全配置
SECRET_KEY = "your-secret-key-change-in-production-min-32-chars-long"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24小时

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
BCRYPT_MAX_PASSWORD_BYTES = 72

# HTTP Bearer认证
security_scheme = HTTPBearer()

SUPER_PERMISSION_CODES = {"sys_admin", "edu_admin"}
PARENT_STUDENT_ACCESS_TOKEN_TYPE = "parent_student_access"

PERMISSION_HIERARCHY = {
    "sys_admin": 10,
    "edu_admin": 9,
    "exam_admin": 8,
    "grade_leader": 7,
    "subject_leader": 6,
    "lesson_leader": 5,
    "headmaster": 4,
    "teacher": 3,
    "parent": 2,
    "custom": 1,
}

# Semantic permissions used by analysis routers. Keep these explicit so a typo
# or new permission label cannot accidentally become available to everyone.
SEMANTIC_PERMISSION_MIN_LEVELS = {
    "layer_manage": PERMISSION_HIERARCHY["exam_admin"],
    "analysis_execute": PERMISSION_HIERARCHY["exam_admin"],
    "analysis_publish": PERMISSION_HIERARCHY["grade_leader"],
    "analysis_admin": PERMISSION_HIERARCHY["edu_admin"],
    "analysis_view": PERMISSION_HIERARCHY["subject_leader"],
}


def is_bcrypt_password_length_valid(password: str) -> bool:
    """Return whether bcrypt can hash or verify this password safely."""
    return len(str(password or "").encode("utf-8")) <= BCRYPT_MAX_PASSWORD_BYTES


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if not is_bcrypt_password_length_valid(plain_password):
        return False
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """获取密码哈希"""
    if not is_bcrypt_password_length_valid(password):
        raise ValueError("password cannot be longer than 72 bytes")
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    创建JWT访问令牌
    
    Args:
        data: 要编码的数据
        expires_delta: 过期时间增量
        
    Returns:
        str: JWT令牌
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def create_parent_student_access_token(student_id: Any, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a short scoped token for parent access to exactly one student.
    """
    normalized_student_id = int(student_id)
    return create_access_token(
        {
            "sub": f"parent:{normalized_student_id}",
            "student_id": normalized_student_id,
            "token_type": PARENT_STUDENT_ACCESS_TOKEN_TYPE,
        },
        expires_delta=expires_delta or timedelta(hours=12)
    )


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    解码JWT令牌
    
    Args:
        token: JWT令牌
        
    Returns:
        Dict: 解码后的数据，失败返回None
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def is_parent_student_token_valid(payload: Optional[Dict[str, Any]], student_id: Any) -> bool:
    """
    Check whether a decoded parent token is scoped to the requested student.
    """
    if not payload:
        return False
    if payload.get("token_type") != PARENT_STUDENT_ACCESS_TOKEN_TYPE:
        return False

    try:
        token_student_id = int(payload.get("student_id"))
        requested_student_id = int(student_id)
    except (TypeError, ValueError):
        return False

    return token_student_id == requested_student_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    获取当前登录用户
    
    Args:
        credentials: HTTP认证凭证
        db: 数据库会话
        
    Returns:
        Dict: 用户信息
        
    Raises:
        HTTPException: 认证失败
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # 查询用户信息
    sql = """
        SELECT u.id, u.username, u.real_name, u.role_id, r.role_name, r.permission_code
        FROM sys_users u
        JOIN sys_roles r ON u.role_id = r.id
        WHERE u.id = :user_id AND u.is_active = 1
    """
    
    result = db.execute(text(sql), {"user_id": int(user_id)}).fetchone()
    
    if result is None:
        raise credentials_exception
    
    return {
        "id": result.id,
        "username": result.username,
        "real_name": result.real_name,
        "role_id": result.role_id,
        "role_name": result.role_name,
        "permission_code": result.permission_code
    }


def check_permission(user: Dict[str, Any], required_permission: str) -> bool:
    """
    检查用户权限
    
    Args:
        user: 用户信息
        required_permission: 所需权限代码
        
    Returns:
        bool: 是否有权限
    """
    # 系统管理员拥有所有权限
    if user.get("permission_code") == "sys_admin":
        return True
    
    # 教务主任拥有所有权限
    if user.get("permission_code") == "edu_admin":
        return True
    
    required_level = PERMISSION_HIERARCHY.get(required_permission)
    if required_level is None:
        required_level = SEMANTIC_PERMISSION_MIN_LEVELS.get(required_permission)
    if required_level is None:
        return False

    user_level = PERMISSION_HIERARCHY.get(user.get("permission_code"), 0)
    
    return user_level >= required_level


def has_permission_code(
    user: Dict[str, Any],
    allowed_permission_codes: Iterable[str],
    include_superusers: bool = True
) -> bool:
    """
    Check explicit permission-code allowlists.

    This is intentionally stricter than the level-based ``check_permission``:
    unknown permission labels must not silently become public access.
    """
    permission_code = user.get("permission_code")
    allowed = {code for code in allowed_permission_codes if code}

    if include_superusers and permission_code in SUPER_PERMISSION_CODES:
        return True

    return permission_code in allowed


def has_own_resource_or_permission_code(
    user: Dict[str, Any],
    owner_user_id: Any,
    allowed_permission_codes: Iterable[str],
    include_superusers: bool = True
) -> bool:
    """
    Allow admin-scoped roles or the owner of a user-bound resource.
    """
    if has_permission_code(
        user,
        allowed_permission_codes,
        include_superusers=include_superusers
    ):
        return True

    try:
        return int(user.get("id")) == int(owner_user_id)
    except (TypeError, ValueError):
        return False


def require_permission_codes(*allowed_permission_codes: str, include_superusers: bool = True):
    """
    FastAPI dependency for endpoints that need exact role/permission boundaries.
    """
    async def permission_code_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ):
        if not has_permission_code(
            current_user,
            allowed_permission_codes,
            include_superusers=include_superusers
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足，无法访问此资源"
            )
        return current_user

    return permission_code_checker


def require_permission(required_permission: str):
    """
    权限依赖装饰器
    
    Args:
        required_permission: 所需权限代码
        
    Returns:
        Dependency: FastAPI依赖
    """
    async def permission_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ):
        if not check_permission(current_user, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足，无法访问此资源"
            )
        return current_user
    
    return permission_checker


class RoleBasedAccessControl:
    """
    基于角色的访问控制
    
    10色RBAC权限体系:
    1. sys_admin - 系统管理员
    2. edu_admin - 教务处主任/校领导
    3. exam_admin - 考务与学籍管理员
    4. grade_leader - 年段长
    5. subject_leader - 教研组长
    6. lesson_leader - 备课组长
    7. headmaster - 班主任
    8. teacher - 科任教师
    9. parent - 家长/学生
    10. custom - 自定义角色
    """
    
    @staticmethod
    def can_view_all_school_data(user: Dict[str, Any]) -> bool:
        """是否可以查看全校数据"""
        return user.get("permission_code") in ["sys_admin", "edu_admin"]
    
    @staticmethod
    def can_view_grade_data(user: Dict[str, Any], grade_name: str) -> bool:
        """是否可以查看年级数据"""
        if RoleBasedAccessControl.can_view_all_school_data(user):
            return True
        # 年段长只能查看自己管理的年级
        if user.get("permission_code") == "grade_leader":
            # TODO: 检查用户是否管理该年级
            return True
        return False
    
    @staticmethod
    def can_view_class_data(user: Dict[str, Any], class_name: str) -> bool:
        """是否可以查看班级数据"""
        if RoleBasedAccessControl.can_view_all_school_data(user):
            return True
        if user.get("permission_code") in ["grade_leader", "subject_leader"]:
            return True
        # 班主任只能查看自己班级
        if user.get("permission_code") == "headmaster":
            # TODO: 检查是否班主任
            return True
        # 科任教师只能查看所教班级
        if user.get("permission_code") == "teacher":
            # TODO: 检查是否任课
            return True
        return False
    
    @staticmethod
    def can_manage_exam(user: Dict[str, Any]) -> bool:
        """是否可以管理考试"""
        return user.get("permission_code") in ["sys_admin", "edu_admin", "exam_admin"]
    
    @staticmethod
    def can_import_data(user: Dict[str, Any]) -> bool:
        """是否可以导入数据"""
        return user.get("permission_code") in ["sys_admin", "edu_admin", "exam_admin"]
    
    @staticmethod
    def can_export_data(user: Dict[str, Any]) -> bool:
        """是否可以导出数据"""
        return user.get("permission_code") in [
            "sys_admin", "edu_admin", "exam_admin", 
            "grade_leader", "subject_leader"
        ]
