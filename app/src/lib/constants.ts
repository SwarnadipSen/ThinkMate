export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  TEACHER_DASHBOARD: "/dashboard",
  TEACHER_ANALYTICS: "/analytics",
  STUDENT_CHAT: "/chat",
  STUDENT_EXAM: "/exam",
} as const;

export const TOKEN_KEY = "auth_token";
export const USER_KEY = "user_data";
