"""
成绩分析API模块
支持分层教学分析和成果发布
包含权限控制、数据分析、可视化、发布等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import json
import uuid
import logging
import math
import statistics

from core.database import get_db
from core.security import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/score-analysis", tags=["成绩分析"])


# ============ Pydantic模型定义 ============

class LayerConfig(BaseModel):
    """层次配置"""
    code: str
    name: str
    description: Optional[str] = None


class ClassLayerSetting(BaseModel):
    """班级层次设定"""
    grade_level: str
    class_id: int
    class_name: str
    layer_code: str
    layer_name: str
    academic_year: str
    term: str
    description: Optional[str] = None


class AnalysisRequest(BaseModel):
    """分析请求"""
    exam_id: int
    grade_level: str
    analysis_type: str  # overall, layer_comparison, subject_analysis, student_progress, class_contrast
    analysis_scope: str  # all, layer_a, layer_b, layer_c


class AnalysisResult(BaseModel):
    """分析结果"""
    analysis_id: str
    exam_id: int
    exam_name: str
    grade_level: str
    analysis_type: str
    analysis_scope: str
    analysis_data: Dict[str, Any]
    created_by: int
    created_by_name: str
    created_at: str
    status: str


class PublicationRequest(BaseModel):
    """发布请求"""
    analysis_id: str
    title: str
    content_summary: Optional[str] = None
    recipient_types: List[str]  # school_leader, middle_manager, research_leader, etc.


class PublicationRecipient(BaseModel):
    """发布接收对象"""
    user_id: int
    user_name: str
    user_role: str
    read_status: str
    read_at: Optional[str] = None


class PublicationResult(BaseModel):
    """发布结果"""
    publication_id: str
    analysis_id: str
    exam_id: int
    exam_name: str
    grade_level: str
    title: str
    published_by: int
    published_by_name: str
    published_at: str
    recipient_types: List[str]
    recipient_count: int
    status: str


# ============ 权限检查函数 ============

def check_analysis_permission(current_user: dict, required_roles: List[str]) -> bool:
    """检查用户是否有成绩分析权限"""
    user_role = current_user.get('role', '')
    user_role_name = current_user.get('role_name', '')
    user_permissions = current_user.get('permissions', [])
    
    # 系统管理员和教务处主任拥有所有权限
    admin_roles = ['super_admin', 'dean', '教务处主任', '系统管理员']
    if user_role in admin_roles or user_role_name in admin_roles:
        return True
    
    # 检查是否在要求的角色列表中
    all_user_roles = [user_role, user_role_name]
    return any(role in required_roles for role in all_user_roles if role)


def get_accessible_grades(current_user: dict) -> List[str]:
    """获取用户可访问的年级列表"""
    user_role = current_user.get('role', '')
    user_role_name = current_user.get('role_name', '')
    user_grade = current_user.get('grade_level', '')
    
    # 合并角色信息
    all_roles = [user_role, user_role_name]
    
    # 管理员可以访问所有年级
    admin_roles = ['super_admin', 'dean', '教务处主任', '系统管理员']
    if any(role in admin_roles for role in all_roles if role):
        return ['7年级', '8年级', '9年级']
    elif 'grade_leader' in all_roles or '年段长' in all_roles:
        # 年段长只能访问本年级
        return [user_grade] if user_grade else []
    elif any(role in ['research_leader', 'prep_leader', '教研组长', '备课组长'] for role in all_roles if role):
        # 教研组长和备课组长可以访问所有年级
        return ['7年级', '8年级', '9年级']
    else:
        return []


# ============ 数据分析算法 ============

def calculate_basic_statistics(scores: List[float]) -> Dict[str, Any]:
    """计算基础统计指标"""
    if not scores:
        return {
            'count': 0,
            'mean': 0,
            'median': 0,
            'std': 0,
            'min': 0,
            'max': 0,
            'q1': 0,
            'q3': 0
        }
    
    sorted_scores = sorted(scores)
    n = len(sorted_scores)
    
    # 计算均值
    mean_val = sum(scores) / n
    
    # 计算中位数
    if n % 2 == 0:
        median_val = (sorted_scores[n//2 - 1] + sorted_scores[n//2]) / 2
    else:
        median_val = sorted_scores[n//2]
    
    # 计算标准差
    variance = sum((x - mean_val) ** 2 for x in scores) / n
    std_val = math.sqrt(variance)
    
    # 计算四分位数
    q1_val = sorted_scores[n // 4] if n >= 4 else sorted_scores[0]
    q3_val = sorted_scores[3 * n // 4] if n >= 4 else sorted_scores[-1]
    
    return {
        'count': n,
        'mean': round(mean_val, 2),
        'median': round(median_val, 2),
        'std': round(std_val, 2),
        'min': round(sorted_scores[0], 2),
        'max': round(sorted_scores[-1], 2),
        'q1': round(q1_val, 2),
        'q3': round(q3_val, 2)
    }


def calculate_score_distribution(scores: List[float], 
                                  thresholds: Dict[str, float]) -> Dict[str, int]:
    """计算成绩分布"""
    distribution = {
        'excellent': 0,  # 优秀
        'good': 0,       # 良好
        'pass': 0,       # 及格
        'fail': 0        # 不及格
    }
    
    for score in scores:
        if score >= thresholds.get('excellent', 90):
            distribution['excellent'] += 1
        elif score >= thresholds.get('good', 80):
            distribution['good'] += 1
        elif score >= thresholds.get('pass', 60):
            distribution['pass'] += 1
        else:
            distribution['fail'] += 1
    
    return distribution


def calculate_z_scores(scores: List[float], 
                        reference_mean: float, 
                        reference_std: float) -> List[float]:
    """计算Z分数"""
    if reference_std == 0:
        return [0.0] * len(scores)
    return [(score - reference_mean) / reference_std for score in scores]


def perform_t_test(group1_scores: List[float], 
                   group2_scores: List[float]) -> Dict[str, Any]:
    """执行T检验 (简化版，不使用scipy)"""
    if len(group1_scores) < 2 or len(group2_scores) < 2:
        return {'t_statistic': 0, 'p_value': 1, 'significant': False}
    
    n1, n2 = len(group1_scores), len(group2_scores)
    mean1, mean2 = sum(group1_scores) / n1, sum(group2_scores) / n2
    
    # 计算标准差
    var1 = sum((x - mean1) ** 2 for x in group1_scores) / (n1 - 1) if n1 > 1 else 0
    var2 = sum((x - mean2) ** 2 for x in group2_scores) / (n2 - 1) if n2 > 1 else 0
    
    # 计算合并标准差
    pooled_std = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    
    if pooled_std == 0:
        return {'t_statistic': 0, 'p_value': 1, 'significant': False}
    
    # 计算t统计量
    t_stat = (mean1 - mean2) / (pooled_std * math.sqrt(1/n1 + 1/n2))
    
    # 简化的p值估计 (使用经验公式)
    df = n1 + n2 - 2
    p_value = min(1.0, max(0.001, 2 * (1 - min(1, abs(t_stat) / math.sqrt(df)))))
    
    return {
        't_statistic': round(t_stat, 4),
        'p_value': round(p_value, 4),
        'significant': p_value < 0.05
    }


# ============ 班级层次管理API ============

@router.get("/layers/config")
def get_layer_config(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取层次配置"""
    try:
        sql = "SELECT config_value FROM biz_analysis_configs WHERE config_key = 'layer_definitions'"
        result = db.execute(text(sql)).fetchone()
        
        if result:
            return {
                "success": True,
                "layers": json.loads(result.config_value)
            }
        
        # 默认配置
        default_layers = [
            {"code": "A", "name": "提高班", "description": "学业水平较高的班级"},
            {"code": "B", "name": "平行班", "description": "标准教学班级"},
            {"code": "C", "name": "基础班", "description": "需要加强基础的班级"}
        ]
        
        return {
            "success": True,
            "layers": default_layers
        }
        
    except Exception as e:
        logger.error(f"获取层次配置失败: {e}")
        raise HTTPException(status_code=500, detail="获取层次配置失败")


