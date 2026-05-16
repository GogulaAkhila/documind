import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EvalMetrics } from "@/types";

interface EvalChartProps {
  metrics: EvalMetrics;
}

export function EvalChart({ metrics }: EvalChartProps) {
  const radarData = [
    { metric: "Faithfulness", value: metrics.faithfulness * 100 },
    { metric: "Relevance", value: metrics.answer_relevance * 100 },
    { metric: "Precision", value: metrics.context_precision * 100 },
  ];

  const barData = [
    { name: "Faithfulness", score: metrics.faithfulness * 100, fill: "var(--color-chart-2)" },
    { name: "Answer Relevance", score: metrics.answer_relevance * 100, fill: "var(--color-chart-1)" },
    { name: "Context Precision", score: metrics.context_precision * 100, fill: "var(--color-chart-4)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metrics Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="radar">
          <TabsList className="mb-4">
            <TabsTrigger value="radar">Radar</TabsTrigger>
            <TabsTrigger value="bar">Bar</TabsTrigger>
          </TabsList>

          <TabsContent value="radar">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                />
                <Radar
                  dataKey="value"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="bar">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Score"]}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
