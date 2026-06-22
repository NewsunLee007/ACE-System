"""
报表生成服务
提供PDF报告生成、学生成绩单、班级分析报告等功能
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """报表生成服务类"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def generate_student_report_card(
        self,
        student_id: int,
        exam_id: int
    ) -> Dict[str, Any]:
        """
        生成学生成绩单
        
        Args:
            student_id: 学生ID
            exam_id: 考试ID
            
        Returns:
            Dict: 成绩单数据
        """
        # 查询学生信息
        student_sql = """
            SELECT id, student_code, name, gender, current_grade, current_class
            FROM biz_students
            WHERE id = :student_id
        """
        student = self.db.execute(text(student_sql), {"student_id": student_id}).fetchone()
        
        if not student:
            raise ValueError("学生不存在")
        
        # 查询考试信息
        exam_sql = """
            SELECT id, exam_name, term, exam_type, exam_date, full_score
            FROM biz_exams
            WHERE id = :exam_id
        """
        exam = self.db.execute(text(exam_sql), {"exam_id": exam_id}).fetchone()
        
        if not exam:
            raise ValueError("考试不存在")
        
        # 查询成绩
        score_sql = """
            SELECT 
                s.total_score,
                s.score_chinese,
                s.score_math,
                s.score_english,
                s.score_science,
                s.score_society,
                RANK() OVER (PARTITION BY s.exam_id, s.class_name ORDER BY s.total_score DESC) as class_rank,
                RANK() OVER (PARTITION BY s.exam_id ORDER BY s.total_score DESC) as grade_rank
            FROM biz_scores s
            WHERE s.student_id = :student_id AND s.exam_id = :exam_id
        """
        score = self.db.execute(text(score_sql), {"student_id": student_id, "exam_id": exam_id}).fetchone()
        
        if not score:
            raise ValueError("成绩不存在")
        
        # 查询班级统计
        class_stats_sql = """
            SELECT 
                AVG(total_score) as class_avg,
                MAX(total_score) as class_max,
                MIN(total_score) as class_min
            FROM biz_scores
            WHERE exam_id = :exam_id AND class_name = :class_name AND is_included = 1
        """
        class_stats = self.db.execute(
            text(class_stats_sql),
            {"exam_id": exam_id, "class_name": student.current_class}
        ).fetchone()
        
        # 构建成绩单数据
        report_card = {
            "student": {
                "id": student.id,
                "student_code": student.student_code,
                "name": student.name,
                "gender": "男" if student.gender == 1 else "女",
                "grade": student.current_grade,
                "class": student.current_class
            },
            "exam": {
                "id": exam.id,
                "name": exam.exam_name,
                "term": exam.term,
                "type": exam.exam_type,
                "date": exam.exam_date.isoformat() if exam.exam_date else "",
                "full_score": float(exam.full_score) if exam.full_score else 500
            },
            "scores": {
                "total": float(score.total_score) if score.total_score else 0,
                "chinese": float(score.score_chinese) if score.score_chinese else 0,
                "math": float(score.score_math) if score.score_math else 0,
                "english": float(score.score_english) if score.score_english else 0,
                "science": float(score.score_science) if score.score_science else 0,
                "society": float(score.score_society) if score.score_society else 0
            },
            "ranking": {
                "class_rank": score.class_rank,
                "grade_rank": score.grade_rank
            },
            "class_statistics": {
                "average": round(float(class_stats.class_avg), 2) if class_stats and class_stats.class_avg else 0,
                "highest": round(float(class_stats.class_max), 1) if class_stats and class_stats.class_max else 0,
                "lowest": round(float(class_stats.class_min), 1) if class_stats and class_stats.class_min else 0
            },
            "generated_at": datetime.now().isoformat()
        }
        
        return report_card
    
    def generate_class_analysis_report(
        self,
        exam_id: int,
        layer_id: int,
        class_name: str
    ) -> Dict[str, Any]:
        """
        生成班级分析报告
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            class_name: 班级名称
            
        Returns:
            Dict: 分析报告数据
        """
        # 查询考试信息
        exam_sql = """
            SELECT exam_name, term, exam_type, grade_level
            FROM biz_exams
            WHERE id = :exam_id
        """
        exam = self.db.execute(text(exam_sql), {"exam_id": exam_id}).fetchone()
        
        if not exam:
            raise ValueError("考试不存在")
        
        # 查询班级成绩统计
        class_stats_sql = """
            SELECT 
                COUNT(*) as student_count,
                AVG(total_score) as avg_score,
                MAX(total_score) as max_score,
                MIN(total_score) as min_score,
                STDDEV(total_score) as std_score,
                AVG(score_chinese) as avg_chinese,
                AVG(score_math) as avg_math,
                AVG(score_english) as avg_english,
                AVG(score_science) as avg_science,
                AVG(score_society) as avg_society
            FROM biz_scores
            WHERE exam_id = :exam_id AND class_name = :class_name AND is_included = 1
        """
        class_stats = self.db.execute(
            text(class_stats_sql),
            {"exam_id": exam_id, "class_name": class_name}
        ).fetchone()
        
        # 查询分层统计
        layer_stats_sql = """
            SELECT AVG(total_score) as layer_avg
            FROM biz_scores s
            JOIN biz_class_layer_details d ON s.class_name = d.class_name
            WHERE s.exam_id = :exam_id AND d.layer_id = :layer_id AND s.is_included = 1
        """
        layer_stats = self.db.execute(
            text(layer_stats_sql),
            {"exam_id": exam_id, "layer_id": layer_id}
        ).fetchone()
        
        # 查询Z值
        z_value_sql = """
            SELECT final_z_value, top20_ratio, top80_ratio
            FROM biz_class_z_values
            WHERE exam_id = :exam_id AND layer_id = :layer_id AND class_name = :class_name
        """
        z_value = self.db.execute(
            text(z_value_sql),
            {"exam_id": exam_id, "layer_id": layer_id, "class_name": class_name}
        ).fetchone()
        
        # 分数段分布
        distribution_sql = """
            SELECT 
                SUM(CASE WHEN total_score >= 450 THEN 1 ELSE 0 END) as excellent,
                SUM(CASE WHEN total_score >= 400 AND total_score < 450 THEN 1 ELSE 0 END) as good,
                SUM(CASE WHEN total_score >= 350 AND total_score < 400 THEN 1 ELSE 0 END) as average,
                SUM(CASE WHEN total_score >= 300 AND total_score < 350 THEN 1 ELSE 0 END) as pass,
                SUM(CASE WHEN total_score < 300 THEN 1 ELSE 0 END) as fail
            FROM biz_scores
            WHERE exam_id = :exam_id AND class_name = :class_name AND is_included = 1
        """
        distribution = self.db.execute(
            text(distribution_sql),
            {"exam_id": exam_id, "class_name": class_name}
        ).fetchone()
        
        # 学生名单及排名
        students_sql = """
            SELECT 
                st.name,
                st.student_code,
                s.total_score,
                RANK() OVER (ORDER BY s.total_score DESC) as rank
            FROM biz_scores s
            JOIN biz_students st ON s.student_id = st.id
            WHERE s.exam_id = :exam_id AND s.class_name = :class_name AND s.is_included = 1
            ORDER BY s.total_score DESC
        """
        students = self.db.execute(
            text(students_sql),
            {"exam_id": exam_id, "class_name": class_name}
        ).fetchall()
        
        report = {
            "exam": {
                "name": exam.exam_name,
                "term": exam.term,
                "type": exam.exam_type,
                "grade": exam.grade_level
            },
            "class": {
                "name": class_name,
                "student_count": class_stats.student_count if class_stats else 0
            },
            "overall_statistics": {
                "average": round(float(class_stats.avg_score), 2) if class_stats and class_stats.avg_score else 0,
                "highest": round(float(class_stats.max_score), 1) if class_stats and class_stats.max_score else 0,
                "lowest": round(float(class_stats.min_score), 1) if class_stats and class_stats.min_score else 0,
                "standard_deviation": round(float(class_stats.std_score), 2) if class_stats and class_stats.std_score else 0,
                "layer_average": round(float(layer_stats.layer_avg), 2) if layer_stats and layer_stats.layer_avg else 0,
                "diff_from_layer": round(float(class_stats.avg_score - layer_stats.layer_avg), 2) if class_stats and layer_stats and class_stats.avg_score and layer_stats.layer_avg else 0
            },
            "z_value_analysis": {
                "z_value": round(float(z_value.final_z_value), 4) if z_value and z_value.final_z_value else 0,
                "top20_ratio": round(float(z_value.top20_ratio), 2) if z_value and z_value.top20_ratio else 0,
                "top80_ratio": round(float(z_value.top80_ratio), 2) if z_value and z_value.top80_ratio else 0
            },
            "subject_averages": {
                "chinese": round(float(class_stats.avg_chinese), 2) if class_stats and class_stats.avg_chinese else 0,
                "math": round(float(class_stats.avg_math), 2) if class_stats and class_stats.avg_math else 0,
                "english": round(float(class_stats.avg_english), 2) if class_stats and class_stats.avg_english else 0,
                "science": round(float(class_stats.avg_science), 2) if class_stats and class_stats.avg_science else 0,
                "society": round(float(class_stats.avg_society), 2) if class_stats and class_stats.avg_society else 0
            },
            "score_distribution": {
                "excellent_450_500": distribution.excellent if distribution else 0,
                "good_400_449": distribution.good if distribution else 0,
                "average_350_399": distribution.average if distribution else 0,
                "pass_300_349": distribution.pass_ if distribution else 0,
                "fail_below_300": distribution.fail if distribution else 0
            },
            "student_rankings": [
                {
                    "rank": s.rank,
                    "name": s.name,
                    "student_code": s.student_code,
                    "total_score": float(s.total_score) if s.total_score else 0
                } for s in students
            ],
            "generated_at": datetime.now().isoformat()
        }
        
        return report
    
    def generate_comprehensive_report(
        self,
        exam_id: int,
        layer_id: int
    ) -> Dict[str, Any]:
        """
        生成综合分析报告
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            Dict: 综合分析报告
        """
        # 查询考试信息
        exam_sql = """
            SELECT exam_name, term, exam_type, grade_level
            FROM biz_exams
            WHERE id = :exam_id
        """
        exam = self.db.execute(text(exam_sql), {"exam_id": exam_id}).fetchone()
        
        if not exam:
            raise ValueError("考试不存在")
        
        # 查询分层信息
        layer_sql = """
            SELECT layer_name, description
            FROM biz_class_layers
            WHERE id = :layer_id
        """
        layer = self.db.execute(text(layer_sql), {"layer_id": layer_id}).fetchone()
        
        # 查询所有班级Z值排名
        z_values_sql = """
            SELECT 
                class_name,
                class_mean,
                final_z_value,
                top20_ratio,
                top80_ratio,
                class_count
            FROM biz_class_z_values
            WHERE exam_id = :exam_id AND layer_id = :layer_id
            ORDER BY final_z_value DESC
        """
        z_values = self.db.execute(
            text(z_values_sql),
            {"exam_id": exam_id, "layer_id": layer_id}
        ).fetchall()
        
        # 查询学科有效分
        thresholds_sql = """
            SELECT 
                percentage,
                threshold_total,
                threshold_chinese,
                threshold_math,
                threshold_english,
                threshold_science,
                threshold_society,
                student_count
            FROM biz_subject_thresholds
            WHERE exam_id = :exam_id AND layer_id = :layer_id
            ORDER BY percentage ASC
        """
        thresholds = self.db.execute(
            text(thresholds_sql),
            {"exam_id": exam_id, "layer_id": layer_id}
        ).fetchall()
        
        # 分层整体统计
        layer_stats_sql = """
            SELECT 
                COUNT(*) as total_students,
                AVG(total_score) as avg_score,
                MAX(total_score) as max_score,
                MIN(total_score) as min_score
            FROM biz_scores s
            JOIN biz_class_layer_details d ON s.class_name = d.class_name
            WHERE s.exam_id = :exam_id AND d.layer_id = :layer_id AND s.is_included = 1
        """
        layer_stats = self.db.execute(
            text(layer_stats_sql),
            {"exam_id": exam_id, "layer_id": layer_id}
        ).fetchone()
        
        report = {
            "title": f"{exam.exam_name} - 综合分析报告",
            "exam_info": {
                "name": exam.exam_name,
                "term": exam.term,
                "type": exam.exam_type,
                "grade": exam.grade_level
            },
            "layer_info": {
                "name": layer.layer_name if layer else "",
                "description": layer.description if layer else ""
            },
            "overall_statistics": {
                "total_students": layer_stats.total_students if layer_stats else 0,
                "average_score": round(float(layer_stats.avg_score), 2) if layer_stats and layer_stats.avg_score else 0,
                "highest_score": round(float(layer_stats.max_score), 1) if layer_stats and layer_stats.max_score else 0,
                "lowest_score": round(float(layer_stats.min_score), 1) if layer_stats and layer_stats.min_score else 0
            },
            "class_rankings": [
                {
                    "rank": idx + 1,
                    "class_name": z.class_name,
                    "z_value": round(float(z.final_z_value), 4) if z.final_z_value else 0,
                    "average": round(float(z.class_mean), 2) if z.class_mean else 0,
                    "top20_ratio": round(float(z.top20_ratio), 2) if z.top20_ratio else 0,
                    "top80_ratio": round(float(z.top80_ratio), 2) if z.top80_ratio else 0,
                    "student_count": z.class_count
                } for idx, z in enumerate(z_values)
            ],
            "subject_thresholds": [
                {
                    "percentage": f"{int(t.percentage * 100)}%",
                    "total": t.threshold_total,
                    "chinese": t.threshold_chinese,
                    "math": t.threshold_math,
                    "english": t.threshold_english,
                    "science": t.threshold_science,
                    "society": t.threshold_society,
                    "student_count": t.student_count
                } for t in thresholds
            ],
            "generated_at": datetime.now().isoformat()
        }
        
        return report
