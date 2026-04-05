import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Users } from 'lucide-react';
import HistoricalDiffDrawer from './HistoricalDiffDrawer';

export default function AdmissionPrediction({ examScores, allScopeExamScores, subjects, classLayers }) {
  const [keyHighLine, setKeyHighLine] = useState('');
  const [regHighLine, setRegHighLine] = useState('');
  const [activeLine, setActiveLine] = useState('key'); // 'key' or 'reg'

  const { classData, summary, radarData } = useMemo(() => {
    if (!examScores || examScores.length === 0 || !subjects) return { classData: [], summary: {}, radarData: [] };

    const lineScore = activeLine === 'key' ? Number(keyHighLine) : Number(regHighLine);
    const validScores = examScores.filter(s => s.is_valid !== false);
    
    // Calculate class data
    const classIds = Array.from(new Set(validScores.map(s => s.class_id))).sort((a, b) => Number(a) - Number(b));
    let totalParticipants = 0;
    let totalAdmitted = 0;

    const cData = classIds.map(classId => {
      const cScores = validScores.filter(s => s.class_id === classId);
      const clsLayer = classLayers?.find(l => l.class_id === Number(classId));
      const className = clsLayer ? clsLayer.class_name : String(classId);

      const participants = cScores.length;
      let admitted = 0;
      if (!isNaN(lineScore) && lineScore > 0) {
        admitted = cScores.filter(s => Number(s.total_score) >= lineScore).length;
      }
      const rate = participants > 0 ? (admitted / participants * 100).toFixed(2) : '0.00';

      totalParticipants += participants;
      totalAdmitted += admitted;

      return { classId, className, participants, admitted, rate };
    });

    const sum = {
      participants: totalParticipants,
      admitted: totalAdmitted,
      rate: totalParticipants > 0 ? (totalAdmitted / totalParticipants * 100).toFixed(2) : '0.00'
    };

    // Calculate subject contribution (Radar Data)
    // 学科贡献度：上线学生在各科的平均得分率 vs 全体学生在各科的平均得分率
    const admittedStudents = validScores.filter(s => !isNaN(lineScore) && lineScore > 0 && Number(s.total_score) >= lineScore);
    const rData = subjects.map(sub => {
      const allSubScores = validScores.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v));
      const admSubScores = admittedStudents.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v));

      const allMean = allSubScores.length > 0 ? allSubScores.reduce((a, b) => a + b, 0) / allSubScores.length : 0;
      const admMean = admSubScores.length > 0 ? admSubScores.reduce((a, b) => a + b, 0) / admSubScores.length : 0;
      
      // 贡献度可以用 上线生均分/全体均分 来体现（拉动作用）
      const contribution = allMean > 0 ? ((admMean / allMean) * 100).toFixed(1) : 0;

      return {
        subject: sub,
        "全体均分": Number(allMean.toFixed(1)),
        "上线生均分": Number(admMean.toFixed(1)),
        "贡献度指数": Number(contribution)
      };
    });

    return { classData: cData, summary: sum, radarData: rData };
  }, [examScores, subjects, classLayers, keyHighLine, regHighLine, activeLine]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">模拟进线配置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <label className="whitespace-nowrap font-medium text-gray-700">重高模拟分数线:</label>
              <Input 
                type="number" 
                placeholder="例如: 580" 
                value={keyHighLine} 
                onChange={e => setKeyHighLine(e.target.value)} 
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <label className="whitespace-nowrap font-medium text-gray-700">普高模拟分数线:</label>
              <Input 
                type="number" 
                placeholder="例如: 520" 
                value={regHighLine} 
                onChange={e => setRegHighLine(e.target.value)} 
                className="w-32"
              />
            </div>
            <div className="flex-1 flex justify-end gap-2">
              <Button 
                variant={activeLine === 'key' ? 'default' : 'outline'} 
                onClick={() => setActiveLine('key')}
                className={activeLine === 'key' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-200 hover:bg-red-50'}
              >
                查看重高进线
              </Button>
              <Button 
                variant={activeLine === 'reg' ? 'default' : 'outline'} 
                onClick={() => setActiveLine('reg')}
                className={activeLine === 'reg' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}
              >
                查看普高进线
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              各班进线统计 ({activeLine === 'key' ? '重高' : '普高'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead className="text-center">班级</TableHead>
                    <TableHead className="text-center">参考人数</TableHead>
                    <TableHead className="text-center text-green-600">进线人数</TableHead>
                    <TableHead className="text-center text-indigo-600">上线率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classData.map(row => (
                    <TableRow key={row.classId}>
                      <TableCell className="text-center font-medium">{row.className}</TableCell>
                      <TableCell className="text-center">{row.participants}</TableCell>
                      <TableCell className="text-center font-bold text-green-600">{row.admitted}</TableCell>
                      <TableCell className="text-center font-bold text-indigo-600">{row.rate}%</TableCell>
                    </TableRow>
                  ))}
                  {classData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">暂无数据，请先配置分数线</TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-gray-50 font-bold">
                  <TableRow>
                    <TableCell className="text-center">全年级汇总</TableCell>
                    <TableCell className="text-center">{summary.participants}</TableCell>
                    <TableCell className="text-center text-green-700">{summary.admitted}</TableCell>
                    <TableCell className="text-center text-indigo-700">{summary.rate}%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">学科贡献度分析 (拉动作用)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.admitted > 0 ? (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                    <Radar name="上线生均分" dataKey="上线生均分" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
                    <Radar name="全体均分" dataKey="全体均分" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-gray-500">
                暂无上线学生数据，请调整分数线
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <HistoricalDiffDrawer currentAdmissionData={classData} />
    </div>
  );
}