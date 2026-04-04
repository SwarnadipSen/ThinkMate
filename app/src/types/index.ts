export interface User {
  id: string;
  email: string;
  role: "teacher" | "student";
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: "teacher" | "student";
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface Course {
  id: string;
  course_id: string;
  name: string;
  teacher_id: string;
  created_at: string;
  document_count: number;
}

export interface CreateCourseRequest {
  name: string;
  course_id: string;
}

export interface Document {
  id: string;
  course_id: string;
  filename: string;
  file_type: string;
  upload_date: string;
  chunk_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: ChatSource[];
}

export interface ChatRequest {
  course_id: string;
  message: string;
  conversation_id?: string;
}

export interface ChatSource {
  filename: string;
  chunk_index: number;
  page_number?: number | null;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  sources: ChatSource[];
}

export interface Conversation {
  id: string;
  course_id: string;
  course_name: string;
  last_message: string;
  message_count: number;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  course_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ExamGenerationRequest {
  course_id: string;
  selected_pdfs: string[];
  num_questions: number;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
}

export interface MCQQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface MCQGenerationResponse {
  questions: MCQQuestion[];
}

export interface DescriptiveQuestion {
  question: string;
  marks: 5 | 10;
  expected_points: string[];
}

export interface DescriptiveGenerationResponse {
  questions: DescriptiveQuestion[];
}

export interface MCQAnswerItem {
  question_index: number;
  selected_answer: string;
}

export interface MCQEvaluationRequest {
  questions: MCQQuestion[];
  answers: MCQAnswerItem[];
}

export interface MCQEvaluationResponse {
  score: number;
  total: number;
  feedback: string;
  improvement_plan: {
    focus_areas: string[];
    study_actions: string[];
    next_quiz_goal: string;
  };
}

export interface ExamExportRequest {
  title: string;
  questions: DescriptiveQuestion[];
}

export interface AnalyticsSummary {
  total_courses: number;
  active_courses: number;
  total_documents: number;
  active_students: number;
  total_conversations: number;
  total_messages: number;
  avg_messages_per_conversation: number;
  engagement_rate: number;
}

export interface SourceCoverage {
  assistant_messages_with_sources: number;
  total_assistant_messages: number;
  coverage_rate: number;
}

export interface CourseAnalytics {
  course_id: string;
  course_name: string;
  document_count: number;
  student_count: number;
  conversation_count: number;
  message_count: number;
  avg_messages_per_conversation: number;
  last_activity?: string | null;
}

export interface DailyActivity {
  date: string;
  message_count: number;
  conversation_count: number;
  active_students: number;
}

export interface IssueSignal {
  issue: string;
  count: number;
  percentage: number;
  example_prompts: string[];
}

export interface AtRiskCourse {
  course_id: string;
  course_name: string;
  risk_score: number;
  risk_level: "high" | "medium" | "low";
  issue_rate: number;
  source_coverage_rate: number;
  days_since_last_activity?: number | null;
  reasons: string[];
}

export interface ActionRecommendation {
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  suggested_actions: string[];
}

export interface TeacherAnalyticsOverview {
  time_range: "7d" | "30d" | "90d" | "all";
  generated_at: string;
  summary: AnalyticsSummary;
  source_coverage: SourceCoverage;
  top_courses: CourseAnalytics[];
  activity_by_day: DailyActivity[];
  issue_signals: IssueSignal[];
  at_risk_courses: AtRiskCourse[];
  recommendations: ActionRecommendation[];
}
