"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import {
  BookOpenCheck,
  Download,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { courseApi, documentApi, examApi } from "@/lib/api";
import { Course, DescriptiveQuestion, Document, MCQQuestion } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const DOWNLOAD_FILENAME = "exam_paper.pdf";
const EXAM_SETTINGS_KEY = "exam_mode_settings_v1";

type ExamModeSettings = {
  selectedCourseId: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  numQuestions: number;
  selectedFilesByCourse: Record<string, string[]>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function ExamMode() {
  const selectedFilesByCourseRef = useRef<Record<string, string[]>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);

  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isGeneratingMcq, setIsGeneratingMcq] = useState(false);
  const [isSubmittingMcq, setIsSubmittingMcq] = useState(false);
  const [isGeneratingDescriptive, setIsGeneratingDescriptive] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, string>>({});
  const [mcqResult, setMcqResult] = useState<{
    score: number;
    total: number;
    feedback: string;
  } | null>(null);

  const [descriptiveQuestions, setDescriptiveQuestions] = useState<
    DescriptiveQuestion[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(EXAM_SETTINGS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<ExamModeSettings>;
      if (parsed.selectedCourseId) setSelectedCourseId(parsed.selectedCourseId);
      if (parsed.difficulty) setDifficulty(parsed.difficulty);
      if (typeof parsed.topic === "string") setTopic(parsed.topic);
      if (typeof parsed.numQuestions === "number") {
        setNumQuestions(Math.max(1, Math.min(25, parsed.numQuestions)));
      }
      selectedFilesByCourseRef.current = parsed.selectedFilesByCourse || {};
    } catch {
      // Ignore corrupted persisted settings.
    }
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    selectedFilesByCourseRef.current[selectedCourseId] = selectedFiles;
  }, [selectedCourseId, selectedFiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: ExamModeSettings = {
      selectedCourseId,
      difficulty,
      topic,
      numQuestions,
      selectedFilesByCourse: selectedFilesByCourseRef.current,
    };

    localStorage.setItem(EXAM_SETTINGS_KEY, JSON.stringify(payload));
  }, [selectedCourseId, difficulty, topic, numQuestions, selectedFiles]);

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setDocuments([]);
      setSelectedFiles([]);
      return;
    }
    void loadDocuments(selectedCourseId);
  }, [selectedCourseId]);

  const canGenerate = useMemo(
    () =>
      Boolean(selectedCourseId) &&
      selectedFiles.length > 0 &&
      numQuestions >= 1,
    [numQuestions, selectedCourseId, selectedFiles.length],
  );

  async function loadCourses() {
    setLoadingCourses(true);
    try {
      const { data } = await courseApi.getAll();
      setCourses(data);
      if (data.length > 0) {
        setSelectedCourseId((current) => {
          if (current && data.some((course) => course.course_id === current)) {
            return current;
          }
          return data[0].course_id;
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load courses"));
    } finally {
      setLoadingCourses(false);
    }
  }

  async function loadDocuments(courseId: string) {
    setLoadingDocs(true);
    try {
      const { data } = await documentApi.getAll(courseId);
      setDocuments(data);

      const persisted = selectedFilesByCourseRef.current[courseId] || [];
      const availableNames = new Set(data.map((d) => d.filename));
      const restored = persisted.filter((name) => availableNames.has(name));

      if (restored.length > 0) {
        setSelectedFiles(restored);
      } else {
        setSelectedFiles(
          data.slice(0, Math.min(3, data.length)).map((d) => d.filename),
        );
      }
    } catch (error) {
      setDocuments([]);
      setSelectedFiles([]);
      toast.error(
        getErrorMessage(error, "Failed to load documents for this course"),
      );
    } finally {
      setLoadingDocs(false);
    }
  }

  function toggleFile(filename: string) {
    setSelectedFiles((prev) => {
      if (prev.includes(filename)) return prev.filter((f) => f !== filename);
      return [...prev, filename];
    });
  }

  async function handleGenerateMcq() {
    if (!canGenerate) {
      toast.error("Choose a course and at least one document.");
      return;
    }

    setIsGeneratingMcq(true);
    setMcqResult(null);
    setMcqAnswers({});

    try {
      const { data } = await examApi.generateMcq({
        course_id: selectedCourseId,
        selected_pdfs: selectedFiles,
        num_questions: numQuestions,
        difficulty,
        topic: topic.trim() || undefined,
      });
      setMcqQuestions(data.questions);
      toast.success(`Generated ${data.questions.length} MCQ questions.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to generate MCQ quiz"));
    } finally {
      setIsGeneratingMcq(false);
    }
  }

  async function handleSubmitMcq() {
    if (mcqQuestions.length === 0) {
      toast.error("Generate quiz questions first.");
      return;
    }

    setIsSubmittingMcq(true);
    try {
      const answers = mcqQuestions.map((_, idx) => ({
        question_index: idx,
        selected_answer: mcqAnswers[idx] || "",
      }));

      const { data } = await examApi.evaluateMcq({
        questions: mcqQuestions,
        answers,
      });
      setMcqResult(data);
      toast.success(`Submitted: ${data.score}/${data.total}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to submit quiz"));
    } finally {
      setIsSubmittingMcq(false);
    }
  }

  async function handleGenerateDescriptive() {
    if (!canGenerate) {
      toast.error("Choose a course and at least one document.");
      return;
    }

    setIsGeneratingDescriptive(true);
    try {
      const { data } = await examApi.generateDescriptive({
        course_id: selectedCourseId,
        selected_pdfs: selectedFiles,
        num_questions: numQuestions,
        difficulty,
        topic: topic.trim() || undefined,
      });
      setDescriptiveQuestions(data.questions);
      toast.success(
        `Generated ${data.questions.length} descriptive questions.`,
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to generate descriptive questions"),
      );
    } finally {
      setIsGeneratingDescriptive(false);
    }
  }

  async function handleExportPdf() {
    if (descriptiveQuestions.length === 0) {
      toast.error("Generate descriptive questions first.");
      return;
    }

    setIsExportingPdf(true);
    try {
      const { data } = await examApi.exportDescriptivePdf({
        title: "Exam Paper",
        questions: descriptiveQuestions,
      });

      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = DOWNLOAD_FILENAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success("Exam PDF downloaded.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to export exam PDF"));
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
        <Card className="border bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Exam Mode
            </CardTitle>
            <CardDescription>
              Build MCQ quizzes or descriptive exam sets from selected course
              documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                disabled={loadingCourses}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.course_id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(
                    event.target.value as "easy" | "medium" | "hard",
                  )
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Questions</label>
              <Input
                type="number"
                min={1}
                max={25}
                value={numQuestions}
                onChange={(event) =>
                  setNumQuestions(
                    Math.max(1, Math.min(25, Number(event.target.value) || 1)),
                  )
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <label className="text-sm font-medium">
                Topic Focus (optional)
              </label>
              <Input
                placeholder="Example: operating systems scheduling"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <p className="text-sm font-medium">Documents</p>
              <ScrollArea className="h-32 rounded-md border">
                <div className="space-y-2 p-3">
                  {loadingDocs ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading documents...
                    </div>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No documents found for this course.
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                      >
                        <span className="truncate">{doc.filename}</span>
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(doc.filename)}
                          onChange={() => toggleFile(doc.filename)}
                        />
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="mcq" className="w-full">
          <TabsList>
            <TabsTrigger value="mcq" className="gap-2">
              <BookOpenCheck className="h-4 w-4" />
              MCQ Quiz
            </TabsTrigger>
            <TabsTrigger value="descriptive" className="gap-2">
              <FileText className="h-4 w-4" />
              Long Answer Exam
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mcq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interactive Quiz</CardTitle>
                <CardDescription>
                  Generate, answer, and score instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleGenerateMcq}
                    disabled={!canGenerate || isGeneratingMcq}
                  >
                    {isGeneratingMcq ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Generate Quiz
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSubmitMcq}
                    disabled={mcqQuestions.length === 0 || isSubmittingMcq}
                  >
                    {isSubmittingMcq ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Submit Quiz
                  </Button>
                </div>

                {mcqResult ? (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Score: {mcqResult.score}/{mcqResult.total}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mcqResult.feedback}
                    </p>
                    <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
                      <p className="text-sm font-medium">Improvement Plan</p>
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Focus Areas
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {mcqResult.improvement_plan.focus_areas.map(
                            (area) => (
                              <li key={area}>{area}</li>
                            ),
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Study Actions
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {mcqResult.improvement_plan.study_actions.map(
                            (step) => (
                              <li key={step}>{step}</li>
                            ),
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Next Quiz Goal
                        </p>
                        <p className="mt-1 text-sm">
                          {mcqResult.improvement_plan.next_quiz_goal}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <Separator />

                <div className="space-y-4">
                  {mcqQuestions.map((q, index) => (
                    <div
                      key={`${q.question}-${index}`}
                      className="rounded-lg border p-3"
                    >
                      <p className="font-medium">
                        Q{index + 1}. {q.question}
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {q.options.map((opt) => (
                          <button
                            type="button"
                            key={opt}
                            className={`rounded-md border p-2 text-left text-sm transition-colors ${
                              mcqAnswers[index] === opt
                                ? mcqResult
                                  ? opt === q.correct_answer
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-red-600 bg-red-600 text-white"
                                  : "border-foreground bg-foreground text-background"
                                : "hover:bg-muted"
                            }`}
                            onClick={() => {
                              setMcqAnswers((prev) => ({
                                ...prev,
                                [index]: opt,
                              }));
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Hint: {q.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="descriptive" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exam Paper Builder</CardTitle>
                <CardDescription>
                  Generate long-answer questions and export as PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleGenerateDescriptive}
                    disabled={!canGenerate || isGeneratingDescriptive}
                  >
                    {isGeneratingDescriptive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Generate Descriptive Set
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleExportPdf}
                    disabled={
                      descriptiveQuestions.length === 0 || isExportingPdf
                    }
                  >
                    {isExportingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export PDF
                  </Button>
                </div>

                <div className="space-y-3">
                  {descriptiveQuestions.map((q, index) => (
                    <div
                      key={`${q.question}-${index}`}
                      className="rounded-lg border p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="secondary">Q{index + 1}</Badge>
                        <Badge>{q.marks} marks</Badge>
                      </div>
                      <p className="font-medium">{q.question}</p>
                      {q.expected_points.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {q.expected_points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
