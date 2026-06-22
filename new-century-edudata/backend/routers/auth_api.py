"""
用户认证API
提供登录、注册、密码修改等功能
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
import logging

from core.database import get_db
from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["用户认证"])


# ============ Pydantic模型定义 ============

class LoginRequest(BaseModel):
    """登录请求"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """登录响应"""
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None


class UserInfoResponse(BaseModel):
    """用户信息响应"""
    id: int
    username: str
    real_name: str
    role_name: str
    permission_code: str


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str
    confirm_password: str


class CreateUserRequest(BaseModel):
    """创建用户请求"""
    username: str
    password: str
    real_name: str
    role_id: int
    phone: Optional[str] = None
    email: Optional[str] = None


# ============ API路由 ============

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    用户登录
    
    验证用户名和密码，返回JWT令牌
    """
    try:
        # 查询用户
        sql = """
            SELECT u.id, u.username, u.password_hash, u.real_name, 
                   u.role_id, r.role_name, r.permission_code, u.is_active
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            WHERE u.username = :username
        """
        
        result = db.execute(text(sql), {"username": request.username}).fetchone()
        
        if not result:
            return LoginResponse(
                success=False,
                message="用户名或密码错误"
            )
        
        # 检查用户是否启用
        if not result.is_active:
            return LoginResponse(
                success=False,
                message="账号已被禁用，请联系管理员"
            )
        
        # 验证密码
        if not verify_password(request.password, result.password_hash):
            return LoginResponse(
                success=False,
                message="用户名或密码错误"
            )
        
        # 创建访问令牌
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(result.id)},
            expires_delta=access_token_expires
        )
        
        logger.info(f"用户登录成功: {request.username}")
        
        return LoginResponse(
            success=True,
            message="登录成功",
            token=access_token,
            user={
                "id": result.id,
                "username": result.username,
                "real_name": result.real_name,
                "role_name": result.role_name,
                "permission_code": result.permission_code
            }
        )
        
    except Exception as e:
        logger.error(f"登录失败: {e}")
        raise HTTPException(status_code=500, detail="登录过程发生错误")