@router.post("/layers/setting")
def set_class_layer(
    setting: ClassLayerSetting,
    current_user: dict = Depends(require_permission("layer_manage")),
    db: Session = Depends(get_db)
):
    """设置班级层次"""
    try:
        # 检查是否已存在
        check_sql = """
            SELECT id FROM biz_class_layers 
            WHERE grade_level = :grade_level AND class_id = :class_id 
            AND academic_year = :academic_year AND term = :term
        """
        existing = db.execute(text(check_sql), {
            "grade_level": setting.grade_level,
            "class_id": setting.class_id,
            "academic_year": setting.academic_year,
            "term": setting.term
        }).fetchone()
        
        if existing:
            # 更新
            update_sql = """
                UPDATE biz_class_layers 
                SET layer_code = :layer_code, layer_name = :layer_name,
                    description = :description, created_by = :created_by
                WHERE id = :id
            """
            db.execute(text(update_sql), {
                "layer_code": setting.layer_code,
                "layer_name": setting.layer_name,
                "description": setting.description,
                "created_by": current_user["id"],
                "id": existing.id
            })
        else:
            # 插入
            insert_sql = """
                INSERT INTO biz_class_layers 
                (grade_level, class_id, class_name, layer_code, layer_name,
                 academic_year, term, description, created_by)
                VALUES 
                (:grade_level, :class_id, :class_name, :layer_code, :layer_name,
                 :academic_year, :term, :description, :created_by)
            """
            db.execute(text(insert_sql), {
                **setting.dict(),
                "created_by": current_user["id"]
            })
        
        db.commit()
        
        # 记录日志
        log_sql = """
            INSERT INTO biz_analysis_logs 
            (action_type, action_by, action_by_name, action_by_role, action_detail)
            VALUES 
            ('set_layer', :action_by, :action_by_name, :action_by_role, :action_detail)
        """
        db.execute(text(log_sql), {
            "action_by": current_user["id"],
            "action_by_name": current_user.get("real_name", current_user["username"]),
            "action_by_role": current_user.get("role", ""),
            "action_detail": json.dumps(setting.dict(), ensure_ascii=False)
        })
        db.commit()
        
        return {"success": True, "message": "班级层次设置成功"}
        
    except Exception as e:
        logger.error(f"设置班级层次失败: {e}")
        raise HTTPException(status_code=500, detail="设置班级层次失败")


