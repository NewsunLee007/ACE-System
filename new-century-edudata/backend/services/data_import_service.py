"""
数据导入服务
提供Excel/CSV成绩数据导入、学籍数据导入等功能
"""

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Tuple, Optional
import logging
from io import BytesIO
import re

from core.database import is_postgresql, is_sqlite

logger = logging.getLogger(__name__)


class DataImportService:
    """数据导入服务类"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def validate_score_file(self, df: pd.DataFrame) -> Tuple[bool, List[str]]:
        """
        验证成绩导入文件格式
        
        必需列:
        - 学籍辅号 或 学生姓名
        - 班级
        - 至少一科成绩
        
        Returns:
            Tuple[bool, List[str]]: (是否有效, 错误信息列表)
        """
        errors = []
        
        # 检查必需列
        required_cols = ['学籍辅号', '班级']
        optional_id_cols = ['学生姓名', '姓名']
        
        has_id_col = any(col in df.columns for col in ['学籍辅号', '学生姓名', '姓名'])
        if not has_id_col:
            errors.append("缺少学生标识列，需要包含'学籍辅号'或'学生姓名'")
        
        if '班级' not in df.columns:
            errors.append("缺少'班级'列")
        
        # 检查成绩列
        score_cols = ['语文', '数学', '英语', '科学', '社会', '总分']
        has_score = any(col in df.columns for col in score_cols)
        if not has_score:
            errors.append("缺少成绩列，至少需要一科成绩")
        
        # 验证数据类型
        if '班级' in df.columns:
            invalid_class = df[df['班级'].isna() | (df['班级'] == '')]
            if len(invalid_class) > 0:
                errors.append(f"有{len(invalid_class)}行缺少班级信息")
        
        return len(errors) == 0, errors
    
    def import_scores(
        self,
        exam_id: int,
        df: pd.DataFrame,
        skip_invalid: bool = True
    ) -> Dict[str, Any]:
        """
        导入成绩数据
        
        Args:
            exam_id: 考试ID
            df: 成绩数据DataFrame
            skip_invalid: 是否跳过无效记录
            
        Returns:
            Dict: 导入结果统计
        """
        # 验证文件格式
        is_valid, errors = self.validate_score_file(df)
        if not is_valid:
            return {
                "success": False,
                "message": "数据验证失败",
                "errors": errors
            }
        
        # 标准化列名
        column_mapping = {
            '学籍辅号': 'student_code',
            '学生姓名': 'name',
            '姓名': 'name',
            '班级': 'class_name',
            '考场号': 'exam_number',
            '考号': 'exam_number',
            '语文': 'score_chinese',
            '数学': 'score_math',
            '英语': 'score_english',
            '科学': 'score_science',
            '社会': 'score_society',
            '总分': 'total_score',
            '是否参与统计': 'is_included',
            '备注': 'remarks'
        }
        
        # 重命名列
        df_renamed = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        # 导入统计
        stats = {
            "total": len(df_renamed),
            "success": 0,
            "failed": 0,
            "skipped": 0,
            "errors": []
        }
        
        for idx, row in df_renamed.iterrows():
            try:
                # 查找学生ID
                student_id = None
                
                if 'student_code' in row and pd.notna(row['student_code']):
                    # 通过学籍辅号查找
                    result = self.db.execute(
                        text("SELECT id FROM biz_students WHERE student_code = :code"),
                        {"code": str(row['student_code']).strip()}
                    ).fetchone()
                    if result:
                        student_id = result.id
                
                if not student_id and 'name' in row and pd.notna(row['name']):
                    # 通过姓名和班级查找
                    class_name = str(row['class_name']).strip() if 'class_name' in row and pd.notna(row['class_name']) else None
                    if class_name:
                        result = self.db.execute(
                            text("""
                                SELECT id FROM biz_students 
                                WHERE name = :name AND current_class = :class_name
                            """),
                            {"name": str(row['name']).strip(), "class_name": class_name}
                        ).fetchone()
                        if result:
                            student_id = result.id
                
                if not student_id:
                    stats["failed"] += 1
                    stats["errors"].append(f"第{idx+2}行: 未找到学生信息")
                    continue
                
                # 构建成绩数据
                score_data = {
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "class_name": str(row['class_name']).strip() if 'class_name' in row and pd.notna(row['class_name']) else "",
                    "exam_number": str(row['exam_number']).strip() if 'exam_number' in row and pd.notna(row['exam_number']) else None,
                    "score_chinese": float(row['score_chinese']) if 'score_chinese' in row and pd.notna(row['score_chinese']) else None,
                    "score_math": float(row['score_math']) if 'score_math' in row and pd.notna(row['score_math']) else None,
                    "score_english": float(row['score_english']) if 'score_english' in row and pd.notna(row['score_english']) else None,
                    "score_science": float(row['score_science']) if 'score_science' in row and pd.notna(row['score_science']) else None,
                    "score_society": float(row['score_society']) if 'score_society' in row and pd.notna(row['score_society']) else None,
                    "total_score": float(row['total_score']) if 'total_score' in row and pd.notna(row['total_score']) else None,
                    "is_included": 1 if 'is_included' not in row or str(row.get('is_included', '是')) in ['是', '1', 'True'] else 0,
                    "remarks": str(row['remarks']).strip() if 'remarks' in row and pd.notna(row['remarks']) else None
                }
                
                # 如果没有总分，自动计算
                if score_data["total_score"] is None:
                    scores = [
                        score_data["score_chinese"],
                        score_data["score_math"],
                        score_data["score_english"],
                        score_data["score_science"],
                        score_data["score_society"]
                    ]
                    valid_scores = [s for s in scores if s is not None]
                    if valid_scores:
                        score_data["total_score"] = sum(valid_scores)
                
                # 插入或更新成绩
                if is_postgresql(self.db) or is_sqlite(self.db):
                    sql = """
                        INSERT INTO biz_scores
                        (exam_id, student_id, exam_number, class_name,
                         score_chinese, score_math, score_english, score_science, score_society,
                         total_score, is_included, remarks, created_at, updated_at)
                        VALUES
                        (:exam_id, :student_id, :exam_number, :class_name,
                         :score_chinese, :score_math, :score_english, :score_science, :score_society,
                         :total_score, :is_included, :remarks, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (exam_id, student_id) DO UPDATE SET
                        exam_number = excluded.exam_number,
                        class_name = excluded.class_name,
                        score_chinese = excluded.score_chinese,
                        score_math = excluded.score_math,
                        score_english = excluded.score_english,
                        score_science = excluded.score_science,
                        score_society = excluded.score_society,
                        total_score = excluded.total_score,
                        is_included = excluded.is_included,
                        remarks = excluded.remarks,
                        updated_at = CURRENT_TIMESTAMP
                    """
                else:
                    sql = """
                        INSERT INTO biz_scores
                        (exam_id, student_id, exam_number, class_name,
                         score_chinese, score_math, score_english, score_science, score_society,
                         total_score, is_included, remarks, created_at, updated_at)
                        VALUES
                        (:exam_id, :student_id, :exam_number, :class_name,
                         :score_chinese, :score_math, :score_english, :score_science, :score_society,
                         :total_score, :is_included, :remarks, NOW(), NOW())
                        ON DUPLICATE KEY UPDATE
                        exam_number = VALUES(exam_number),
                        class_name = VALUES(class_name),
                        score_chinese = VALUES(score_chinese),
                        score_math = VALUES(score_math),
                        score_english = VALUES(score_english),
                        score_science = VALUES(score_science),
                        score_society = VALUES(score_society),
                        total_score = VALUES(total_score),
                        is_included = VALUES(is_included),
                        remarks = VALUES(remarks),
                        updated_at = NOW()
                    """
                
                self.db.execute(text(sql), score_data)
                stats["success"] += 1
                
            except Exception as e:
                stats["failed"] += 1
                stats["errors"].append(f"第{idx+2}行: {str(e)}")
                logger.error(f"导入成绩失败: {e}")
        
        self.db.commit()
        
        return {
            "success": stats["failed"] == 0,
            "message": f"导入完成: 成功{stats['success']}条, 失败{stats['failed']}条",
            "stats": stats
        }
    
    def import_students(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        导入学生学籍数据
        
        必需列:
        - 学籍辅号
        - 姓名
        - 入学年份
        
        Returns:
            Dict: 导入结果
        """
        # 验证必需列
        required_cols = ['学籍辅号', '姓名', '入学年份']
        for col in required_cols:
            if col not in df.columns:
                return {
                    "success": False,
                    "message": f"缺少必需列: {col}"
                }
        
        # 标准化列名
        column_mapping = {
            '学籍辅号': 'student_code',
            '姓名': 'name',
            '学生姓名': 'name',
            '性别': 'gender',
            '入学年份': 'enrollment_year',
            '当前年级': 'current_grade',
            '当前班级': 'current_class',
            '班级编号': 'current_class',
            '班级': 'current_class',
            '班级ID': 'current_class',
            '状态': 'status',
            '状态(在读/休学/转学/退学)': 'status',
            '身份证号后6位': 'id_card_last6'
        }
        
        df_renamed = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        stats = {
            "total": len(df_renamed),
            "success": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for idx, row in df_renamed.iterrows():
            try:
                student_data = {
                    "student_code": str(row['student_code']).strip(),
                    "name": str(row['name']).strip(),
                    "gender": 1 if str(row.get('gender', '男')) in ['男', '1', 'M'] else 0,
                    "enrollment_year": int(row['enrollment_year']),
                    "current_grade": str(row['current_grade']).strip() if 'current_grade' in row and pd.notna(row['current_grade']) else None,
                    "current_class": str(row['current_class']).strip() if 'current_class' in row and pd.notna(row['current_class']) else None,
                    "status": str(row['status']).strip() if 'status' in row and pd.notna(row['status']) else "在读",
                    "id_card_last6": str(row['id_card_last6']).strip() if 'id_card_last6' in row and pd.notna(row['id_card_last6']) else None
                }
                
                # 检查是否已存在
                existing = self.db.execute(
                    text("SELECT id FROM biz_students WHERE student_code = :student_code"),
                    {"student_code": student_data["student_code"]}
                ).fetchone()
                
                if existing:
                    # 更新
                    sql = """
                        UPDATE biz_students SET
                            name = :name,
                            gender = :gender,
                            enrollment_year = :enrollment_year,
                            current_grade = :current_grade,
                            current_class = :current_class,
                            status = :status,
                            id_card_last6 = :id_card_last6,
                            updated_at = NOW()
                        WHERE student_code = :student_code
                    """
                    self.db.execute(text(sql), student_data)
                    stats["updated"] += 1
                else:
                    # 插入
                    sql = """
                        INSERT INTO biz_students 
                        (student_code, name, gender, enrollment_year, current_grade, current_class, status, id_card_last6, created_at, updated_at)
                        VALUES 
                        (:student_code, :name, :gender, :enrollment_year, :current_grade, :current_class, :status, :id_card_last6, NOW(), NOW())
                    """
                    self.db.execute(text(sql), student_data)
                    stats["success"] += 1
                    
            except Exception as e:
                stats["failed"] += 1
                stats["errors"].append(f"第{idx+2}行: {str(e)}")
                logger.error(f"导入学生失败: {e}")
        
        self.db.commit()
        
        return {
            "success": stats["failed"] == 0,
            "message": f"导入完成: 新增{stats['success']}条, 更新{stats['updated']}条, 失败{stats['failed']}条",
            "stats": stats
        }
    
    def create_class_layer(self, exam_id: int, layer_name: str, class_names: List[str], description: str = None) -> Dict[str, Any]:
        """
        创建班级分层
        
        Args:
            exam_id: 考试ID
            layer_name: 分层名称(如 "A层")
            class_names: 班级列表(如 ["701", "702", ...])
            description: 分层描述
            
        Returns:
            Dict: 创建结果
        """
        try:
            # 创建分层主记录
            sql = """
                INSERT INTO biz_class_layers (exam_id, layer_name, description, created_at)
                VALUES (:exam_id, :layer_name, :description, NOW())
            """
            result = self.db.execute(text(sql), {
                "exam_id": exam_id,
                "layer_name": layer_name,
                "description": description
            })
            
            layer_id = result.lastrowid
            
            # 添加分层明细
            for class_name in class_names:
                detail_sql = """
                    INSERT INTO biz_class_layer_details (layer_id, class_name, created_at)
                    VALUES (:layer_id, :class_name, NOW())
                """
                self.db.execute(text(detail_sql), {
                    "layer_id": layer_id,
                    "class_name": class_name.strip()
                })
            
            self.db.commit()
            
            return {
                "success": True,
                "message": f"分层'{layer_name}'创建成功",
                "layer_id": layer_id,
                "exam_id": exam_id,
                "class_count": len(class_names)
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"创建分层失败: {e}")
            return {
                "success": False,
                "message": f"创建分层失败: {str(e)}"
            }


class DataExportService:
    """数据导出服务类"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def export_scores_to_excel(self, exam_id: int, layer_id: Optional[int] = None) -> bytes:
        """
        导出成绩数据为Excel
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID(可选)
            
        Returns:
            bytes: Excel文件内容
        """
        # 构建查询
        if layer_id:
            sql = """
                SELECT 
                    st.student_code as '学籍辅号',
                    st.name as '姓名',
                    st.current_class as '班级',
                    s.exam_number as '考号',
                    s.score_chinese as '语文',
                    s.score_math as '数学',
                    s.score_english as '英语',
                    s.score_science as '科学',
                    s.score_society as '社会',
                    s.total_score as '总分',
                    CASE WHEN s.is_included = 1 THEN '是' ELSE '否' END as '参与统计',
                    s.remarks as '备注'
                FROM biz_scores s
                JOIN biz_students st ON s.student_id = st.id
                JOIN biz_class_layer_details d ON s.class_name = d.class_name
                WHERE s.exam_id = :exam_id AND d.layer_id = :layer_id
                ORDER BY s.total_score DESC
            """
            params = {"exam_id": exam_id, "layer_id": layer_id}
        else:
            sql = """
                SELECT 
                    st.student_code as '学籍辅号',
                    st.name as '姓名',
                    st.current_class as '班级',
                    s.exam_number as '考号',
                    s.score_chinese as '语文',
                    s.score_math as '数学',
                    s.score_english as '英语',
                    s.score_science as '科学',
                    s.score_society as '社会',
                    s.total_score as '总分',
                    CASE WHEN s.is_included = 1 THEN '是' ELSE '否' END as '参与统计',
                    s.remarks as '备注'
                FROM biz_scores s
                JOIN biz_students st ON s.student_id = st.id
                WHERE s.exam_id = :exam_id
                ORDER BY s.total_score DESC
            """
            params = {"exam_id": exam_id}
        
        # 查询数据
        df = pd.read_sql(text(sql), self.db.bind, params=params)
        
        # 导出为Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='成绩明细', index=False)
        
        output.seek(0)
        return output.getvalue()
    
    def export_class_z_values(self, exam_id: int, layer_id: int) -> bytes:
        """
        导出班级Z值排名
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            bytes: Excel文件内容
        """
        sql = """
            SELECT 
                class_name as '班级',
                class_mean as '班级均分',
                layer_mean as '分层均分',
                ROUND(class_mean - layer_mean, 2) as '与分层均差',
                standard_score as '标准分',
                top20_ratio as '前20%率',
                top80_ratio as '前80%率',
                final_z_value as '综合Z值',
                class_count as '有效人数'
            FROM biz_class_z_values
            WHERE exam_id = :exam_id AND layer_id = :layer_id
            ORDER BY final_z_value DESC
        """
        
        df = pd.read_sql(text(sql), self.db.bind, params={"exam_id": exam_id, "layer_id": layer_id})
        
        # 添加排名列
        df.insert(0, '排名', range(1, len(df) + 1))
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='班级Z值排名', index=False)
        
        output.seek(0)
        return output.getvalue()
    
    def export_subject_thresholds(self, exam_id: int, layer_id: int) -> bytes:
        """
        导出学科有效分/下限分
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            bytes: Excel文件内容
        """
        sql = """
            SELECT 
                CONCAT('前', CAST(percentage * 100 AS UNSIGNED), '%') as '分数段',
                threshold_total as '总分下限',
                threshold_chinese as '语文',
                threshold_math as '数学',
                threshold_english as '英语',
                threshold_science as '科学',
                threshold_society as '社会',
                student_count as '达标人数'
            FROM biz_subject_thresholds
            WHERE exam_id = :exam_id AND layer_id = :layer_id
            ORDER BY percentage ASC
        """
        
        df = pd.read_sql(text(sql), self.db.bind, params={"exam_id": exam_id, "layer_id": layer_id})
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='有效分/下限分', index=False)
        
        output.seek(0)
        return output.getvalue()
