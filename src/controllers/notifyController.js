import Quiz from '../models/quiz.schema.js';
import Student from '../models/student.schema.js';
import Course from '../models/course.schema.js';
import { addDays } from 'date-fns';

import nodemailer from 'nodemailer';


import NotFoundError from '../errors/notFoundError.js';
import ForbiddenError from '../errors/forbiddenError.js';
import UnauthorizedError from '../errors/unauthorizedError.js';
import BadRequestError from '../errors/badRequestError.js';

export const getTimelineTest = async (req, res, next) => {
  const userId = req.user.id;

  try {
    // Parse and validate `days` parameter
    const parsedDays = req.params;
    const dayAsInteger = parseInt(parsedDays.day, 10);

    if (isNaN(dayAsInteger) || dayAsInteger < 1) {
      throw new BadRequestError('Invalid number of days provided. Please ensure it is a positive integer.');
    }

    const now = new Date();
    const endDate = addDays(now, dayAsInteger);

    // Step 1: Find student's courses
    const student = await Student.findOne({ user: userId }).populate('courses');
    if (!student) {
      throw new NotFoundError('Student not found or has no courses');
    }

    // Step 2: Get quizzes associated with student's courses
    const courseIds = student.courses.map(course => course._id);
    const courses = await Course.find({ _id: { $in: courseIds } }).populate('quiz');

    // Step 3: Collect quizzes within the specified date range
    const quizzes = [];
    courses.forEach(course => {
      course.quiz.forEach(quiz => {
        if (quiz.end_deadline >= now && quiz.end_deadline <= endDate) {
          quizzes.push({
            name: quiz.name,
            end_deadline: quiz.end_deadline,
            days_remaining: Math.ceil((new Date(quiz.end_deadline) - now) / (1000 * 60 * 60 * 24)),
          });
        }
      });
    });

    // Step 4: Send the response with quizzes found
    res.status(200).json({
      quizzes,
      message: `Found ${quizzes.length} upcoming quizzes within the next ${dayAsInteger} days.`,
    });
  } catch (error) {
    // Pass the custom error to the error-handling middleware
    next(error);
  }
};





// Cấu hình transporter cho Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '21110889@student.hcmute.edu.vn',
    pass: 'Hung1110@@@@', // Thay bằng mật khẩu của bạn
  }
});

// Hàm gửi email cho một bài tập
const sendEmail = async (assignment) => {
  const mailOptions = {
    from: 'deadlinetoine@gmail.com',
    to: assignment.userEmail,
    subject: 'Thông báo: Bài tập sắp hết hạn',
    text: `Bài tập "${assignment.title}" của bạn sắp hết hạn vào ${assignment.dueDate}.`
  };

  return transporter.sendMail(mailOptions);
};

// Controller để gửi thông báo
export const sendReminder = async (req, res) => {
  const { courseId } = req.params;
  const days = req.query.days ? parseInt(req.query.days) : 2;  // Nhận số ngày từ query hoặc mặc định là 2

  try {
    console.log(days)
    // Lấy danh sách bài tập sắp hết hạn trong khóa học cụ thể
    const expiringAssignments = await getExpiringAssignments(courseId, days);

    if (expiringAssignments.length === 0) {
      return res.send('No expiring assignments found.');
    }

    // Sử dụng Promise.all để gửi email cho tất cả các bài tập gần hết hạn
    await Promise.all(expiringAssignments.map(async (assignment) => {
      try {
        await sendEmail(assignment);
        console.log('Email sent:', assignment.userEmail);
      } catch (error) {
        console.log('Error sending email:', error);
      }
    }));

    res.send('Reminders sent successfully!');
  } catch (error) {
    res.status(500).send('Error in sending reminders');
  }
};

async function getExpiringAssignments(courseId, days) {
  const today = new Date();
// Lấy thời gian hiện tại ở Việt Nam (UTC+7)
const nowInVietnam = new Date(today.getTime() + 7 * 60 * 60 * 1000);

// Xác định thời điểm bắt đầu và kết thúc
const startOfSearch = nowInVietnam; // Thời gian bắt đầu tìm kiếm
const endOfSearch = new Date(nowInVietnam); // Thời gian kết thúc
endOfSearch.setDate(nowInVietnam.getDate() + days); // Thêm số ngày vào ngày hiện tại

// Thay đổi giờ, phút, giây cho endOfSearch về cùng giờ với nowInVietnam
endOfSearch.setHours(nowInVietnam.getHours(), nowInVietnam.getMinutes(), nowInVietnam.getSeconds(), nowInVietnam.getMilliseconds());

console.log("Start of Search:", startOfSearch.toISOString());
console.log("End of Search:", endOfSearch.toISOString());


  // Tìm khóa học và lọc các bài quiz gần đến hạn ngay trong truy vấn
  const course = await Course.findById(courseId)
    .populate({
      path: 'quiz',
      match: {
        end_deadline: { $gte: startOfSearch, $lte: endOfSearch }
      }
    })
    .lean();

  if (!course || !course.quiz || course.quiz.length === 0) {
    return [];  // Trả về rỗng nếu không có quiz nào gần đến hạn
  }

  // Lấy tất cả sinh viên của khóa học trong một truy vấn
  const studentsInCourse = await Student.find({ courses: course._id })
    .populate('user', 'email') // Chỉ lấy email
    .lean();

  const assignments = [];

  // Tạo danh sách bài tập sắp hết hạn cho từng sinh viên
  for (const quiz of course.quiz) {
    for (const student of studentsInCourse) {
      const user = student.user;
      if (user) {
        assignments.push({
          title: quiz.name,
          userEmail: user.email,
          dueDate: quiz.end_deadline.toISOString().split('T')[0]
        });
      }
    }
  }

  return assignments;
}






// Sử dụng thử hàm với tham số ngày
//getExpiringAssignments('67285d33a6ab2a9f4a03d9be',1).then(result => console.log(result)).catch(console.error);

