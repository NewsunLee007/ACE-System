import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Button } from '../ui/button';
import { Textarea } from '../ui/input'; // Assuming Textarea is not available, I'll use native textarea
import { ArrowUp, ArrowDown, History } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

export default function HistoricalDiffDrawer({ currentAdmissionData }) {
  const [pasteData, setPasteData] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  // Expected format for pasting: ClassName\tRate
  // e.g. 701班\t 45.5%
  
  const handleCalculate = () => {
    try {
      const rows = pasteData.trim().split('\n').map(r => r.split('\t'));
      if (rows.length < 1 || !rows[0][0]) return;
      
      const parsed = rows.map(r => ({
        className: r[0]?.trim(),
        rate: parseFloat(r[1]?.replace('%', '')) || 0
      }));
      setHistoryData(parsed);
      setIsOpen(true);
    } catch (err) {
      alert('解析失败，请检查格式');
    }
  };

  const diffData = useMemo(() => {
    if (!currentAdmissionData || historyData.length === 0) return [];
    
    return currentAdmissionData.map(curr => {
      const hist = historyData.find(h => h.className === curr.className || h.className.includes(curr.className));
      const histRate = hist ? hist.rate : null;
      const currRate = parseFloat(curr.rate);
      const diff = histRate !== null ? (currRate - histRate).toFixed(2) : null;

      return {
        className: curr.className,
        currRate: currRate.toFixed(2),
        histRate: histRate !== null ? histRate.toFixed(2) : '-',
        diff: diff !== null ? diff : '-'
      };
    });
  }, [currentAdmissionData, historyData]);

  return (
    <Card className="mt-6 border-indigo-100 bg-indigo-50/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-indigo-800">
          <History className="w-5 h-5" />
          历史数据录入与对比 (纵向对比)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <textarea 
            className="w-full md:w-2/3 h-24 p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm bg-white"
            placeholder="粘贴历次上线率数据 (格式: 班级名 Tab 上线率%)&#10;例如:&#10;1班&#9;45.5%&#10;2班&#9;42.0%"
            value={pasteData}
            onChange={e => setPasteData(e.target.value)}
          />
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button 
                onClick={handleCalculate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto h-24"
                disabled={!pasteData.trim()}
              >
                计算差值 & 对比
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-indigo-800 text-xl border-b pb-4">
                  <History className="w-6 h-6" />
                  历史上线率差值对比
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center font-bold">班级</TableHead>
                      <TableHead className="text-center font-bold text-gray-500">历史率(%)</TableHead>
                      <TableHead className="text-center font-bold text-indigo-600">最新率(%)</TableHead>
                      <TableHead className="text-center font-bold">差值(%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffData.map((row, idx) => {
                      const diffVal = parseFloat(row.diff);
                      const isPositive = diffVal > 0;
                      const isNegative = diffVal < 0;

                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-medium">{row.className}</TableCell>
                          <TableCell className="text-center text-gray-500">{row.histRate}</TableCell>
                          <TableCell className="text-center font-bold text-indigo-600">{row.currRate}</TableCell>
                          <TableCell className="text-center font-bold">
                            {row.diff !== '-' ? (
                              <div className={`flex items-center justify-center gap-1 ${isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-gray-500'}`}>
                                {isPositive && <ArrowUp className="w-4 h-4" />}
                                {isNegative && <ArrowDown className="w-4 h-4" />}
                                {!isPositive && !isNegative && <span className="text-lg">-</span>}
                                {isPositive || isNegative ? Math.abs(diffVal).toFixed(2) : ''}
                              </div>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </CardContent>
    </Card>
  );
}