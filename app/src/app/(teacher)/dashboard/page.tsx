'use client';

import { useEffect, useState } from 'react';
import { Course } from '@/types';
import { courseApi } from '@/lib/api';
import { CourseCard } from '@/features/courses/course-card';
import { CreateCourseDialog } from '@/features/courses/create-course-dialog';
import { DocumentUpload } from '@/features/courses/document-upload';
import { DocumentList } from '@/features/courses/document-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCourseStore } from '@/store/course-store';

export default function TeacherDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedCourse, setSelectedCourse } = useCourseStore();

  useEffect(() => {
    loadCourses();
  }, [refreshKey]);

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const response = await courseApi.getAll();
      setCourses(response.data);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setRefreshKey((prev) => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleBackToCourses}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{selectedCourse.name}</h1>
              <p className="text-muted-foreground">
                Course ID: {selectedCourse.course_id}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            <TabsTrigger value="documents">Manage Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Course Materials</CardTitle>
                <CardDescription>
                  Upload PDF, DOCX, or TXT files to add content to this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUpload
                  courseId={selectedCourse.course_id}
                  onSuccess={() => setRefreshKey((prev) => prev + 1)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Course Documents</CardTitle>
                <CardDescription>
                  View and manage all documents for this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList
                  courseId={selectedCourse.course_id}
                  refresh={refreshKey}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="text-muted-foreground">
            Create and manage your courses
          </p>
        </div>
        <CreateCourseDialog onSuccess={() => setRefreshKey((prev) => prev + 1)} />
      </div>

      <Separator />

      {courses.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">No courses yet</h2>
            <p className="text-muted-foreground">
              Create your first course to get started
            </p>
            <CreateCourseDialog onSuccess={() => setRefreshKey((prev) => prev + 1)} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelect={handleCourseSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
