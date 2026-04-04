import { create } from 'zustand';
import { Course } from '@/types';

interface CourseState {
  selectedCourse: Course | null;
  courses: Course[];
  setSelectedCourse: (course: Course | null) => void;
  setCourses: (courses: Course[]) => void;
}

export const useCourseStore = create<CourseState>((set) => ({
  selectedCourse: null,
  courses: [],
  setSelectedCourse: (course) => set({ selectedCourse: course }),
  setCourses: (courses) => set({ courses }),
}));