@router.get("/layers/list")
def get_class_layers(
    grade_level: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取班级层次列表"""
    try:
        # 检查权限
        accessible_grades = get_accessible_grades(current_user)
        if grade_level and grade_level not in accessible_grades:
            raise HTTPException(status_code=403, detail="无权访问该年级数据")
        
        conditions = []
        params = {}
        
        if grade_level:
            conditions.append("grade_level = :grade_level")
            params["grade_level"] = grade_level
        else:
            conditions.append("grade_level IN :accessible_grades")
            params["accessible_grades"] = tuple(accessible_grades) if accessible_grades else ('',)
        
        if academic_year:
            conditions.append("academic_year = :academic_year")
            params["academic_year"] = academic_year
        
        if term:
            conditions.append("term = :term")
            params["term"] = term
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        sql = f"""
            SELECT * FROM biz_class_layers 
            {where_clause}
            ORDER BY grade_level, class_name
        """
        
        results = db.execute(text(sql), params).fetchall()
        
        layers = []
        for result in results:
            layers.append({
                "id": result.id,
                "grade_level": result.grade_level,
                "class_id": result.class_id,
                "class_name": result.class_name,
                "layer_code": result.layer_code,
                "layer_name": result.layer_name,
                "academic_year": result.academic_year,
                "term": result.term,
                "description": result.description
            })
        
        return {
            "success": True,
            "layers": layers
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取班级层次列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取班级层次列表失败")


# ============ 成绩分析API ============

@router.post("/analyze")
def perform_analysis(
    request: AnalysisRequest,
    req: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    执行成绩分析
    
    支持多种分析类型：
    - overall: 整体分析
    - layer_comparison: 层次对比分析
    - subject_analysis: 学科分析
    - student_progress: 学生进退步分析
    - class_contrast: 班级对比分析
    """
    try:
        # 检查权限
        if not check_analysis_permission(current_user, ['super_admin', 'dean', 'research_leader']):
            raise HTTPException(status_code=403, detail="无权进行成绩分析")
        
        accessible_grades = get_accessible_grades(current_user)
        if request.grade_level not in accessible_grades:
            raise HTTPException(status_code=403, detail="无权访问该年级数据")
        
        # 获取考试信息
        exam_sql = "SELECT exam_name FROM biz_exams WHERE id = :exam_id"
        exam_result = db.execute(text(exam_sql), {"exam_id": request.exam_id}).fetchone()
        if not exam_result:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        exam_name = exam_result.exam_name
        
        # 获取成绩数据
        scores_sql = """
            SELECT s.*, c.layer_code
            FROM biz_scores s
            LEFT JOIN biz_class_layers c ON s.class_id = c.class_id 
                AND c.grade_level = :grade_level
            WHERE s.exam_id = :exam_id AND s.is_valid = 1
        """
        scores_results = db.execute(text(scores_sql), {
            "exam_id": request.exam_id,
            "grade_level": request.grade_level
        }).fetchall()
        
        if not scores_results:
            return {
                "success": False,
                "message": "该考试暂无有效成绩数据"
            }
        
        # 根据分析类型执行不同的分析算法
        analysis_data = {}
        
        if request.analysis_type == 'overall':
            analysis_data = analyze_overall(scores_results, db)
        elif request.analysis_type == 'layer_comparison':
            analysis_data = analyze_layer_comparison(scores_results, request.analysis_scope, db)
        elif request.analysis_type == 'subject_analysis':
            analysis_data = analyze_subjects(scores_results, db)
        elif request.analysis_type == 'student_progress':
            analysis_data = analyze_student_progress(request.exam_id, request.grade_level, db)
        elif request.analysis_type == 'class_contrast':
            analysis_data = analyze_class_contrast(scores_results, db)
        else:
            raise HTTPException(status_code=400, detail="未知的分析类型")
        
        # 生成分析ID
        analysis_id = f"ANALYSIS_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # 保存分析结果
        insert_sql = """
            INSERT INTO biz_score_analysis 
            (analysis_id, exam_id, exam_name, grade_level, analysis_type, 
             analysis_scope, analysis_data, created_by, created_by_name, status)
            VALUES 
            (:analysis_id, :exam_id, :exam_name, :grade_level, :analysis_type,
             :analysis_scope, :analysis_data, :created_by, :created_by_name, 'draft')
        """
        
        db.execute(text(insert_sql), {
            "analysis_id": analysis_id,
            "exam_id": request.exam_id,
            "exam_name": exam_name,
            "grade_level": request.grade_level,
            "analysis_type": request.analysis_type,
            "analysis_scope": request.analysis_scope,
            "analysis_data": json.dumps(analysis_data, ensure_ascii=False, default=str),
            "created_by": current_user["id"],
            "created_by_name": current_user.get("real_name", current_user["username"])
        })
        
        db.commit()
        
        # 记录操作日志
        log_sql = """
            INSERT INTO biz_analysis_logs 
            (analysis_id, action_type, action_by, action_by_name, action_by_role, 
             action_detail, ip_address, user_agent)
            VALUES 
            (:analysis_id, 'create_analysis', :action_by, :action_by_name, :action_by_role,
             :action_detail, :ip_address, :user_agent)
        """
        db.execute(text(log_sql), {
            "analysis_id": analysis_id,
            "action_by": current_user["id"],
            "action_by_name": current_user.get("real_name", current_user["username"]),
            "action_by_role": current_user.get("role", ""),
            "action_detail": json.dumps(request.dict(), ensure_ascii=False),
            "ip_address": req.client.host if req.client else None,
            "user_agent": req.headers.get("user-agent")
        })
        db.commit()
        
        return {
            "success": True,
            "analysis_id": analysis_id,
            "message": "分析完成",
            "data": analysis_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"成绩分析失败: {e}")
        raise HTTPException(status_code=500, detail="成绩分析失败")


def analyze_overall(scores_results, db) -> Dict[str, Any]:
    """整体分析"""
    total_scores = [r.total_score for r in scores_results if r.total_score is not None]
    
    # 基础统计
    basic_stats = calculate_basic_statistics(total_scores)
    
    # 成绩分布
    thresholds_sql = "SELECT config_value FROM biz_analysis_configs WHERE config_key = 'score_thresholds'"
    thresholds_result = db.execute(text(thresholds_sql)).fetchone()
    thresholds = json.loads(thresholds_result.config_value) if thresholds_result else {
        "excellent": 90, "good": 80, "pass": 60
    }
    
    distribution = calculate_score_distribution(total_scores, thresholds)
    
    # 班级统计
    class_stats = {}
    for result in scores_results:
        class_name = result.class_name
        if class_name not in class_stats:
            class_stats[class_name] = []
        if result.total_score is not None:
            class_stats[class_name].append(result.total_score)
    
    class_analysis = {}
    for class_name, scores in class_stats.items():
        class_analysis[class_name] = calculate_basic_statistics(scores)
    
    return {
        "basic_statistics": basic_stats,
        "score_distribution": distribution,
        "class_analysis": class_analysis,
        "total_students": len(scores_results),
        "valid_scores": len(total_scores)
    }


def analyze_layer_comparison(scores_results, analysis_scope, db) -> Dict[str, Any]:
    """层次对比分析"""
    # 按层次分组
    layer_groups = {'A': [], 'B': [], 'C': []}
    
    for result in scores_results:
        layer_code = result.layer_code or 'B'  # 默认平行班
        if result.total_score is not None:
            layer_groups[layer_code].append(result.total_score)
    
    # 如果指定了特定层次
    if analysis_scope != 'all':
        target_layer = analysis_scope.replace('layer_', '').upper()
        layer_groups = {k: v for k, v in layer_groups.items() if k == target_layer}
    
    # 计算各层次统计
    layer_stats = {}
    for layer_code, scores in layer_groups.items():
        if scores:
            layer_stats[layer_code] = calculate_basic_statistics(scores)
    
    # 层次间对比
    comparisons = {}
    layer_codes = list(layer_stats.keys())
    for i in range(len(layer_codes)):
        for j in range(i + 1, len(layer_codes)):
            layer1, layer2 = layer_codes[i], layer_codes[j]
            scores1 = layer_groups[layer1]
            scores2 = layer_groups[layer2]
            
            if scores1 and scores2:
                t_test_result = perform_t_test(scores1, scores2)
                comparisons[f"{layer1}_vs_{layer2}"] = t_test_result
    
    return {
        "layer_statistics": layer_stats,
        "layer_comparisons": comparisons,
        "sample_sizes": {k: len(v) for k, v in layer_groups.items()}
    }


def analyze_subjects(scores_results, db) -> Dict[str, Any]:
    """学科分析"""
    # 获取考试科目
    if not scores_results:
        return {}
    
    # 解析成绩JSON
    subject_scores = {}
    for result in scores_results:
        if result.scores:
            scores_dict = json.loads(result.scores) if isinstance(result.scores, str) else result.scores
            for subject, score in scores_dict.items():
                if subject not in subject_scores:
                    subject_scores[subject] = []
                if score is not None:
                    subject_scores[subject].append(float(score))
    
    # 计算各学科统计
    subject_stats = {}
    for subject, scores in subject_scores.items():
        subject_stats[subject] = calculate_basic_statistics(scores)
    
    return {
        "subject_statistics": subject_stats,
        "subject_count": len(subject_stats)
    }


def analyze_student_progress(current_exam_id: int, grade_level: str, db) -> Dict[str, Any]:
    """学生进退步分析"""
    # 获取当前考试和上一次考试
    exam_sql = """
        SELECT id, exam_name, exam_date 
        FROM biz_exams 
        WHERE grade_level = :grade_level 
        ORDER BY exam_date DESC 
        LIMIT 2
    """
    exam_results = db.execute(text(exam_sql), {"grade_level": grade_level}).fetchall()
    
    if len(exam_results) < 2:
        return {"message": "历史考试数据不足，无法分析进退步"}
    
    current_exam = exam_results[0]
    previous_exam = exam_results[1]
    
    # 获取两次考试的成绩
    scores_sql = """
        SELECT s1.student_id, s1.student_name, s1.total_score as current_score,
               s2.total_score as previous_score
        FROM biz_scores s1
        LEFT JOIN biz_scores s2 ON s1.student_id = s2.student_id
        WHERE s1.exam_id = :current_exam_id AND s2.exam_id = :previous_exam_id
        AND s1.is_valid = 1 AND s2.is_valid = 1
    """
    scores_results = db.execute(text(scores_sql), {
        "current_exam_id": current_exam.id,
        "previous_exam_id": previous_exam.id
    }).fetchall()
    
    # 计算进退步
    progress_data = []
    for result in scores_results:
        if result.current_score is not None and result.previous_score is not None:
            score_change = result.current_score - result.previous_score
            progress_data.append({
                "student_id": result.student_id,
                "student_name": result.student_name,
                "current_score": result.current_score,
                "previous_score": result.previous_score,
                "score_change": score_change,
                "change_percentage": (score_change / result.previous_score * 100) if result.previous_score > 0 else 0
            })
    
    # 排序
    progress_data.sort(key=lambda x: x["score_change"], reverse=True)
    
    # 统计
    improved = len([x for x in progress_data if x["score_change"] > 0])
    declined = len([x for x in progress_data if x["score_change"] < 0])
    unchanged = len([x for x in progress_data if x["score_change"] == 0])
    
    return {
        "current_exam": current_exam.exam_name,
        "previous_exam": previous_exam.exam_name,
        "total_students": len(progress_data),
        "improved_count": improved,
        "declined_count": declined,
        "unchanged_count": unchanged,
        "top_improved": progress_data[:10],  # 进步最大的10人
        "top_declined": progress_data[-10:]   # 退步最大的10人
    }


def analyze_class_contrast(scores_results, db) -> Dict[str, Any]:
    """班级对比分析"""
    # 按班级分组
    class_groups = {}
    for result in scores_results:
        class_name = result.class_name
        if class_name not in class_groups:
            class_groups[class_name] = []
        if result.total_score is not None:
            class_groups[class_name].append(result.total_score)
    
    # 计算各班统计
    class_stats = {}
    for class_name, scores in class_groups.items():
        class_stats[class_name] = calculate_basic_statistics(scores)
    
    # 计算年级平均
    all_scores = [score for scores in class_groups.values() for score in scores]
    grade_mean = np.mean(all_scores) if all_scores else 0
    grade_std = np.std(all_scores) if all_scores else 1
    
    # 计算各班Z值
    class_z_scores = {}
    for class_name, scores in class_groups.items():
        if scores:
            class_mean = np.mean(scores)
            class_z_scores[class_name] = (class_mean - grade_mean) / grade_std if grade_std > 0 else 0
    
    # 排名
    class_ranking = sorted(class_z_scores.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "class_statistics": class_stats,
        "class_z_scores": class_z_scores,
        "class_ranking": [{"class_name": name, "z_score": score} for name, score in class_ranking],
        "grade_mean": float(grade_mean),
        "grade_std": float(grade_std)
    }


# ============ 分析结果查询API ============

@router.get("/results")
def get_analysis_results(
    exam_id: Optional[int] = Query(None),
    grade_level: Optional[str] = Query(None),
    analysis_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取分析结果列表"""
    try:
        # 检查权限
        accessible_grades = get_accessible_grades(current_user)
        if grade_level and grade_level not in accessible_grades:
            raise HTTPException(status_code=403, detail="无权访问该年级数据")
        
        conditions = []
        params = {}
        
        if exam_id:
            conditions.append("exam_id = :exam_id")
            params["exam_id"] = exam_id
        
        if grade_level:
            conditions.append("grade_level = :grade_level")
            params["grade_level"] = grade_level
        elif accessible_grades:
            conditions.append("grade_level IN :accessible_grades")
            params["accessible_grades"] = tuple(accessible_grades)
        
        if analysis_type:
            conditions.append("analysis_type = :analysis_type")
            params["analysis_type"] = analysis_type
        
        if status:
            conditions.append("status = :status")
            params["status"] = status
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM biz_score_analysis {where_clause}"
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        offset = (page - 1) * page_size
        list_sql = f"""
            SELECT * FROM biz_score_analysis 
            {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        records = []
        for result in results:
            records.append({
                "analysis_id": result.analysis_id,
                "exam_id": result.exam_id,
                "exam_name": result.exam_name,
                "grade_level": result.grade_level,
                "analysis_type": result.analysis_type,
                "analysis_scope": result.analysis_scope,
                "created_by": result.created_by,
                "created_by_name": result.created_by_name,
                "created_at": result.created_at.isoformat() if result.created_at else "",
                "status": result.status
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分析结果列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取分析结果列表失败")


@router.get("/results/{analysis_id}")
def get_analysis_detail(
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取分析结果详情"""
    try:
        sql = "SELECT * FROM biz_score_analysis WHERE analysis_id = :analysis_id"
        result = db.execute(text(sql), {"analysis_id": analysis_id}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="分析结果不存在")
        
        # 检查权限
        accessible_grades = get_accessible_grades(current_user)
        if result.grade_level not in accessible_grades:
            raise HTTPException(status_code=403, detail="无权访问该分析结果")
        
        return {
            "success": True,
            "data": {
                "analysis_id": result.analysis_id,
                "exam_id": result.exam_id,
                "exam_name": result.exam_name,
                "grade_level": result.grade_level,
                "analysis_type": result.analysis_type,
                "analysis_scope": result.analysis_scope,
                "analysis_data": json.loads(result.analysis_data) if result.analysis_data else {},
                "created_by": result.created_by,
                "created_by_name": result.created_by_name,
                "created_at": result.created_at.isoformat() if result.created_at else "",
                "status": result.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分析结果详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取分析结果详情失败")


# ============ 成果发布API ============

@router.post("/publish")
def publish_analysis(
    request: PublicationRequest,
    req: Request,
    current_user: dict = Depends(require_permission("analysis_publish")),
    db: Session = Depends(get_db)
):
    """发布分析成果"""
    try:
        # 获取分析结果
        analysis_sql = "SELECT * FROM biz_score_analysis WHERE analysis_id = :analysis_id"
        analysis_result = db.execute(text(analysis_sql), {
            "analysis_id": request.analysis_id
        }).fetchone()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="分析结果不存在")
        
        # 生成发布ID
        publication_id = f"PUB_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # 获取接收用户列表
        recipient_types = request.recipient_types
        placeholders = ', '.join([f':type_{i}' for i in range(len(recipient_types))])
        type_params = {f'type_{i}': t for i, t in enumerate(recipient_types)}
        
        users_sql = f"""
            SELECT id, real_name, role 
            FROM sys_users 
            WHERE role IN ({placeholders}) AND status = 'active'
        """
        users_results = db.execute(text(users_sql), type_params).fetchall()
        
        # 保存发布记录
        insert_pub_sql = """
            INSERT INTO biz_analysis_publications 
            (publication_id, analysis_id, exam_id, exam_name, grade_level,
             title, content_summary, published_by, published_by_name,
             recipient_types, recipient_count, status)
            VALUES 
            (:publication_id, :analysis_id, :exam_id, :exam_name, :grade_level,
             :title, :content_summary, :published_by, :published_by_name,
             :recipient_types, :recipient_count, 'active')
        """
        
        db.execute(text(insert_pub_sql), {
            "publication_id": publication_id,
            "analysis_id": request.analysis_id,
            "exam_id": analysis_result.exam_id,
            "exam_name": analysis_result.exam_name,
            "grade_level": analysis_result.grade_level,
            "title": request.title,
            "content_summary": request.content_summary,
            "published_by": current_user["id"],
            "published_by_name": current_user.get("real_name", current_user["username"]),
            "recipient_types": json.dumps(recipient_types, ensure_ascii=False),
            "recipient_count": len(users_results)
        })
        
        # 保存接收对象明细
        for user in users_results:
            insert_recipient_sql = """
                INSERT INTO biz_publication_recipients 
                (publication_id, user_id, user_name, user_role)
                VALUES 
                (:publication_id, :user_id, :user_name, :user_role)
            """
            db.execute(text(insert_recipient_sql), {
                "publication_id": publication_id,
                "user_id": user.id,
                "user_name": user.real_name or user.username,
                "user_role": user.role
            })
        
        # 更新分析结果状态为已发布
        update_sql = "UPDATE biz_score_analysis SET status = 'published' WHERE analysis_id = :analysis_id"
        db.execute(text(update_sql), {"analysis_id": request.analysis_id})
        
        db.commit()
        
        # 记录日志
        log_sql = """
            INSERT INTO biz_analysis_logs 
            (analysis_id, publication_id, action_type, action_by, action_by_name,
             action_by_role, action_detail, ip_address, user_agent)
            VALUES 
            (:analysis_id, :publication_id, 'publish', :action_by, :action_by_name,
             :action_by_role, :action_detail, :ip_address, :user_agent)
        """
        db.execute(text(log_sql), {
            "analysis_id": request.analysis_id,
            "publication_id": publication_id,
            "action_by": current_user["id"],
            "action_by_name": current_user.get("real_name", current_user["username"]),
            "action_by_role": current_user.get("role", ""),
            "action_detail": json.dumps(request.dict(), ensure_ascii=False),
            "ip_address": req.client.host if req.client else None,
            "user_agent": req.headers.get("user-agent")
        })
        db.commit()
        
        return {
            "success": True,
            "publication_id": publication_id,
            "message": f"发布成功，共发送给 {len(users_results)} 位接收人"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发布分析成果失败: {e}")
        raise HTTPException(status_code=500, detail="发布分析成果失败")


@router.get("/publications")
def get_publications(
    exam_id: Optional[int] = Query(None),
    grade_level: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取发布记录列表"""
    try:
        conditions = ["status = 'active'"]
        params = {}
        
        if exam_id:
            conditions.append("exam_id = :exam_id")
            params["exam_id"] = exam_id
        
        if grade_level:
            conditions.append("grade_level = :grade_level")
            params["grade_level"] = grade_level
        
        where_clause = "WHERE " + " AND ".join(conditions)
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM biz_analysis_publications {where_clause}"
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        offset = (page - 1) * page_size
        list_sql = f"""
            SELECT * FROM biz_analysis_publications 
            {where_clause}
            ORDER BY published_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        records = []
        for result in results:
            records.append({
                "publication_id": result.publication_id,
                "analysis_id": result.analysis_id,
                "exam_id": result.exam_id,
                "exam_name": result.exam_name,
                "grade_level": result.grade_level,
                "title": result.title,
                "published_by": result.published_by,
                "published_by_name": result.published_by_name,
                "published_at": result.published_at.isoformat() if result.published_at else "",
                "recipient_count": result.recipient_count
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }
        
    except Exception as e:
        logger.error(f"获取发布记录失败: {e}")
        raise HTTPException(status_code=500, detail="获取发布记录失败")


# ============ 数据导出API ============

@router.get("/export/{analysis_id}")
def export_analysis(
    analysis_id: str,
    req: Request,
    format: str = Query("excel", regex="^(excel|pdf|json)$"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """导出分析结果"""
    try:
        # 获取分析结果
        sql = "SELECT * FROM biz_score_analysis WHERE analysis_id = :analysis_id"
        result = db.execute(text(sql), {"analysis_id": analysis_id}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="分析结果不存在")
        
        # 检查权限
        accessible_grades = get_accessible_grades(current_user)
        if result.grade_level not in accessible_grades:
            raise HTTPException(status_code=403, detail="无权导出该分析结果")
        
        # 记录日志
        log_sql = """
            INSERT INTO biz_analysis_logs 
            (analysis_id, action_type, action_by, action_by_name,
             action_by_role, action_detail, ip_address, user_agent)
            VALUES 
            (:analysis_id, 'download', :action_by, :action_by_name,
             :action_by_role, :action_detail, :ip_address, :user_agent)
        """
        db.execute(text(log_sql), {
            "analysis_id": analysis_id,
            "action_by": current_user["id"],
            "action_by_name": current_user.get("real_name", current_user["username"]),
            "action_by_role": current_user.get("role", ""),
            "action_detail": json.dumps({"format": format}, ensure_ascii=False),
            "ip_address": req.client.host if req.client else None,
            "user_agent": req.headers.get("user-agent")
        })
        db.commit()
        
        analysis_data = json.loads(result.analysis_data) if result.analysis_data else {}
        
        if format == "json":
            return {
                "success": True,
                "data": analysis_data
            }
        else:
            # TODO: 实现Excel和PDF导出
            return {
                "success": True,
                "message": f"{format.upper()}导出功能开发中",
                "data": analysis_data
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出分析结果失败: {e}")
        raise HTTPException(status_code=500, detail="导出分析结果失败")


# ============ 操作日志API ============

@router.get("/logs")
def get_analysis_logs(
    analysis_id: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission("analysis_admin")),
    db: Session = Depends(get_db)
):
    """获取操作日志（仅管理员）"""
    try:
        conditions = []
        params = {}
        
        if analysis_id:
            conditions.append("analysis_id = :analysis_id")
            params["analysis_id"] = analysis_id
        
        if action_type:
            conditions.append("action_type = :action_type")
            params["action_type"] = action_type
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM biz_analysis_logs {where_clause}"
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        offset = (page - 1) * page_size
        list_sql = f"""
            SELECT * FROM biz_analysis_logs 
            {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        records = []
        for result in results:
            records.append({
                "id": result.id,
                "analysis_id": result.analysis_id,
                "publication_id": result.publication_id,
                "action_type": result.action_type,
                "action_by": result.action_by,
                "action_by_name": result.action_by_name,
                "action_by_role": result.action_by_role,
                "action_detail": json.loads(result.action_detail) if result.action_detail else {},
                "ip_address": result.ip_address,
                "created_at": result.created_at.isoformat() if result.created_at else ""
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }
        
    except Exception as e:
        logger.error(f"获取操作日志失败: {e}")
        raise HTTPException(status_code=500, detail="获取操作日志失败")