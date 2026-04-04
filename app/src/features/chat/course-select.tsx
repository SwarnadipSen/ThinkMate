'use client';

import { Course } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen } from 'lucide-react';

interface CourseSelectProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelect: (courseId: string) => void;
}

export function CourseSelect({ courses, selectedCourseId, onSelect }: CourseSelectProps) {
  const selectedCourse = courses.find((course) => course.course_id === selectedCourseId);

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md bg-muted p-1.5">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <Select value={selectedCourseId || undefined} onValueChange={onSelect}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.course_id}>{course.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCourse && (
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            {selectedCourse.course_id} • {selectedCourse.document_count} documents
          </p>
        )}
      </div>
    </div>
  );
}
