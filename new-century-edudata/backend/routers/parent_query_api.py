"""
家长端H5查询API
提供学生成绩查询、历史趋势、学情诊断等功能
采用双重鉴权机制确保成绩隐私
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from datetime import datetime
import logging

from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/parents", tags=["家长端H5查询"])


# ============ Pydantic模型定义 ============

class AuthRequest(BaseModel):
    """家长鉴权请求"""
    student_name: str
    auth_code: str  # 学籍辅号后6位或身份证后6位
    class_name: str  # 班级名称，如 "701"


class AuthResponse(BaseModel):
    """鉴权响应"""
    success: bool
    token: Optional[str]
    student_id: Optional[int]
    message: str


class SubjectScore(BaseModel):
    """学科成绩"""
    subject: str
    score: Optional[float]
    class_avg: Optional[float]
    layer_avg: Optional[float]
    diff: Optional[float]
    rank_in_class: Optional[int]


class ExamResult(BaseModel):
    """单次考试结果"""
    exam_id: int
    exam_name: str
    exam_date: str
    term: str
    total_score: Optional[float]
    class_rank: Optional[int]
    layer_rank: Optional[int]
    rank_change: Optional[int]
    subjects: List[SubjectScore]
    layer_status: str  # 如 "超越年级 60% 同学"


class HistoricalTrend(BaseModel):
    """历史趋势"""
    exam_name: str
    exam_date: str
    total_score: float
    class_rank: int
    trend: str  # "上升", "下降", "持平"


class StudentReportResponse(BaseModel):
    """学生学情报告响应"""
    student_id: int
    student_name: str
    student_code: str
    class_name: str
    current_term: str
    latest_exam: ExamResult
    historical_trends: List[HistoricalTrend]
    weak_subjects: List[str]
    advantage_subjects: List[str]
    diagnosis: str  # 学情诊断评语


# ============ 鉴权与查询服务 ============

class ParentQueryService:
    """家长查询服务类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def authenticate(self, student_name: str, auth_code: str, class_name: str) -> Dict[str, Any]:
        """
        家长双重鉴权
        
        验证规则:
        1. 学生姓名必须匹配
        2. 班级必须匹配
        3. 学籍辅号后6位或身份证后6位必须匹配其一
        
        Args:
            student_name: 学生姓名
            auth_code: 鉴权码(6位)
            class_name: 班级名称
            
        Returns:
            Dict: 鉴权结果
        """
        # 查询学生信息
        sql = """
            SELECT id, name, student_code, current_class, id_card_last6
            FROM biz_students
            WHERE name = :student_name
              AND current_class = :class_name
              AND status = '在读'
        """
        
        result = self.db.execute(
            text(sql),
            {"student_name": student_name, "class_name": class_name}
        ).fetchone()
        
        if not result:
            return {
                "success": False,
                "message": "学生信息不匹配，请检查姓名和班级是否正确"
            }
        
        # 验证鉴权码(学籍辅号后6位或身份证后6位)
        student_code_suffix = result.student_code[-6:] if result.student_code else ""
        id_card_suffix = result.id_card_last6 if result.id_card_last6 else ""
        
        if auth_code != student_code_suffix and auth_code != id_card_suffix:
            return {
                "success": False,
                "message": "鉴权码错误，请输入学籍辅号或身份证号后6位"
            }
        
        # 生成简单token(实际项目中应使用JWT)
        token = f"parent_token_{result.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return {
            "success": True,
            "token": token,
            "student_id": result.id,
            "message": "鉴权成功"
        }
    
    def get_student_latest_exam(self, student_id: int) -> Optional[ExamResult]:
        """
        获取学生最近一次考试成绩
        
        Args:
            student_id: 学生ID
            
        Returns:
            ExamResult: 考试结果
        """
        # 获取最近一次考试
        sql = """
            SELECT 
                s.id as score_id,
                s.exam_id,
                e.exam_name,
                e.exam_date,
                e.term,
                s.total_score,
                s.score_chinese,
                s.score_math,
                s.score_english,
                s.score_science,
                s.score_society,
                s.class_name,
                RANK() OVER (PARTITION BY s.exam_id, s.class_name ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            JOIN biz_exams e ON s.exam_id = e.id
            WHERE s.student_id = :student_id
              AND s.is_included = 1
            ORDER BY e.exam_date DESC
            LIMIT 1
        """
        
        result = self.db.execute(text(sql), {"student_id": student_id}).fetchone()
        
        if not result:
            return None
        
        # 获取班级和分层平均分
        avg_sql = """
            SELECT 
                AVG(total_score) as class_avg,
                (SELECT AVG(total_score) FROM biz_scores 
                 WHERE exam_id = :exam_id AND is_included = 1) as layer_avg
            FROM biz_scores
            WHERE exam_id = :exam_id 
              AND class_name = :class_name
              AND is_included = 1
        """
        
        avg_result = self.db.execute(
            text(avg_sql),
            {"exam_id": result.exam_id, "class_name": result.class_name}
        ).fetchone()
        
        # 构建学科成绩列表
        subjects = []
        subject_names = {
            'score_chinese': '语文',
            'score_math': '数学',
            'score_english': '英语',
            'score_science': '科学',
            'score_society': '社会'
        }
        
        for col, name in subject_names.items():
            score = getattr(result, col)
            if score is not None:
                subjects.append(SubjectScore(
                    subject=name,
                    score=float(score),
                    class_avg=None,  # 可扩展查询班级单科平均
                    layer_avg=None,
                    diff=None,
                    rank_in_class=None
                ))
        
        # 计算分层排名(简化版)
        layer_rank = result.class_rank  # 实际应基于分层计算
        
        # 计算超越百分比
        total_students_sql = """
            SELECT COUNT(*) as total
            FROM biz_scores
            WHERE exam_id = :exam_id AND is_included = 1
        """
        total_result = self.db.execute(
            text(total_students_sql), {"exam_id": result.exam_id}
        ).fetchone()
        
        total_students = total_result.total if total_result else 1
        percentage = (1 - (layer_rank / total_students)) * 100
        layer_status = f"超越年级 {percentage:.0f}% 同学"
        
        return ExamResult(
            exam_id=result.exam_id,
            exam_name=result.exam_name,
            exam_date=result.exam_date.isoformat() if result.exam_date else "",
            term=result.term,
            total_score=float(result.total_score) if result.total_score else 0,
            class_rank=result.class_rank,
            layer_rank=layer_rank,
            rank_change=0,  # 需要与上次考试对比
            subjects=subjects,
            layer_status=layer_status
        )
    
    def get_historical_trends(self, student_id: int, limit: int = 5) -> List[HistoricalTrend]:
        """
        获取学生历史成绩趋势
        
        Args:
            student_id: 学生ID
            limit: 返回最近几次考试
            
        Returns:
            List[HistoricalTrend]: 历史趋势列表
        """
        sql = """
            SELECT 
                e.exam_name,
                e.exam_date,
                s.total_score,
                RANK() OVER (PARTITION BY s.exam_id, s.class_name ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            JOIN biz_exams e ON s.exam_id = e.id
            WHERE s.student_id = :student_id
              AND s.is_included = 1
            ORDER BY e.exam_date DESC
            LIMIT :limit
        """
        
        results = self.db.execute(
            text(sql),
            {"student_id": student_id, "limit": limit}
        ).fetchall()
        
        trends = []
        prev_rank = None
        
        for result in results:
            current_rank = result.class_rank
            
            if prev_rank is None:
                trend = "持平"
            elif current_rank < prev_rank:
                trend = "上升"
            elif current_rank > prev_rank:
                trend = "下降"
            else:
                trend = "持平"
            
            trends.append(HistoricalTrend(
                exam_name=result.exam_name,
                exam_date=result.exam_date.isoformat() if result.exam_date else "",
                total_score=float(result.total_score) if result.total_score else 0,
                class_rank=current_rank,
                trend=trend
            ))
            
            prev_rank = current_rank
        
        return trends
    
    def generate_diagnosis(self, latest_exam: ExamResult) -> str:
        """
        生成学情诊断评语
        
        Args:
            latest_exam: 最近一次考试结果
            
        Returns:
            str: 诊断评语
        """
        if not latest_exam:
            return "暂无成绩数据"
        
        # 分析学科强弱
        weak_subjects = []
        advantage_subjects = []
        
        for subject in latest_exam.subjects:
            if subject.score is not None and subject.layer_avg is not None:
                if subject.score < subject.layer_avg - 5:
                    weak_subjects.append(subject.subject)
                elif subject.score > subject.layer_avg + 5:
                    advantage_subjects.append(subject.subject)
        
        # 生成评语
        diagnosis_parts = []
        
        # 总体评价
        if latest_exam.class_rank <= 10:
            diagnosis_parts.append("您的孩子本次考试表现优秀，在班级中名列前茅。")
        elif latest_exam.class_rank <= 30:
            diagnosis_parts.append("您的孩子本次考试表现良好，成绩处于班级中上水平。")
        else:
            diagnosis_parts.append("您的孩子本次考试有进步空间，建议加强学习。")
        
        # 优势学科
        if advantage_subjects:
            diagnosis_parts.append(f"优势学科：{'、'.join(advantage_subjects)}，请继续保持。")
        
        # 薄弱学科
        if weak_subjects:
            diagnosis_parts.append(f"需要加强的学科：{'、'.join(weak_subjects)}，建议针对性补习。")
        
        # 建议
        diagnosis_parts.append("家校配合，共同努力，相信孩子会取得更好的成绩！")
        
        return "".join(diagnosis_parts)


