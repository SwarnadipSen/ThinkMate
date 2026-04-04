'use client';

import { Course } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CourseCardProps {
  course: Course;
  onSelect: (course: Course) => void;
}

export function CourseCard({ course, onSelect }: CourseCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
      onClick={() => onSelect(course)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{course.name}</h3>
          </div>
          <Badge variant="secondary">{course.course_id}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <FileText className="mr-1 h-4 w-4" />
            <span>{course.document_count} documents</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center text-xs text-muted-foreground">
          <Calendar className="mr-1 h-3 w-3" />
          <span>Created {formatDate(course.created_at)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
