"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "@/lib/api";
import { TeacherAnalyticsOverview } from "@/types";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  MessageSquare,
  Users,
} from "lucide-react";

type TimeRange = "7d" | "30d" | "90d" | "all";

const activityChartConfig = {
  messages: {
    label: "Messages",
    color: "hsl(var(--chart-1))",
  },
  students: {
    label: "Active Students",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const courseChartConfig = {
  conversations: {
    label: "Conversations",
    color: "hsl(var(--chart-3))",
  },
  students: {
    label: "Students",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

const issueChartConfig = {
  count: {
    label: "Issue Mentions",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const priorityBadgeClass: Record<"high" | "medium" | "low", string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function formatDayLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [data, setData] = useState<TeacherAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const response = await analyticsApi.getOverview(timeRange);
        setData(response.data);
      } catch {
        toast.error("Failed to load analytics data");
      } finally {
        setIsLoading(false);
      }
    };

    void loadOverview();
  }, [timeRange]);

  const activityData = useMemo(() => {
    if (!data) return [];
    return data.activity_by_day.map((item) => ({
      day: formatDayLabel(item.date),
      messages: item.message_count,
      students: item.active_students,
    }));
  }, [data]);

  const courseData = useMemo(() => {
    if (!data) return [];
    return data.top_courses.slice(0, 6).map((course) => ({
      course:
        course.course_name.length > 18
          ? `${course.course_name.slice(0, 18)}...`
          : course.course_name,
      conversations: course.conversation_count,
      students: course.student_count,
    }));
  }, [data]);

  const issueData = useMemo(() => {
    if (!data) return [];
    return data.issue_signals.map((issue) => ({
      issue: issue.issue,
      count: issue.count,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>No analytics available</CardTitle>
            <CardDescription>
              We could not load analytics right now. Please try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teaching Analytics</h1>
          <p className="text-muted-foreground">
            Identify learning friction, course engagement trends, and
            reliability risks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time range</span>
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className="min-w-28">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.active_students}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.summary.active_courses}/{data.summary.total_courses}{" "}
              active courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Course Materials
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.total_documents}
            </div>
            <p className="text-xs text-muted-foreground">
              Supporting {data.summary.total_conversations} total conversations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Message Volume
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.total_messages}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {data.summary.avg_messages_per_conversation} messages per
              conversation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Source Coverage
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {data.source_coverage.coverage_rate}%
            </div>
            <Progress value={data.source_coverage.coverage_rate} />
            <p className="text-xs text-muted-foreground">
              {data.source_coverage.assistant_messages_with_sources}/
              {data.source_coverage.total_assistant_messages} AI replies cited
              sources
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Trend</CardTitle>
            <CardDescription>
              Daily message and student activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={activityChartConfig}
              className="h-72 w-full"
            >
              <LineChart data={activityData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  dataKey="messages"
                  type="monotone"
                  stroke="var(--color-messages)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="students"
                  type="monotone"
                  stroke="var(--color-students)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Course Engagement</CardTitle>
            <CardDescription>
              Conversation and student activity by course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={courseChartConfig} className="h-72 w-full">
              <BarChart data={courseData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="course"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="conversations"
                  fill="var(--color-conversations)"
                  radius={4}
                />
                <Bar
                  dataKey="students"
                  fill="var(--color-students)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Issue Signals</CardTitle>
            <CardDescription>
              Most frequent student friction themes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={issueChartConfig} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={issueData}
                  dataKey="count"
                  nameKey="issue"
                  innerRadius={45}
                  outerRadius={80}
                />
                <ChartLegend content={<ChartLegendContent nameKey="issue" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>At-Risk Courses</CardTitle>
            <CardDescription>
              Courses with high issue rates, low grounding, or weak activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.at_risk_courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No medium/high risk courses detected for this time range.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Issue Rate</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Key Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.at_risk_courses.map((course) => (
                    <TableRow key={course.course_id}>
                      <TableCell className="font-medium">
                        {course.course_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={priorityBadgeClass[course.risk_level]}
                        >
                          {course.risk_level.toUpperCase()} ({course.risk_score}
                          )
                        </Badge>
                      </TableCell>
                      <TableCell>{course.issue_rate}%</TableCell>
                      <TableCell>{course.source_coverage_rate}%</TableCell>
                      <TableCell className="max-w-[320px] truncate">
                        {course.reasons[0] || "Multiple weak signals detected"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Teacher Actions</CardTitle>
          <CardDescription>
            Generated from current course and issue analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recommendations yet. As usage grows, actionable suggestions
              will appear here.
            </p>
          ) : (
            data.recommendations.map((recommendation) => (
              <div key={recommendation.title} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    className={priorityBadgeClass[recommendation.priority]}
                  >
                    {recommendation.priority.toUpperCase()}
                  </Badge>
                  <h3 className="font-semibold">{recommendation.title}</h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {recommendation.rationale}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {recommendation.suggested_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issue Examples</CardTitle>
          <CardDescription>
            Representative student prompts behind detected issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.issue_signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No issue signals found for this time range.
            </p>
          ) : (
            data.issue_signals.map((issue) => (
              <div key={issue.issue} className="rounded-lg border p-3">
                <p className="font-medium">
                  {issue.issue}{" "}
                  <span className="text-muted-foreground">
                    ({issue.count}, {issue.percentage}%)
                  </span>
                </p>
                {issue.example_prompts.length > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    “{issue.example_prompts[0]}”
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No sample prompt captured.
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