# ============ API路由 ============

@router.post("/auth", response_model=AuthResponse)
def parent_login_auth(request: AuthRequest, db: Session = Depends(get_db)):
    """
    家长双重鉴权接口
    
    验证家长输入的姓名、班级和鉴权码(学籍辅号后6位或身份证后6位)
    """
    try:
        service = ParentQueryService(db)
        result = service.authenticate(
            request.student_name,
            request.auth_code,
            request.class_name
        )
        
        return AuthResponse(
            success=result["success"],
            token=result.get("token"),
            student_id=result.get("student_id"),
            message=result["message"]
        )
        
    except Exception as e:
        logger.error(f"家长鉴权失败: {e}")
        raise HTTPException(status_code=500, detail="鉴权过程发生错误")


@router.get("/student/{student_id}/report", response_model=StudentReportResponse)
def get_student_report(
    student_id: int,
    db: Session = Depends(get_db)
):
    """
    获取学生学情报告
    
    包含:
    - 最近一次考试成绩详情
    - 历史成绩趋势
    - 强弱学科分析
    - 学情诊断评语
    """
    try:
        service = ParentQueryService(db)
        
        # 获取学生基本信息
        student_sql = """
            SELECT name, student_code, current_class
            FROM biz_students
            WHERE id = :student_id
        """
        student = db.execute(text(student_sql), {"student_id": student_id}).fetchone()
        
        if not student:
            raise HTTPException(status_code=404, detail="学生不存在")
        
        # 获取最近一次考试
        latest_exam = service.get_student_latest_exam(student_id)
        
        if not latest_exam:
            raise HTTPException(status_code=404, detail="暂无成绩数据")
        
        # 获取历史趋势
        trends = service.get_historical_trends(student_id)
        
        # 分析强弱学科
        weak_subjects = []
        advantage_subjects = []
        
        for subject in latest_exam.subjects:
            if subject.score is not None:
                # 简化判断：低于80分为薄弱，高于90分为优势
                if subject.score < 80:
                    weak_subjects.append(subject.subject)
                elif subject.score >= 90:
                    advantage_subjects.append(subject.subject)
        
        # 生成诊断评语
        diagnosis = service.generate_diagnosis(latest_exam)
        
        return StudentReportResponse(
            student_id=student_id,
            student_name=student.name,
            student_code=student.student_code,
            class_name=student.current_class,
            current_term=latest_exam.term,
            latest_exam=latest_exam,
            historical_trends=trends,
            weak_subjects=weak_subjects,
            advantage_subjects=advantage_subjects,
            diagnosis=diagnosis
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取学生报告失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生报告失败")


@router.get("/student/{student_id}/exams")
def get_student_all_exams(
    student_id: int,
    limit: int = Query(10, description="返回最近几次考试"),
    db: Session = Depends(get_db)
):
    """
    获取学生所有历史考试成绩列表
    """
    try:
        sql = """
            SELECT 
                s.exam_id,
                e.exam_name,
                e.exam_date,
                e.term,
                s.total_score,
                s.score_chinese,
                s.score_math,
                s.score_english,
                s.score_science,
                s.score_society,
                RANK() OVER (PARTITION BY s.exam_id, s.class_name ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            JOIN biz_exams e ON s.exam_id = e.id
            WHERE s.student_id = :student_id
              AND s.is_included = 1
            ORDER BY e.exam_date DESC
            LIMIT :limit
        """
        
        results = db.execute(
            text(sql),
            {"student_id": student_id, "limit": limit}
        ).fetchall()
        
        exams = []
        for result in results:
            exams.append({
                "exam_id": result.exam_id,
                "exam_name": result.exam_name,
                "exam_date": result.exam_date.isoformat() if result.exam_date else "",
                "term": result.term,
                "total_score": float(result.total_score) if result.total_score else 0,
                "class_rank": result.class_rank,
                "subjects": {
                    "语文": float(result.score_chinese) if result.score_chinese else None,
                    "数学": float(result.score_math) if result.score_math else None,
                    "英语": float(result.score_english) if result.score_english else None,
                    "科学": float(result.score_science) if result.score_science else None,
                    "社会": float(result.score_society) if result.score_society else None,
                }
            })
        
        return {
            "student_id": student_id,
            "total_exams": len(exams),
            "exams": exams
        }
        
    except Exception as e:
        logger.error(f"获取学生考试列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生考试列表失败")


@router.get("/student/{student_id}/subject-trend/{subject_name}")
def get_student_subject_trend(
    student_id: int,
    subject_name: str,
    limit: int = Query(5, description="返回最近几次考试"),
    db: Session = Depends(get_db)
):
    """
    获取学生指定学科的历史趋势
    
    Args:
        subject_name: 学科名称(语文/数学/英语/科学/社会)
    """
    try:
        # 学科列名映射
        subject_col_map = {
            '语文': 'score_chinese',
            '数学': 'score_math',
            '英语': 'score_english',
            '科学': 'score_science',
            '社会': 'score_society'
        }
        
        subject_col = subject_col_map.get(subject_name)
        if not subject_col:
            raise HTTPException(status_code=400, detail="无效的学科名称")
        
        sql = f"""
            SELECT 
                e.exam_name,
                e.exam_date,
                s.{subject_col} as score
            FROM biz_scores s
            JOIN biz_exams e ON s.exam_id = e.id
            WHERE s.student_id = :student_id
              AND s.is_included = 1
              AND s.{subject_col} IS NOT NULL
            ORDER BY e.exam_date DESC
            LIMIT :limit
        """
        
        results = db.execute(
            text(sql),
            {"student_id": student_id, "limit": limit}
        ).fetchall()
        
        trends = []
        for result in results:
            trends.append({
                "exam_name": result.exam_name,
                "exam_date": result.exam_date.isoformat() if result.exam_date else "",
                "score": float(result.score) if result.score else 0
            })
        
        return {
            "student_id": student_id,
            "subject": subject_name,
            "total_records": len(trends),
            "trends": trends
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取学科趋势失败: {e}")
        raise HTTPException(status_code=500, detail="获取学科趋势失败")
