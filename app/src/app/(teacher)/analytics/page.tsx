'use client';

import { useEffect, useMemo, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import { AnalyticsRange, TeacherAnalyticsOverview } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Line, LineChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, BookOpen, MessageSquareText, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const activityChartConfig = {
  messages: {
    label: 'Messages',
    color: 'var(--chart-1)',
  },
  students: {
    label: 'Active Students',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

const issueChartConfig = {
  count: {
    label: 'Mentions',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

const coursesChartConfig = {
  conversations: {
    label: 'Conversations',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

const coverageChartConfig = {
  used: {
    label: 'With Sources',
    color: 'var(--chart-1)',
  },
  missing: {
    label: 'Without Sources',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

function LoadingState() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[320px]" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [data, setData] = useState<TeacherAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalytics = async (nextRange: AnalyticsRange) => {
    setIsLoading(true);
    try {
      const response = await analyticsApi.getOverview(nextRange);
      setData(response.data);
    } catch {
      toast.error('Failed to load analytics dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(range);
  }, [range]);

  const activityData = useMemo(() => {
    if (!data) return [];
    return data.activity_by_day.slice(-14).map((item) => ({
      day: item.date.slice(5),
      messages: item.message_count,
      students: item.active_students,
    }));
  }, [data]);

  const issueData = useMemo(() => {
    if (!data) return [];
    return data.issue_signals.map((item) => ({
      issue: item.issue,
      count: item.count,
      percentage: item.percentage,
    }));
  }, [data]);

  const courseChartData = useMemo(() => {
    if (!data) return [];
    return data.top_courses.slice(0, 6).map((course) => ({
      course: course.course_name.length > 14 ? `${course.course_name.slice(0, 14)}…` : course.course_name,
      conversations: course.conversation_count,
    }));
  }, [data]);

  const coverageData = useMemo(() => {
    if (!data) return [];
    const withSources = data.source_coverage.assistant_messages_with_sources;
    const total = data.source_coverage.total_assistant_messages;
    const withoutSources = Math.max(total - withSources, 0);

    return [
      { name: 'used', value: withSources, fill: 'var(--color-used)' },
      { name: 'missing', value: withoutSources, fill: 'var(--color-missing)' },
    ];
  }, [data]);

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (!data) {
    return null;
  }

  const summary = data.summary;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teacher Analytics</h1>
          <p className="text-muted-foreground">
            Understand student difficulties, engagement, and course activity.
          </p>
        </div>

        <div className="w-full md:w-52">
          <Select value={range} onValueChange={(value) => setRange(value as AnalyticsRange)}>
            <SelectTrigger>
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Refreshing analytics...
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.active_students}</div>
            <p className="text-xs text-muted-foreground">Students who interacted in selected range</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.active_courses} / {summary.total_courses}
            </div>
            <div className="mt-2 space-y-1">
              <Progress value={summary.engagement_rate} className="h-2" />
              <p className="text-xs text-muted-foreground">{summary.engagement_rate}% course engagement rate</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_conversations}</div>
            <p className="text-xs text-muted-foreground">{summary.avg_messages_per_conversation} avg messages per thread</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RAG Source Coverage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.source_coverage.coverage_rate}%</div>
            <div className="mt-2 space-y-1">
              <Progress value={data.source_coverage.coverage_rate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {data.source_coverage.assistant_messages_with_sources} / {data.source_coverage.total_assistant_messages} assistant replies used sources
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Trend
            </CardTitle>
            <CardDescription>Daily message activity in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {activityData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet in this range.</p>
            ) : (
              <ChartContainer config={activityChartConfig} className="h-[270px] w-full">
                <LineChart data={activityData} margin={{ left: 6, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="messages" stroke="var(--color-messages)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="students" stroke="var(--color-students)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Student Issue Signals
            </CardTitle>
            <CardDescription>Detected from student prompts to identify recurring pain points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {issueData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No strong issue patterns detected yet.</p>
            ) : (
              <>
                <ChartContainer config={issueChartConfig} className="h-[220px] w-full">
                  <BarChart data={issueData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="issue"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ChartContainer>

                {data.issue_signals.slice(0, 2).map((issue) => (
                  <div key={issue.issue} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{issue.issue}</p>
                      <Badge variant="secondary">{issue.percentage}%</Badge>
                    </div>
                    {issue.example_prompts.length > 0 && (
                      <p className="text-xs text-muted-foreground">Example: {issue.example_prompts[0]}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Course Activity Distribution
            </CardTitle>
            <CardDescription>Conversations by top active courses</CardDescription>
          </CardHeader>
          <CardContent>
            {courseChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course activity yet.</p>
            ) : (
              <ChartContainer config={coursesChartConfig} className="h-[260px] w-full">
                <BarChart data={courseChartData} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="course" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="conversations" fill="var(--color-conversations)" radius={6} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Source Usage Split
            </CardTitle>
            <CardDescription>How often responses included retrieved sources</CardDescription>
          </CardHeader>
          <CardContent>
            {coverageData.every((item) => item.value === 0) ? (
              <p className="text-sm text-muted-foreground">No assistant responses in this period.</p>
            ) : (
              <ChartContainer config={coverageChartConfig} className="h-[260px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  <Pie data={coverageData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={85}>
                    {coverageData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Performance</CardTitle>
          <CardDescription>
            Drill into course-level usage to identify where students need more support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.top_courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No course activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Conversations</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Avg Msg/Conv</TableHead>
                  <TableHead>Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_courses.map((course) => (
                  <TableRow key={course.course_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{course.course_name}</p>
                        <p className="text-xs text-muted-foreground">{course.course_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{course.student_count}</TableCell>
                    <TableCell>{course.conversation_count}</TableCell>
                    <TableCell>{course.message_count}</TableCell>
                    <TableCell>{course.avg_messages_per_conversation}</TableCell>
                    <TableCell>{course.document_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            Generated at: {new Date(data.generated_at).toLocaleString()} • Total messages analyzed: {summary.total_messages}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
