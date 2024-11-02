import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
    name: String,
    number: Number,
    document_url: String,
    lesson_details: String,
    course_order: Number,
    type: String ,
    
});

const Lesson = mongoose.model('lesson', lessonSchemaSchema);

export default Lesson;