@router.get("/me", response_model=UserInfoResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    获取当前登录用户信息
    """
    return UserInfoResponse(
        id=current_user["id"],
        username=current_user["username"],
        real_name=current_user["real_name"],
        role_name=current_user["role_name"],
        permission_code=current_user["permission_code"]
    )


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    修改密码
    """
    try:
        # 验证新密码
        if request.new_password != request.confirm_password:
            return {"success": False, "message": "两次输入的新密码不一致"}
        
        if len(request.new_password) < 6:
            return {"success": False, "message": "新密码长度不能少于6位"}
        
        # 查询当前密码
        sql = "SELECT password_hash FROM sys_users WHERE id = :user_id"
        result = db.execute(text(sql), {"user_id": current_user["id"]}).fetchone()
        
        if not result:
            return {"success": False, "message": "用户不存在"}
        
        # 验证旧密码
        if not verify_password(request.old_password, result.password_hash):
            return {"success": False, "message": "旧密码错误"}
        
        # 更新密码
        new_hash = get_password_hash(request.new_password)
        update_sql = """
            UPDATE sys_users 
            SET password_hash = :new_hash, updated_at = NOW()
            WHERE id = :user_id
        """
        db.execute(text(update_sql), {"new_hash": new_hash, "user_id": current_user["id"]})
        db.commit()
        
        logger.info(f"用户修改密码成功: {current_user['username']}")
        
        return {"success": True, "message": "密码修改成功"}
        
    except Exception as e:
        logger.error(f"修改密码失败: {e}")
        raise HTTPException(status_code=500, detail="修改密码失败")


@router.post("/users/create")
def create_user(
    request: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建新用户(需要管理员权限)
    """
    try:
        # 检查权限
        if current_user["permission_code"] not in ["sys_admin", "edu_admin"]:
            raise HTTPException(status_code=403, detail="权限不足")
        
        # 检查用户名是否已存在
        check_sql = "SELECT id FROM sys_users WHERE username = :username"
        existing = db.execute(text(check_sql), {"username": request.username}).fetchone()
        
        if existing:
            return {"success": False, "message": "用户名已存在"}
        
        # 创建用户
        password_hash = get_password_hash(request.password)
        
        insert_sql = """
            INSERT INTO sys_users 
            (role_id, username, password_hash, real_name, phone, email, is_active, created_at, updated_at)
            VALUES 
            (:role_id, :username, :password_hash, :real_name, :phone, :email, 1, NOW(), NOW())
        """
        
        db.execute(text(insert_sql), {
            "role_id": request.role_id,
            "username": request.username,
            "password_hash": password_hash,
            "real_name": request.real_name,
            "phone": request.phone,
            "email": request.email
        })
        db.commit()
        
        logger.info(f"创建用户成功: {request.username}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": "用户创建成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建用户失败: {e}")
        raise HTTPException(status_code=500, detail="创建用户失败")


@router.get("/roles")
def get_roles(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取角色列表
    """
    try:
        sql = "SELECT id, role_name, permission_code, description FROM sys_roles ORDER BY id"
        results = db.execute(text(sql)).fetchall()
        
        roles = []
        for result in results:
            roles.append({
                "id": result.id,
                "role_name": result.role_name,
                "permission_code": result.permission_code,
                "description": result.description
            })
        
        return {"success": True, "roles": roles}
        
    except Exception as e:
        logger.error(f"获取角色列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取角色列表失败")


@router.get("/users")
def get_users(
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取用户列表(需要管理员权限)
    """
    try:
        # 检查权限
        if current_user["permission_code"] not in ["sys_admin", "edu_admin", "exam_admin"]:
            raise HTTPException(status_code=403, detail="权限不足")
        
        offset = (page - 1) * page_size
        
        # 查询总数
        count_sql = "SELECT COUNT(*) as total FROM sys_users"
        count_result = db.execute(text(count_sql)).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询用户列表
        sql = """
            SELECT u.id, u.username, u.real_name, u.phone, u.email, 
                   u.is_active, r.role_name, r.permission_code, u.created_at
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            ORDER BY u.id DESC
            LIMIT :limit OFFSET :offset
        """
        
        results = db.execute(text(sql), {"limit": page_size, "offset": offset}).fetchall()
        
        users = []
        for result in results:
            users.append({
                "id": result.id,
                "username": result.username,
                "real_name": result.real_name,
                "phone": result.phone,
                "email": result.email,
                "is_active": result.is_active == 1,
                "role_name": result.role_name,
                "permission_code": result.permission_code,
                "created_at": result.created_at.isoformat() if result.created_at else None
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "users": users
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取用户列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取用户列表失败")


@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    启用/禁用用户(需要管理员权限)
    """
    try:
        # 检查权限
        if current_user["permission_code"] not in ["sys_admin", "edu_admin"]:
            raise HTTPException(status_code=403, detail="权限不足")
        
        # 不能禁用自己
        if user_id == current_user["id"]:
            return {"success": False, "message": "不能禁用当前登录账号"}
        
        # 查询当前状态
        sql = "SELECT is_active FROM sys_users WHERE id = :user_id"
        result = db.execute(text(sql), {"user_id": user_id}).fetchone()
        
        if not result:
            return {"success": False, "message": "用户不存在"}
        
        # 切换状态
        new_status = 0 if result.is_active == 1 else 1
        update_sql = "UPDATE sys_users SET is_active = :status, updated_at = NOW() WHERE id = :user_id"
        db.execute(text(update_sql), {"status": new_status, "user_id": user_id})
        db.commit()
        
        status_text = "启用" if new_status == 1 else "禁用"
        logger.info(f"用户{status_text}成功: user_id={user_id}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": f"用户已{status_text}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"切换用户状态失败: {e}")
        raise HTTPException(status_code=500, detail="操作失败")
