"""
新纪元教务大数据平台 - 核心算法引擎
班级Z值计算模型 + 分层对比机制 + 有效分反算

核心公式:
Z_class = (Score_standard × 50%) + (Top20%_count/Total_count × 20%) + (Top80%_count/Total_count × 30%)
"""

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ZValueResult:
    """班级Z值计算结果数据类"""
    class_name: str
    class_mean: float
    layer_mean: float
    layer_std: float
    standard_score: float
    top20_ratio: float
    top80_ratio: float
    final_z_value: float
    class_count: int
    top20_count: int
    top80_count: int


@dataclass
class LayerStats:
    """分层统计数据类"""
    layer_id: int
    layer_name: str
    total_students: int
    mean_score: float
    std_score: float
    max_score: float
    min_score: float
    median_score: float
    threshold_20: float
    threshold_40: float
    threshold_60: float
    threshold_80: float


@dataclass
class SubjectThreshold:
    """学科有效分/下限分数据类"""
    percentage: float
    threshold_total: float
    threshold_chinese: float
    threshold_math: float
    threshold_english: float
    threshold_science: float
    threshold_society: float
    student_count: int


class ScoreAnalysisService:
    """
    成绩分析服务类
    
    核心功能:
    1. 班级Z值计算 (50-20-30加权模型)
    2. 分层统计数据获取
    3. 学科有效分/下限分反算
    4. 班级历史趋势分析
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def _get_layer_valid_scores_df(self, exam_id: int, layer_id: int) -> pd.DataFrame:
        """
        获取指定分层下的有效成绩数据
        
        关键约束:
        - 只查询 is_included = 1 的数据(参与统计的学生)
        - 通过 biz_class_layer_details 表进行分层隔离
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            DataFrame: 包含学生成绩数据的pandas数据框
        """
        sql_query = """
            SELECT 
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
            JOIN biz_class_layer_details d ON s.class_name = d.class_name
            LEFT JOIN biz_students st ON s.student_id = st.id
            WHERE s.exam_id = :exam_id 
              AND d.layer_id = :layer_id 
              AND s.is_included = 1
            ORDER BY s.total_score DESC
        """
        
        df = pd.read_sql(
            text(sql_query), 
            self.db.bind, 
            params={"exam_id": exam_id, "layer_id": layer_id}
        )
        
        logger.info(f"获取分层数据: exam_id={exam_id}, layer_id={layer_id}, 记录数={len(df)}")
        return df
    
    def calculate_layer_statistics(self, exam_id: int, layer_id: int) -> LayerStats:
        """
        计算指定分层的整体统计数据
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            LayerStats: 分层统计数据
        """
        df = self._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            raise ValueError(f"该分层下暂无有效成绩数据: exam_id={exam_id}, layer_id={layer_id}")
        
        total_students = len(df)
        mean_score = float(df['total_score'].mean())
        std_score = float(df['total_score'].std(ddof=0))
        max_score = float(df['total_score'].max())
        min_score = float(df['total_score'].min())
        median_score = float(df['total_score'].median())
        
        # 计算各分数段阈值 (20%, 40%, 60%, 80%)
        df_sorted = df.sort_values(by='total_score', ascending=False).reset_index(drop=True)
        
        def get_threshold(percentage: float) -> float:
            idx = max(1, int(total_students * percentage)) - 1
            return float(df_sorted.loc[idx, 'total_score'])
        
        threshold_20 = get_threshold(0.20)
        threshold_40 = get_threshold(0.40)
        threshold_60 = get_threshold(0.60)
        threshold_80 = get_threshold(0.80)
        
        # 获取分层名称
        layer_name = self.db.execute(
            text("SELECT layer_name FROM biz_class_layers WHERE id = :layer_id"),
            {"layer_id": layer_id}
        ).scalar() or "未知分层"
        
        return LayerStats(
            layer_id=layer_id,
            layer_name=layer_name,
            total_students=total_students,
            mean_score=round(mean_score, 2),
            std_score=round(std_score, 4),
            max_score=round(max_score, 1),
            min_score=round(min_score, 1),
            median_score=round(median_score, 2),
            threshold_20=round(threshold_20, 1),
            threshold_40=round(threshold_40, 1),
            threshold_60=round(threshold_60, 1),
            threshold_80=round(threshold_80, 1)
        )
    
    def calculate_class_z_value(
        self, 
        exam_id: int, 
        layer_id: int, 
        target_class: str
    ) -> ZValueResult:
        """
        计算指定班级在指定分层下的Z值
        
        核心算法:
        Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)
        
        其中:
        - Score_standard = (Class_mean - Layer_mean) / Layer_std
        - Top20%_ratio = 班级进入分层前20%的人数 / 班级总人数
        - Top80%_ratio = 班级进入分层前80%的人数 / 班级总人数
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            target_class: 目标班级名称(如 "701")
            
        Returns:
            ZValueResult: Z值计算结果
        """
        # 1. 获取分层所有有效成绩数据
        df = self._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            raise ValueError(f"该分层下暂无有效成绩数据: exam_id={exam_id}, layer_id={layer_id}")
        
        # 2. 计算分层整体统计量
        layer_mean = df['total_score'].mean()
        layer_std = df['total_score'].std(ddof=0)
        total_students = len(df)
        
        # 3. 计算分层前20%和前80%的分数线
        df_sorted = df.sort_values(by='total_score', ascending=False).reset_index(drop=True)
        
        idx_20 = max(1, int(total_students * 0.20)) - 1
        idx_80 = max(1, int(total_students * 0.80)) - 1
        
        threshold_20 = df_sorted.loc[idx_20, 'total_score']
        threshold_80 = df_sorted.loc[idx_80, 'total_score']
        
        # 4. 提取目标班级数据
        class_df = df[df['class_name'] == target_class]
        class_total_count = len(class_df)
        
        if class_total_count == 0:
            raise ValueError(f"该班级无有效成绩: {target_class}")
        
        # 5. 计算班级平均分
        class_mean = class_df['total_score'].mean()
        
        # 6. 计算统计学标准分 (Z-score)
        # Score_standard = (Class_mean - Layer_mean) / Layer_std
        standard_score = (class_mean - layer_mean) / layer_std if layer_std > 0 else 0.0
        
        # 7. 计算前20%和前80%的贡献率
        class_top20_count = len(class_df[class_df['total_score'] >= threshold_20])
        class_top80_count = len(class_df[class_df['total_score'] >= threshold_80])
        
        ratio_top20 = class_top20_count / class_total_count
        ratio_top80 = class_top80_count / class_total_count
        
        # 8. 应用新纪元学校专项加权公式 (50-20-30)
        # Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)
        final_z_value = (standard_score * 0.50) + (ratio_top20 * 0.20) + (ratio_top80 * 0.30)
        
        logger.info(
            f"班级Z值计算: {target_class} | "
            f"标准分={standard_score:.4f} | "
            f"前20%率={ratio_top20:.4f} | "
            f"前80%率={ratio_top80:.4f} | "
            f"Z值={final_z_value:.4f}"
        )
        
        return ZValueResult(
            class_name=target_class,
            class_mean=round(float(class_mean), 2),
            layer_mean=round(float(layer_mean), 2),
            layer_std=round(float(layer_std), 4),
            standard_score=round(float(standard_score), 4),
            top20_ratio=round(float(ratio_top20), 4),
            top80_ratio=round(float(ratio_top80), 4),
            final_z_value=round(float(final_z_value), 4),
            class_count=class_total_count,
            top20_count=class_top20_count,
            top80_count=class_top80_count
        )
    
    def calculate_all_classes_z_values(
        self, 
        exam_id: int, 
        layer_id: int
    ) -> List[ZValueResult]:
        """
        计算指定分层下所有班级的Z值并排序
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            List[ZValueResult]: 按Z值降序排列的班级列表
        """
        # 获取分层内所有班级
        df = self._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            return []
        
        classes = df['class_name'].unique()
        results = []
        
        for class_name in classes:
            try:
                result = self.calculate_class_z_value(exam_id, layer_id, class_name)
                results.append(result)
            except ValueError as e:
                logger.warning(f"计算班级Z值失败: {class_name}, 错误: {e}")
                continue
        
        # 按Z值降序排序
        results.sort(key=lambda x: x.final_z_value, reverse=True)
        
        return results
    
    def calculate_subject_thresholds(
        self, 
        exam_id: int, 
        layer_id: int,
        percentages: List[float] = [0.20, 0.40, 0.60, 0.80]
    ) -> List[SubjectThreshold]:
        """
        计算各学科的有效分/下限分
        
        基于总分划定的前N%人群，反向计算该人群在各单科的最低下限分
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            percentages: 百分比列表，默认[0.20, 0.40, 0.60, 0.80]
            
        Returns:
            List[SubjectThreshold]: 各百分比的学科下限分
        """
        df = self._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            raise ValueError("该分层下暂无有效成绩数据")
        
        total_students = len(df)
        df_sorted = df.sort_values(by='total_score', ascending=False).reset_index(drop=True)
        
        results = []
        
        for pct in percentages:
            # 确定切分位置
            cutoff_index = max(1, int(total_students * pct)) - 1
            threshold_total = float(df_sorted.loc[cutoff_index, 'total_score'])
            
            # 获取前N%的学生群体
            top_df = df_sorted[df_sorted['total_score'] >= threshold_total]
            
            # 计算该群体在各单科的最低分(下限分)
            def get_subject_threshold(col_name: str) -> float:
                if col_name in top_df.columns and not top_df[col_name].isna().all():
                    return float(top_df[col_name].min())
                return 0.0
            
            threshold = SubjectThreshold(
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
                f"有效分计算: 前{int(pct*100)}% | "
                f"总分下限={threshold.threshold_total} | "
                f"人数={threshold.student_count}"
            )
        
        return results
    
    def get_class_subject_means(
        self, 
        exam_id: int, 
        layer_id: int,
        target_class: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取班级各学科平均分
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            target_class: 目标班级，为None则返回分层内所有班级
            
        Returns:
            Dict: 包含各学科平均分的字典
        """
        df = self._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            raise ValueError("该分层下暂无有效成绩数据")
        
        # 计算分层整体各学科平均分
        layer_means = {}
        for subject in ['score_chinese', 'score_math', 'score_english', 'score_science', 'score_society']:
            if subject in df.columns:
                layer_means[subject] = round(float(df[subject].mean()), 2)
        
        # 计算分层整体总分平均
        layer_total_mean = round(float(df['total_score'].mean()), 2)
        
        result = {
            "exam_id": exam_id,
            "layer_id": layer_id,
            "layer_total_mean": layer_total_mean,
            "layer_subject_means": layer_means,
            "classes": []
        }
        
        # 确定要计算的班级列表
        if target_class:
            classes = [target_class]
        else:
            classes = df['class_name'].unique().tolist()
        
        # 计算各班级平均分
        for class_name in classes:
            class_df = df[df['class_name'] == class_name]
            
            if len(class_df) == 0:
                continue
            
            class_data = {
                "class_name": class_name,
                "student_count": len(class_df),
                "total_mean": round(float(class_df['total_score'].mean()), 2),
                "subjects": {}
            }
            
            # 各学科平均分及与分层平均的差值
            for subject in ['score_chinese', 'score_math', 'score_english', 'score_science', 'score_society']:
                if subject in class_df.columns:
                    subject_mean = class_df[subject].mean()
                    layer_mean = layer_means.get(subject, 0)
                    diff = subject_mean - layer_mean if subject_mean and layer_mean else 0
                    
                    class_data["subjects"][subject] = {
                        "mean": round(float(subject_mean), 2) if not pd.isna(subject_mean) else None,
                        "layer_mean": layer_mean,
                        "diff": round(float(diff), 2) if not pd.isna(diff) else None
                    }
            
            result["classes"].append(class_data)
        
        # 按总分平均分降序排序
        result["classes"].sort(key=lambda x: x["total_mean"], reverse=True)
        
        return result
    
    def get_class_historical_trends(
        self,
        class_name: str,
        term: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        获取班级历史成绩趋势
        
        Args:
            class_name: 班级名称
            term: 当前学期
            limit: 返回最近几次考试的数据
            
        Returns:
            List[Dict]: 历史趋势数据列表
        """
        sql_query = """
            SELECT 
                e.id as exam_id,
                e.exam_name,
                e.exam_date,
                z.final_z_value,
                z.class_mean,
                z.layer_mean,
                z.top20_ratio,
                z.top80_ratio
            FROM biz_class_z_values z
            JOIN biz_exams e ON z.exam_id = e.id
            WHERE z.class_name = :class_name
              AND e.term <= :term
            ORDER BY e.exam_date DESC
            LIMIT :limit
        """
        
        result = self.db.execute(
            text(sql_query),
            {"class_name": class_name, "term": term, "limit": limit}
        ).fetchall()
        
        trends = []
        for row in result:
            trends.append({
                "exam_id": row.exam_id,
                "exam_name": row.exam_name,
                "exam_date": row.exam_date.isoformat() if row.exam_date else None,
                "z_value": float(row.final_z_value) if row.final_z_value else None,
                "class_mean": float(row.class_mean) if row.class_mean else None,
                "layer_mean": float(row.layer_mean) if row.layer_mean else None,
                "mean_diff": round(float(row.class_mean - row.layer_mean), 2) if row.class_mean and row.layer_mean else None,
                "top20_ratio": float(row.top20_ratio) if row.top20_ratio else None,
                "top80_ratio": float(row.top80_ratio) if row.top80_ratio else None
            })
        
        return trends
    
    def save_z_value_calculation(self, result: ZValueResult, exam_id: int, layer_id: int) -> bool:
        """
        将Z值计算结果保存到缓存表
        
        Args:
            result: Z值计算结果
            exam_id: 考试ID
            layer_id: 分层ID
            
        Returns:
            bool: 保存是否成功
        """
        try:
            sql = """
                INSERT INTO biz_class_z_values 
                (exam_id, layer_id, class_name, class_mean, layer_mean, layer_std,
                 standard_score, top20_ratio, top80_ratio, final_z_value, class_count, calculated_at)
                VALUES 
                (:exam_id, :layer_id, :class_name, :class_mean, :layer_mean, :layer_std,
                 :standard_score, :top20_ratio, :top80_ratio, :final_z_value, :class_count, NOW())
                ON DUPLICATE KEY UPDATE
                class_mean = VALUES(class_mean),
                layer_mean = VALUES(layer_mean),
                layer_std = VALUES(layer_std),
                standard_score = VALUES(standard_score),
                top20_ratio = VALUES(top20_ratio),
                top80_ratio = VALUES(top80_ratio),
                final_z_value = VALUES(final_z_value),
                class_count = VALUES(class_count),
                calculated_at = VALUES(calculated_at)
            """
            
            self.db.execute(
                text(sql),
                {
                    "exam_id": exam_id,
                    "layer_id": layer_id,
                    "class_name": result.class_name,
                    "class_mean": result.class_mean,
                    "layer_mean": result.layer_mean,
                    "layer_std": result.layer_std,
                    "standard_score": result.standard_score,
                    "top20_ratio": result.top20_ratio,
                    "top80_ratio": result.top80_ratio,
                    "final_z_value": result.final_z_value,
                    "class_count": result.class_count
                }
            )
            self.db.commit()
            
            logger.info(f"Z值计算结果已保存: {result.class_name}, Z={result.final_z_value}")
            return True
            
        except Exception as e:
            logger.error(f"保存Z值计算结果失败: {e}")
            self.db.rollback()
            return False


class WeakSubjectTracker:
    """
    薄弱学科靶向追踪器
    
    用于追踪特定学科(如英语)的提升效果
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.service = ScoreAnalysisService(db_session)
    
    def track_subject_gap(
        self,
        exam_id: int,
        layer_id: int,
        subject_name: str,
        class_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        追踪指定学科与年级均分的差距
        
        Args:
            exam_id: 考试ID
            layer_id: 分层ID
            subject_name: 学科名称(如 'english')
            class_name: 班级名称，为None则追踪整个分层
            
        Returns:
            Dict: 学科差距分析结果
        """
        df = self.service._get_layer_valid_scores_df(exam_id, layer_id)
        
        if df.empty:
            raise ValueError("该分层下暂无有效成绩数据")
        
        # 学科列名映射
        subject_col_map = {
            'chinese': 'score_chinese',
            'math': 'score_math',
            'english': 'score_english',
            'science': 'score_science',
            'society': 'score_society'
        }
        
        subject_col = subject_col_map.get(subject_name.lower())
        if not subject_col or subject_col not in df.columns:
            raise ValueError(f"不支持的学科名称: {subject_name}")
        
        # 计算分层该学科平均分
        layer_subject_mean = df[subject_col].mean()
        
        result = {
            "exam_id": exam_id,
            "layer_id": layer_id,
            "subject": subject_name,
            "layer_subject_mean": round(float(layer_subject_mean), 2),
            "classes": []
        }
        
        # 确定要分析的班级
        if class_name:
            classes = [class_name]
        else:
            classes = df['class_name'].unique().tolist()
        
        for cls in classes:
            class_df = df[df['class_name'] == cls]
            
            if len(class_df) == 0:
                continue
            
            class_subject_mean = class_df[subject_col].mean()
            gap = class_subject_mean - layer_subject_mean
            gap_percent = (gap / layer_subject_mean * 100) if layer_subject_mean else 0
            
            result["classes"].append({
                "class_name": cls,
                "subject_mean": round(float(class_subject_mean), 2),
                "layer_mean": round(float(layer_subject_mean), 2),
                "gap": round(float(gap), 2),
                "gap_percent": round(float(gap_percent), 2),
                "status": "领先" if gap > 0 else "落后",
                "student_count": len(class_df)
            })
        
        # 按差距排序
        result["classes"].sort(key=lambda x: x["gap"], reverse=True)
        
        return result
    
    def get_subject_trend_analysis(
        self,
        class_name: str,
        subject_name: str,
        terms: List[str]
    ) -> Dict[str, Any]:
        """
        获取指定班级某学科的历次趋势分析
        
        Args:
            class_name: 班级名称
            subject_name: 学科名称
            terms: 学期列表
            
        Returns:
            Dict: 学科趋势分析
        """
        subject_col_map = {
            'chinese': 'score_chinese',
            'math': 'score_math',
            'english': 'score_english',
            'science': 'score_science',
            'society': 'score_society'
        }
        
        subject_col = subject_col_map.get(subject_name.lower())
        if not subject_col:
            raise ValueError(f"不支持的学科名称: {subject_name}")
        
        trends = []
        
        for term in terms:
            # 查询该学期该班级的考试数据
            sql = """
                SELECT 
                    e.id as exam_id,
                    e.exam_name,
                    AVG(s.{subject_col}) as subject_mean,
                    (SELECT AVG(s2.{subject_col}) 
                     FROM biz_scores s2 
                     JOIN biz_exams e2 ON s2.exam_id = e2.id
                     WHERE e2.term = :term AND s2.is_included = 1) as layer_subject_mean
                FROM biz_scores s
                JOIN biz_exams e ON s.exam_id = e.id
                WHERE s.class_name = :class_name
                  AND e.term = :term
                  AND s.is_included = 1
                GROUP BY e.id
            """.format(subject_col=subject_col)
            
            rows = self.db.execute(text(sql), {"class_name": class_name, "term": term}).fetchall()
            
            for row in rows:
                if row.subject_mean and row.layer_subject_mean:
                    gap = float(row.subject_mean) - float(row.layer_subject_mean)
                    trends.append({
                        "term": term,
                        "exam_id": row.exam_id,
                        "exam_name": row.exam_name,
                        "class_mean": round(float(row.subject_mean), 2),
                        "layer_mean": round(float(row.layer_subject_mean), 2),
                        "gap": round(gap, 2),
                        "status": "领先" if gap > 0 else "落后"
                    })
        
        # 计算总体趋势
        if len(trends) >= 2:
            first_gap = trends[0]["gap"]
            last_gap = trends[-1]["gap"]
            improvement = last_gap - first_gap
        else:
            improvement = 0
        
        return {
            "class_name": class_name,
            "subject": subject_name,
            "trends": trends,
            "total_exams": len(trends),
            "overall_improvement": round(improvement, 2),
            "trend_direction": "提升" if improvement > 0 else "下降" if improvement < 0 else "持平"
        }
