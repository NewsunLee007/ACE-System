"""
成绩分析分层体系服务
支持全年级范围分析、分层维度统计、分层推送
"""

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging

from core.database import is_postgresql, is_sqlite

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class LayerStatistics:
    """分层统计数据类"""
    exam_id: int
    layer_code: str
    subject_name: str
    total_students: int
    valid_students: int
    mean_score: float = 0.0
    median_score: float = 0.0
    std_score: float = 0.0
    max_score: float = 0.0
    min_score: float = 0.0
    q1_score: float = 0.0
    q3_score: float = 0.0
    pass_count: int = 0
    pass_rate: float = 0.0
    excellent_count: int = 0
    excellent_rate: float = 0.0
    fail_count: int = 0
    fail_rate: float = 0.0
    score_distribution: List[Dict] = field(default_factory=list)


@dataclass
class LayerThreshold:
    """分层临界分数据类"""
    exam_id: int
    layer_code: str
    percentage: float
    threshold_total: float
    threshold_chinese: float
    threshold_math: float
    threshold_english: float
    threshold_science: float
    threshold_society: float
    student_count: int


@dataclass
class GradeRangeAnalysis:
    """全年级范围分析结果"""
    exam_id: int
    exam_name: str
    grade_level: str
    total_students: int
    valid_students: int
    overall_stats: Dict[str, Any]
    layer_comparison: Dict[str, Any]
    subject_analysis: Dict[str, Any]
    score_distribution: List[Dict]


