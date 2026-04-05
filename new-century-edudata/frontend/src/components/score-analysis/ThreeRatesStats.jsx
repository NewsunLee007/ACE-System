import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

export default function ThreeRatesStats({ examScores, allScopeExamScores, subjects, classLayers }) {
  const { stats, topRanks } = useMemo(() => {
    if (!examScores || examScores.length === 0 || !subjects) return { stats: [], topRanks: {} };

    // 计算年级各科的分数线
    const gradeScores = allScopeExamScores.filter(s => s.is_valid !== false);
    const thresholds = {};
    
    subjects.forEach(sub => {
      const scores = gradeScores.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v)).sort((a, b) => b - a);
      const count = scores.length;
      if (count > 0) {
        thresholds[sub] = {
          excLine: scores[Math.max(0, Math.ceil(count * 0.2) - 1)],
          passLine: 60, // 假设满分100，及格60。这里简化，如果有真实满分应按60%算
          failLine: scores[Math.max(0, Math.ceil(count * 0.8) - 1)]
        };
      }
    });

    const classIds = Array.from(new Set(examScores.map(s => s.class_id))).sort((a, b) => Number(a) - Number(b));
    const result = classIds.map(classId => {
      const classScores = examScores.filter(s => s.class_id === classId && s.is_valid !== false);
      const clsLayer = classLayers?.find(l => l.class_id === Number(classId));
      const className = clsLayer ? clsLayer.class_name : String(classId);

      const subjectStats = {};
      subjects.forEach(sub => {
        const scores = classScores.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v));
        const count = scores.length;
        if (count === 0) {
          subjectStats[sub] = { mean: 0, excRate: 0, passRate: 0, failRate: 0 };
          return;
        }
        
        const mean = scores.reduce((a, b) => a + b, 0) / count;
        const th = thresholds[sub];
        
        const excRate = th ? scores.filter(s => s >= th.excLine).length / count * 100 : 0;
        const passRate = th ? scores.filter(s => s >= th.passLine).length / count * 100 : 0;
        const failRate = th ? scores.filter(s => s < th.failLine).length / count * 100 : 0;

        subjectStats[sub] = { mean, excRate, passRate, failRate };
      });

      return { classId, className, subjectStats };
    });

    // 找出排名第一的指标
    const topRanksObj = {};
    subjects.forEach(sub => {
      topRanksObj[sub] = {
        mean: Math.max(...result.map(r => r.subjectStats[sub].mean)),
        excRate: Math.max(...result.map(r => r.subjectStats[sub].excRate)),
        passRate: Math.max(...result.map(r => r.subjectStats[sub].passRate)),
        failRate: Math.min(...result.map(r => r.subjectStats[sub].failRate)) // 低分率最低的最好
      };
    });

    return { stats: result, topRanks: topRanksObj };
  }, [examScores, allScopeExamScores, subjects, classLayers]);

  if (!stats || stats.length === 0) return <div>暂无数据</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">三率一分统计 (按班级、学科)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="text-center border-r">班级</TableHead>
                {subjects.map(sub => (
                  <TableHead key={sub} colSpan={4} className="text-center border-r">{sub}</TableHead>
                ))}
              </TableRow>
              <TableRow>
                {subjects.map(sub => (
                  <React.Fragment key={`${sub}-headers`}>
                    <TableHead className="text-center text-xs">平均分</TableHead>
                    <TableHead className="text-center text-xs">优秀率(%)</TableHead>
                    <TableHead className="text-center text-xs">及格率(%)</TableHead>
                    <TableHead className="text-center text-xs border-r">后20%率(%)</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map(row => (
                <TableRow key={row.classId}>
                  <TableCell className="text-center font-medium border-r">{row.className}</TableCell>
                  {subjects.map(sub => {
                    const st = row.subjectStats[sub];
                    const tops = topRanks[sub];
                    return (
                      <React.Fragment key={`${row.classId}-${sub}`}>
                        <TableCell className={`text-center ${st.mean === tops.mean && st.mean > 0 ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                          {st.mean.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center ${st.excRate === tops.excRate && st.excRate > 0 ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                          {st.excRate.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center ${st.passRate === tops.passRate && st.passRate > 0 ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                          {st.passRate.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center border-r ${st.failRate === tops.failRate && st.failRate < 100 ? 'text-green-600 font-bold bg-green-50' : ''}`}>
                          {st.failRate.toFixed(1)}
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}