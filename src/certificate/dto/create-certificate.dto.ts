export class CreateCertificateDto {
  userId: number;
  type: 'project_completion' | 'course_completion' | 'achievement';
  title: string;
  studentName: string;
  className: string;
  projectTitle?: string;
  courseName: string;
  grade?: string;
  teacherRemarks?: string;
  completionDate: Date;
  brandLogo: 'edudigm' | 'stempowered';
}