class LayeredAnalysisService:
    """
    分层分析服务类
    
    核心功能:
    1. 全年级范围成绩分析
    2. 分层维度数据统计
    3. 各学科临界分分层计算
    4. 分数段统计分层展示
    5. 分层推送服务
    """
    
    # 学科列名映射
    SUBJECT_COLUMNS = {
        'chinese': 'score_chinese',
        'math': 'score_math',
        'english': 'score_english',
        'science': 'score_science',
        'society': 'score_society'
    }
    
    # 学科显示名称
    SUBJECT_NAMES = {
        'total': '总分',
        'chinese': '语文',
        'math': '数学',
        'english': '英语',
        'science': '科学',
        'society': '社会'
    }
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def _get_layer_scores_df(self, exam_id: int, layer_code: str) -> pd.DataFrame:
        """
        获取指定层次的成绩数据
        
        Args:
            exam_id: 考试ID
            layer_code: 层次代码(ALL/A/B/C)
            
        Returns:
            DataFrame: 成绩数据
        """
        if layer_code == 'ALL':
            # 全年级范围 - 获取所有班级
            sql_query = """
                SELECT 
                    s.id as score_id,
                    s.student_id,
                    s.class_name,
                    s.exam_number,
                    s.score_chinese,
                    s.score_math,
                    s.score_english,
                    s.score_science,
                    s.score_society,
                    s.total_score,
                    s.is_included,
                    st.student_code,
                    st.name as student_name
                FROM biz_scores s
                LEFT JOIN biz_students st ON s.student_id = st.id
                WHERE s.exam_id = :exam_id 
                  AND s.is_included = 1
                ORDER BY s.total_score DESC
            """
            params = {"exam_id": exam_id}
        else:
            # 特定层次 - 通过班级层次关联
            sql_query = """
                SELECT 
                    s.id as score_id,
                    s.student_id,
                    s.class_name,
                    s.exam_number,
                    s.score_chinese,
                    s.score_math,
                    s.score_english,
                    s.score_science,
                    s.score_society,
                    s.total_score,
                    s.is_included,
                    st.student_code,
                    st.name as student_name
                FROM biz_scores s
                JOIN biz_class_layers cl ON s.class_name = cl.class_name
                LEFT JOIN biz_students st ON s.student_id = st.id
                WHERE s.exam_id = :exam_id 
                  AND cl.layer_code = :layer_code
                  AND s.is_included = 1
                ORDER BY s.total_score DESC
            """
            params = {"exam_id": exam_id, "layer_code": layer_code}
        
        df = pd.read_sql(text(sql_query), self.db.bind, params=params)
        logger.info(f"获取分层数据: exam_id={exam_id}, layer_code={layer_code}, 记录数={len(df)}")
        return df
    
    def calculate_layer_statistics(
        self, 
        exam_id: int, 
        layer_code: str,
        subject_name: str = 'total'
    ) -> LayerStatistics:
        """
        计算指定层次指定学科的统计数据
        
        Args:
            exam_id: 考试ID
            layer_code: 层次代码
            subject_name: 学科名称(total/chinese/math/english/science/society)
            
        Returns:
            LayerStatistics: 统计数据
        """
        df = self._get_layer_scores_df(exam_id, layer_code)
        
        if df.empty:
            raise ValueError(f"该层次下暂无有效成绩数据: exam_id={exam_id}, layer_code={layer_code}")
        
        # 确定成绩列
        if subject_name == 'total':
            score_col = 'total_score'
        else:
            score_col = self.SUBJECT_COLUMNS.get(subject_name)
            if not score_col or score_col not in df.columns:
                raise ValueError(f"不支持的学科名称: {subject_name}")
        
        # 过滤有效成绩
        valid_df = df[df[score_col].notna() & (df[score_col] >= 0)]
        scores = valid_df[score_col].astype(float)
        
        if len(scores) == 0:
            raise ValueError(f"该学科暂无有效成绩: {subject_name}")
        
        # 计算基础统计量
        total_students = len(df)
        valid_students = len(scores)
        mean_score = float(scores.mean())
        median_score = float(scores.median())
        std_score = float(scores.std(ddof=0))
        max_score = float(scores.max())
        min_score = float(scores.min())
        
        # 计算四分位数
        sorted_scores = sorted(scores.tolist())
        n = len(sorted_scores)
        q1_score = sorted_scores[n // 4] if n >= 4 else sorted_scores[0] if n > 0 else 0
        q3_score = sorted_scores[3 * n // 4] if n >= 4 else sorted_scores[-1] if n > 0 else 0
        
        # 计算及格率、优秀率(根据学科不同标准)
        if subject_name == 'total':
            pass_threshold = 350
            excellent_threshold = 450
            full_score = 500
        else:
            pass_threshold = 60
            excellent_threshold = 90
            full_score = 100
        
        pass_count = len(scores[scores >= pass_threshold])
        pass_rate = (pass_count / valid_students * 100) if valid_students > 0 else 0
        
        excellent_count = len(scores[scores >= excellent_threshold])
        excellent_rate = (excellent_count / valid_students * 100) if valid_students > 0 else 0
        
        fail_count = valid_students - pass_count
        fail_rate = (fail_count / valid_students * 100) if valid_students > 0 else 0
        
        # 计算分数段分布
        score_distribution = self._calculate_score_distribution(scores, subject_name)
        
        return LayerStatistics(
            exam_id=exam_id,
            layer_code=layer_code,
            subject_name=subject_name,
            total_students=total_students,
            valid_students=valid_students,
            mean_score=round(mean_score, 2),
            median_score=round(median_score, 2),
            std_score=round(std_score, 4),
            max_score=round(max_score, 1),
            min_score=round(min_score, 1),
            q1_score=round(q1_score, 2),
            q3_score=round(q3_score, 2),
            pass_count=pass_count,
            pass_rate=round(pass_rate, 2),
            excellent_count=excellent_count,
            excellent_rate=round(excellent_rate, 2),
            fail_count=fail_count,
            fail_rate=round(fail_rate, 2),
            score_distribution=score_distribution
        )
    
    def _calculate_score_distribution(
        self, 
        scores: pd.Series, 
        subject_name: str,
        interval: int = None
    ) -> List[Dict]:
        """
        计算分数段分布
        
        Args:
            scores: 成绩序列
            subject_name: 学科名称
            interval: 分数段间隔
            
        Returns:
            List[Dict]: 分数段分布数据
        """
        if interval is None:
            interval = 20 if subject_name == 'total' else 5
        
        max_score = scores.max()
        min_score = scores.min()
        
        # 从最高分开始向下分段
        current_max = int((max_score + interval - 1) / interval) * interval
        floor_min = int(min_score / interval) * interval
        
        segments = []
        total_count = len(scores)
        
        while current_max > floor_min:
            segment_min = current_max - interval
            count = len(scores[(scores > segment_min) & (scores <= current_max)])
            percentage = (count / total_count * 100) if total_count > 0 else 0
            
            segments.append({
                'range': f"{segment_min}-{current_max}",
                'min': segment_min,
                'max': current_max,
                'count': count,
                'percentage': round(percentage, 1)
            })
            current_max = segment_min
        
        return segments
    
    def calculate_all_layers_statistics(
        self, 
        exam_id: int,
        subjects: List[str] = None
    ) -> Dict[str, List[LayerStatistics]]:
        """
        计算所有层次所有学科的统计数据
        
        Args:
            exam_id: 考试ID
            subjects: 学科列表，默认全部
            
        Returns:
            Dict: 各层次各学科的统计数据
        """
        if subjects is None:
            subjects = ['total', 'chinese', 'math', 'english', 'science', 'society']
        
        layer_codes = ['ALL', 'A', 'B', 'C']
        results = {}
        
        for layer_code in layer_codes:
            layer_results = []
            for subject in subjects:
                try:
                    stats = self.calculate_layer_statistics(exam_id, layer_code, subject)
                    layer_results.append(stats)
                except ValueError as e:
                    logger.warning(f"计算统计失败: layer={layer_code}, subject={subject}, error={e}")
                    continue
            
            if layer_results:
                results[layer_code] = layer_results
        
        return results
    
    def calculate_layer_thresholds(
        self, 
        exam_id: int, 
        layer_code: str,
        percentages: List[float] = None
    ) -> List[LayerThreshold]:
        """
        计算指定层次的各学科临界分
        
        Args:
            exam_id: 考试ID
            layer_code: 层次代码
            percentages: 百分比列表，默认[0.20, 0.40, 0.60, 0.80]
            
        Returns:
            List[LayerThreshold]: 临界分列表
        """
        if percentages is None:
            percentages = [0.20, 0.40, 0.60, 0.80]
        
        df = self._get_layer_scores_df(exam_id, layer_code)
        
        if df.empty:
            raise ValueError(f"该层次下暂无有效成绩数据: exam_id={exam_id}, layer_code={layer_code}")
        
        total_students = len(df)
        df_sorted = df.sort_values(by='total_score', ascending=False).reset_index(drop=True)
        
        results = []
        
        for pct in percentages:
            # 确定切分位置
            cutoff_index = max(1, int(total_students * pct)) - 1
            threshold_total = float(df_sorted.loc[cutoff_index, 'total_score'])
            
            # 获取前N%的学生群体
            top_df = df_sorted[df_sorted['total_score'] >= threshold_total]
            
            # 计算该群体在各单科的最低分(临界分)
            def get_subject_threshold(col_name: str) -> float:
                if col_name in top_df.columns and not top_df[col_name].isna().all():
                    return float(top_df[col_name].min())
                return 0.0
            
            threshold = LayerThreshold(
                exam_id=exam_id,
                layer_code=layer_code,
                percentage=pct,
                threshold_total=round(threshold_total, 1),
                threshold_chinese=round(get_subject_threshold('score_chinese'), 1),
                threshold_math=round(get_subject_threshold('score_math'), 1),
                threshold_english=round(get_subject_threshold('score_english'), 1),
                threshold_science=round(get_subject_threshold('score_science'), 1),
                threshold_society=round(get_subject_threshold('score_society'), 1),
                student_count=len(top_df)
            )
            
            results.append(threshold)
            
            logger.info(
                f"临界分计算: layer={layer_code}, 前{int(pct*100)}% | "
                f"总分临界分={threshold.threshold_total} | 人数={threshold.student_count}"
            )
        
        return results
    
    def perform_grade_range_analysis(self, exam_id: int) -> GradeRangeAnalysis:
        """
        执行全年级范围的综合分析
        
        Args:
            exam_id: 考试ID
            
        Returns:
            GradeRangeAnalysis: 全年级分析结果
        """
        # 获取考试信息
        exam_info = self.db.execute(
            text("SELECT exam_name, grade_level FROM biz_exams WHERE id = :exam_id"),
            {"exam_id": exam_id}
        ).fetchone()
        
        if not exam_info:
            raise ValueError(f"考试不存在: exam_id={exam_id}")
        
        # 计算全年级统计
        all_layer_stats = self.calculate_layer_statistics(exam_id, 'ALL', 'total')
        
        # 计算各层次对比
        layer_comparison = {}
        for layer_code in ['A', 'B', 'C']:
            try:
                layer_stats = self.calculate_layer_statistics(exam_id, layer_code, 'total')
                layer_comparison[layer_code] = {
                    'layer_name': f"{layer_code}层",
                    'student_count': layer_stats.valid_students,
                    'mean_score': layer_stats.mean_score,
                    'pass_rate': layer_stats.pass_rate,
                    'excellent_rate': layer_stats.excellent_rate,
                    'std_score': layer_stats.std_score
                }
            except ValueError:
                continue
        
        # 计算各学科统计
        subject_analysis = {}
        for subject_code, subject_col in self.SUBJECT_COLUMNS.items():
            try:
                subject_stats = self.calculate_layer_statistics(exam_id, 'ALL', subject_code)
                subject_analysis[subject_code] = {
                    'subject_name': self.SUBJECT_NAMES.get(subject_code, subject_code),
                    'mean_score': subject_stats.mean_score,
                    'pass_rate': subject_stats.pass_rate,
                    'excellent_rate': subject_stats.excellent_rate,
                    'std_score': subject_stats.std_score
                }
            except ValueError:
                continue
        
        return GradeRangeAnalysis(
            exam_id=exam_id,
            exam_name=exam_info.exam_name,
            grade_level=exam_info.grade_level,
            total_students=all_layer_stats.total_students,
            valid_students=all_layer_stats.valid_students,
            overall_stats={
                'mean_score': all_layer_stats.mean_score,
                'median_score': all_layer_stats.median_score,
                'std_score': all_layer_stats.std_score,
                'max_score': all_layer_stats.max_score,
                'min_score': all_layer_stats.min_score,
                'pass_rate': all_layer_stats.pass_rate,
                'excellent_rate': all_layer_stats.excellent_rate
            },
            layer_comparison=layer_comparison,
            subject_analysis=subject_analysis,
            score_distribution=all_layer_stats.score_distribution
        )
    
    def save_layer_statistics(self, stats: LayerStatistics) -> bool:
        """
        保存分层统计数据到数据库
        
        Args:
            stats: 统计数据
            
        Returns:
            bool: 保存是否成功
        """
        try:
            if is_postgresql(self.db) or is_sqlite(self.db):
                sql = """
                    INSERT INTO biz_layered_statistics
                    (exam_id, layer_code, subject_name, total_students, valid_students,
                     mean_score, median_score, std_score, max_score, min_score,
                     q1_score, q3_score, pass_count, pass_rate, excellent_count, excellent_rate,
                     fail_count, fail_rate, score_distribution, calculated_at)
                    VALUES
                    (:exam_id, :layer_code, :subject_name, :total_students, :valid_students,
                     :mean_score, :median_score, :std_score, :max_score, :min_score,
                     :q1_score, :q3_score, :pass_count, :pass_rate, :excellent_count, :excellent_rate,
                     :fail_count, :fail_rate, :score_distribution, CURRENT_TIMESTAMP)
                    ON CONFLICT (exam_id, layer_code, subject_name) DO UPDATE SET
                    total_students = excluded.total_students,
                    valid_students = excluded.valid_students,
                    mean_score = excluded.mean_score,
                    median_score = excluded.median_score,
                    std_score = excluded.std_score,
                    max_score = excluded.max_score,
                    min_score = excluded.min_score,
                    q1_score = excluded.q1_score,
                    q3_score = excluded.q3_score,
                    pass_count = excluded.pass_count,
                    pass_rate = excluded.pass_rate,
                    excellent_count = excluded.excellent_count,
                    excellent_rate = excluded.excellent_rate,
                    fail_count = excluded.fail_count,
                    fail_rate = excluded.fail_rate,
                    score_distribution = excluded.score_distribution,
                    calculated_at = CURRENT_TIMESTAMP
                """
            else:
                sql = """
                    INSERT INTO biz_layered_statistics
                    (exam_id, layer_code, subject_name, total_students, valid_students,
                     mean_score, median_score, std_score, max_score, min_score,
                     q1_score, q3_score, pass_count, pass_rate, excellent_count, excellent_rate,
                     fail_count, fail_rate, score_distribution, calculated_at)
                    VALUES
                    (:exam_id, :layer_code, :subject_name, :total_students, :valid_students,
                     :mean_score, :median_score, :std_score, :max_score, :min_score,
                     :q1_score, :q3_score, :pass_count, :pass_rate, :excellent_count, :excellent_rate,
                     :fail_count, :fail_rate, :score_distribution, NOW())
                    ON DUPLICATE KEY UPDATE
                    total_students = VALUES(total_students),
                    valid_students = VALUES(valid_students),
                    mean_score = VALUES(mean_score),
                    median_score = VALUES(median_score),
                    std_score = VALUES(std_score),
                    max_score = VALUES(max_score),
                    min_score = VALUES(min_score),
                    q1_score = VALUES(q1_score),
                    q3_score = VALUES(q3_score),
                    pass_count = VALUES(pass_count),
                    pass_rate = VALUES(pass_rate),
                    excellent_count = VALUES(excellent_count),
                    excellent_rate = VALUES(excellent_rate),
                    fail_count = VALUES(fail_count),
                    fail_rate = VALUES(fail_rate),
                    score_distribution = VALUES(score_distribution),
                    calculated_at = VALUES(calculated_at)
                """
            
            self.db.execute(
                text(sql),
                {
                    "exam_id": stats.exam_id,
                    "layer_code": stats.layer_code,
                    "subject_name": stats.subject_name,
                    "total_students": stats.total_students,
                    "valid_students": stats.valid_students,
                    "mean_score": stats.mean_score,
                    "median_score": stats.median_score,
                    "std_score": stats.std_score,
                    "max_score": stats.max_score,
                    "min_score": stats.min_score,
                    "q1_score": stats.q1_score,
                    "q3_score": stats.q3_score,
                    "pass_count": stats.pass_count,
                    "pass_rate": stats.pass_rate,
                    "excellent_count": stats.excellent_count,
                    "excellent_rate": stats.excellent_rate,
                    "fail_count": stats.fail_count,
                    "fail_rate": stats.fail_rate,
                    "score_distribution": json.dumps(stats.score_distribution)
                }
            )
            self.db.commit()
            
            logger.info(f"分层统计已保存: exam_id={stats.exam_id}, layer={stats.layer_code}, subject={stats.subject_name}")
            return True
            
        except Exception as e:
            logger.error(f"保存分层统计失败: {e}")
            self.db.rollback()
            return False
    
    def save_layer_thresholds(self, thresholds: List[LayerThreshold]) -> bool:
        """
        保存分层临界分到数据库
        
        Args:
            thresholds: 临界分列表
            
        Returns:
            bool: 保存是否成功
        """
        try:
            if is_postgresql(self.db) or is_sqlite(self.db):
                sql = """
                    INSERT INTO biz_layered_thresholds
                    (exam_id, layer_code, percentage, threshold_total,
                     threshold_chinese, threshold_math, threshold_english, threshold_science, threshold_society,
                     student_count, calculated_at)
                    VALUES
                    (:exam_id, :layer_code, :percentage, :threshold_total,
                     :threshold_chinese, :threshold_math, :threshold_english, :threshold_science, :threshold_society,
                     :student_count, CURRENT_TIMESTAMP)
                    ON CONFLICT (exam_id, layer_code, percentage) DO UPDATE SET
                    threshold_total = excluded.threshold_total,
                    threshold_chinese = excluded.threshold_chinese,
                    threshold_math = excluded.threshold_math,
                    threshold_english = excluded.threshold_english,
                    threshold_science = excluded.threshold_science,
                    threshold_society = excluded.threshold_society,
                    student_count = excluded.student_count,
                    calculated_at = CURRENT_TIMESTAMP
                """
            else:
                sql = """
                    INSERT INTO biz_layered_thresholds
                    (exam_id, layer_code, percentage, threshold_total,
                     threshold_chinese, threshold_math, threshold_english, threshold_science, threshold_society,
                     student_count, calculated_at)
                    VALUES
                    (:exam_id, :layer_code, :percentage, :threshold_total,
                     :threshold_chinese, :threshold_math, :threshold_english, :threshold_science, :threshold_society,
                     :student_count, NOW())
                    ON DUPLICATE KEY UPDATE
                    threshold_total = VALUES(threshold_total),
                    threshold_chinese = VALUES(threshold_chinese),
                    threshold_math = VALUES(threshold_math),
                    threshold_english = VALUES(threshold_english),
                    threshold_science = VALUES(threshold_science),
                    threshold_society = VALUES(threshold_society),
                    student_count = VALUES(student_count),
                    calculated_at = VALUES(calculated_at)
                """
            
            for threshold in thresholds:
                self.db.execute(
                    text(sql),
                    {
                        "exam_id": threshold.exam_id,
                        "layer_code": threshold.layer_code,
                        "percentage": threshold.percentage,
                        "threshold_total": threshold.threshold_total,
                        "threshold_chinese": threshold.threshold_chinese,
                        "threshold_math": threshold.threshold_math,
                        "threshold_english": threshold.threshold_english,
                        "threshold_science": threshold.threshold_science,
                        "threshold_society": threshold.threshold_society,
                        "student_count": threshold.student_count
                    }
                )
            
            self.db.commit()
            logger.info(f"分层临界分已保存: {len(thresholds)}条记录")
            return True
            
        except Exception as e:
            logger.error(f"保存分层临界分失败: {e}")
            self.db.rollback()
            return False
    
    def get_layer_statistics_from_db(
        self, 
        exam_id: int, 
        layer_code: str = None,
        subject_name: str = None
    ) -> List[Dict]:
        """
        从数据库获取分层统计数据
        
        Args:
            exam_id: 考试ID
            layer_code: 层次代码，为None则返回所有层次
            subject_name: 学科名称，为None则返回所有学科
            
        Returns:
            List[Dict]: 统计数据列表
        """
        sql = """
            SELECT * FROM biz_layered_statistics 
            WHERE exam_id = :exam_id
        """
        params = {"exam_id": exam_id}
        
        if layer_code:
            sql += " AND layer_code = :layer_code"
            params["layer_code"] = layer_code
        
        if subject_name:
            sql += " AND subject_name = :subject_name"
            params["subject_name"] = subject_name
        
        sql += " ORDER BY layer_code, subject_name"
        
        result = self.db.execute(text(sql), params).fetchall()
        
        stats_list = []
        for row in result:
            stats_dict = dict(row._mapping)
            if stats_dict.get('score_distribution'):
                stats_dict['score_distribution'] = json.loads(stats_dict['score_distribution'])
            stats_list.append(stats_dict)
        
        return stats_list
    
    def log_layered_analysis_action(
        self,
        action_type: str,
        action_by: int,
        action_by_name: str,
        action_by_role: str,
        exam_id: int = None,
        layer_code: str = None,
        action_detail: Dict = None,
        ip_address: str = None
    ) -> bool:
        """
        记录分层分析操作日志
        
        Args:
            action_type: 操作类型
            action_by: 操作人ID
            action_by_name: 操作人姓名
            action_by_role: 操作人角色
            exam_id: 考试ID
            layer_code: 层次代码
            action_detail: 操作详情
            ip_address: IP地址
            
        Returns:
            bool: 记录是否成功
        """
        try:
            sql = """
                INSERT INTO biz_layered_analysis_logs 
                (exam_id, layer_code, action_type, action_by, action_by_name, action_by_role,
                 action_detail, ip_address, created_at)
                VALUES 
                (:exam_id, :layer_code, :action_type, :action_by, :action_by_name, :action_by_role,
                 :action_detail, :ip_address, NOW())
            """
            
            self.db.execute(
                text(sql),
                {
                    "exam_id": exam_id,
                    "layer_code": layer_code,
                    "action_type": action_type,
                    "action_by": action_by,
                    "action_by_name": action_by_name,
                    "action_by_role": action_by_role,
                    "action_detail": json.dumps(action_detail) if action_detail else None,
                    "ip_address": ip_address
                }
            )
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"记录操作日志失败: {e}")
            self.db.rollback()
            return False


class LayeredPushService:
    """
    分层推送服务类
    
    核心功能:
    1. 教师/班主任分层成绩推送
    2. 家长端分层成绩推送
    3. 推送权限控制
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.analysis_service = LayeredAnalysisService(db_session)
    
    def get_teachers_by_layer(
        self, 
        layer_code: str,
        class_name: str = None,
        role: str = None
    ) -> List[Dict]:
        """
        获取指定层次的教师列表
        
        Args:
            layer_code: 层次代码
            class_name: 班级名称，为None则返回该层次所有班级的教师
            role: 角色筛选(teacher/headmaster)
            
        Returns:
            List[Dict]: 教师列表
        """
        sql = """
            SELECT DISTINCT
                u.id as user_id,
                u.real_name,
                u.username,
                r.role_name,
                r.permission_code,
                tcr.class_name,
                tcr.subject_name,
                tcr.is_headmaster,
                cl.layer_code
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            JOIN biz_teacher_class_rel tcr ON u.id = tcr.teacher_id
            JOIN biz_class_layers cl ON tcr.class_name = cl.class_name
            WHERE cl.layer_code = :layer_code
              AND u.is_active = 1
        """
        params = {"layer_code": layer_code}
        
        if class_name:
            sql += " AND tcr.class_name = :class_name"
            params["class_name"] = class_name
        
        if role == 'headmaster':
            sql += " AND tcr.is_headmaster = 1"
        elif role == 'teacher':
            sql += " AND tcr.is_headmaster = 0"
        
        result = self.db.execute(text(sql), params).fetchall()
        
        teachers = []
        for row in result:
            teachers.append({
                'user_id': row.user_id,
                'real_name': row.real_name,
                'username': row.username,
                'role_name': row.role_name,
                'permission_code': row.permission_code,
                'class_name': row.class_name,
                'subject_name': row.subject_name,
                'is_headmaster': row.is_headmaster,
                'layer_code': row.layer_code
            })
        
        return teachers
    
    def get_parents_by_layer(
        self, 
        layer_code: str,
        class_name: str = None
    ) -> List[Dict]:
        """
        获取指定层次的家长列表
        
        Args:
            layer_code: 层次代码
            class_name: 班级名称，为None则返回该层次所有班级的家长
            
        Returns:
            List[Dict]: 家长列表
        """
        sql = """
            SELECT DISTINCT
                u.id as user_id,
                u.real_name,
                u.username,
                r.role_name,
                psl.student_id,
                psl.class_name,
                psl.layer_code,
                st.name as student_name,
                st.student_code
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            JOIN biz_parent_student_layer psl ON u.id = psl.parent_user_id
            JOIN biz_students st ON psl.student_id = st.id
            WHERE psl.layer_code = :layer_code
              AND psl.is_active = 1
              AND u.is_active = 1
        """
        params = {"layer_code": layer_code}
        
        if class_name:
            sql += " AND psl.class_name = :class_name"
            params["class_name"] = class_name
        
        result = self.db.execute(text(sql), params).fetchall()
        
        parents = []
        for row in result:
            parents.append({
                'user_id': row.user_id,
                'real_name': row.real_name,
                'username': row.username,
                'role_name': row.role_name,
                'student_id': row.student_id,
                'student_name': row.student_name,
                'student_code': row.student_code,
                'class_name': row.class_name,
                'layer_code': row.layer_code
            })
        
        return parents
    
    def check_push_permission(
        self, 
        user_id: int, 
        layer_code: str,
        permission_type: str = 'push'
    ) -> bool:
        """
        检查用户的分层推送权限
        
        Args:
            user_id: 用户ID
            layer_code: 层次代码
            permission_type: 权限类型(view/push/admin)
            
        Returns:
            bool: 是否有权限
        """
        # 检查用户是否有该层次的推送权限
        sql = """
            SELECT 1 FROM biz_user_layer_permissions
            WHERE user_id = :user_id 
              AND layer_code = :layer_code
              AND permission_type = :permission_type
            LIMIT 1
        """
        result = self.db.execute(
            text(sql), 
            {"user_id": user_id, "layer_code": layer_code, "permission_type": permission_type}
        ).fetchone()
        
        if result:
            return True
        
        # 检查用户是否为系统管理员或教务主任
        sql_admin = """
            SELECT r.permission_code 
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            WHERE u.id = :user_id
        """
        admin_result = self.db.execute(text(sql_admin), {"user_id": user_id}).fetchone()
        
        if admin_result and admin_result.permission_code in ['sys_admin', 'edu_admin']:
            return True
        
        return False
    
    def create_layered_notification(
        self,
        exam_id: int,
        layer_code: str,
        title: str,
        content: str,
        notification_type: str,
        target_role: str,
        created_by: int
    ) -> Optional[str]:
        """
        创建分层推送通知
        
        Args:
            exam_id: 考试ID
            layer_code: 目标层次代码
            title: 推送标题
            content: 推送内容
            notification_type: 推送类型(teacher/parent)
            target_role: 目标角色
            created_by: 创建人ID
            
        Returns:
            Optional[str]: 推送批次ID，失败返回None
        """
        try:
            # 生成推送ID
            notification_id = f"LYR_{datetime.now().strftime('%Y%m%d%H%M%S')}_{exam_id}_{layer_code}"
            
            # 获取目标用户列表
            if notification_type == 'teacher':
                target_users = self.get_teachers_by_layer(layer_code, role=target_role)
            elif notification_type == 'parent':
                target_users = self.get_parents_by_layer(layer_code)
            else:
                target_users = []
            
            if not target_users:
                logger.warning(f"没有目标用户: layer={layer_code}, type={notification_type}")
                return None
            
            # 保存推送记录
            sql = """
                INSERT INTO biz_layered_notifications 
                (notification_id, exam_id, layer_code, title, content, notification_type,
                 target_role, target_users, sent_count, status, created_by, created_at)
                VALUES 
                (:notification_id, :exam_id, :layer_code, :title, :content, :notification_type,
                 :target_role, :target_users, :sent_count, 'pending', :created_by, NOW())
            """
            
            self.db.execute(
                text(sql),
                {
                    "notification_id": notification_id,
                    "exam_id": exam_id,
                    "layer_code": layer_code,
                    "title": title,
                    "content": content,
                    "notification_type": notification_type,
                    "target_role": target_role,
                    "target_users": json.dumps([u['user_id'] for u in target_users]),
                    "sent_count": len(target_users),
                    "created_by": created_by
                }
            )
            
            # 保存接收明细
            sql_recipient = """
                INSERT INTO biz_layered_notification_recipients 
                (notification_id, user_id, user_role, user_name, layer_code, class_name, created_at)
                VALUES 
                (:notification_id, :user_id, :user_role, :user_name, :layer_code, :class_name, NOW())
            """
            
            for user in target_users:
                self.db.execute(
                    text(sql_recipient),
                    {
                        "notification_id": notification_id,
                        "user_id": user['user_id'],
                        "user_role": user.get('role_name', ''),
                        "user_name": user.get('real_name', ''),
                        "layer_code": layer_code,
                        "class_name": user.get('class_name', '')
                    }
                )
            
            self.db.commit()
            
            logger.info(f"分层推送已创建: notification_id={notification_id}, 目标用户数={len(target_users)}")
            return notification_id
            
        except Exception as e:
            logger.error(f"创建分层推送失败: {e}")
            self.db.rollback()
            return None
    
    def send_notification(self, notification_id: str) -> bool:
        """
        发送分层推送通知
        
        Args:
            notification_id: 推送批次ID
            
        Returns:
            bool: 发送是否成功
        """
        try:
            # 更新推送状态为已发送
            sql = """
                UPDATE biz_layered_notifications 
                SET status = 'sent', sent_at = NOW()
                WHERE notification_id = :notification_id
            """
            self.db.execute(text(sql), {"notification_id": notification_id})
            self.db.commit()
            
            logger.info(f"分层推送已发送: notification_id={notification_id}")
            return True
            
        except Exception as e:
            logger.error(f"发送分层推送失败: {e}")
            self.db.rollback()
            return False
